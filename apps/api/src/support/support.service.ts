import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupportTicket, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ReplyTicketDto } from './dto/reply-ticket.dto.js';
import { AdminTicketQueryDto } from './dto/admin-ticket-query.dto.js';
import { generateTicketNumber } from './ticket-number.js';

const TICKET_NUMBER_MAX_RETRIES = 3;

const CUSTOMER_INCLUDE = {
  // Support agents work a ticket with contact details only: name, email, phone.
  customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export type TicketWithPeople = SupportTicket & {
  customer: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone'>;
  assignee: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
};

/**
 * Explicit lifecycle transitions. Each agent action maps to exactly one
 * transition; anything else is rejected. Claim assigns the acting agent.
 *   claim:  OPEN → IN_PROGRESS (assignee = actor)
 *   resolve: IN_PROGRESS → RESOLVED (sets resolvedAt)
 *   close:   RESOLVED → CLOSED (sets closedAt) — an OPEN ticket can never close
 *   reopen:  RESOLVED → OPEN (clears resolvedAt; assignee kept)
 */
const TRANSITIONS = {
  claim: { from: 'OPEN', to: 'IN_PROGRESS', event: 'TICKET_CLAIMED' },
  resolve: { from: 'IN_PROGRESS', to: 'RESOLVED', event: 'TICKET_RESOLVED' },
  close: { from: 'RESOLVED', to: 'CLOSED', event: 'TICKET_CLOSED' },
  reopen: { from: 'RESOLVED', to: 'OPEN', event: 'TICKET_REOPENED' },
} as const;

export type TicketAction = keyof typeof TRANSITIONS;

@Injectable()
export class SupportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  /** Customer submits a complaint/request. Identity comes from the JWT, never the body. */
  async create(dto: CreateTicketDto, customer: AuthUser) {
    let ticket: SupportTicket | null = null;
    for (let attempt = 0; attempt < TICKET_NUMBER_MAX_RETRIES; attempt++) {
      try {
        ticket = await this.prisma.supportTicket.create({
          data: {
            ticketNumber: generateTicketNumber(),
            userId: customer.userId,
            subject: dto.subject,
            description: dto.description,
            status: 'OPEN',
          },
        });
        break;
      } catch (error) {
        const isNumberCollision =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isNumberCollision || attempt === TICKET_NUMBER_MAX_RETRIES - 1) throw error;
      }
    }

    await this.auditService.log({
      actorId: customer.userId,
      actorType: 'User',
      action: 'TICKET_CREATED',
      targetType: 'SupportTicket',
      targetId: ticket!.id,
      metadata: { ticketNumber: ticket!.ticketNumber },
    });

    // The complaint itself is the opening message of the conversation
    // (unread for staff until an agent opens the ticket).
    await this.prisma.supportMessage.create({
      data: {
        ticketId: ticket!.id,
        senderType: 'CUSTOMER',
        senderId: customer.userId,
        body: dto.description,
      },
    });

    return ticket!;
  }

  /** The customer's own tickets, newest first (slim view). */
  findMine(customer: AuthUser) {
    return this.prisma.supportTicket.findMany({
      where: { userId: customer.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    });
  }

  async findAll(query: AdminTicketQueryDto) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ticketNumber ? { ticketNumber: { contains: query.ticketNumber } } : {}),
      ...(query.email ? { customer: { email: { contains: query.email, mode: 'insensitive' as const } } } : {}),
      // Unread filter: at least one unread CUSTOMER message (stored unread state).
      ...(query.unreadOnly === 'true'
        ? { messages: { some: { senderType: 'CUSTOMER', readByStaffAt: null } } }
        : {}),
      // History search: number, subject, customer name, or customer email.
      ...(query.search
        ? {
            OR: [
              { ticketNumber: { contains: query.search, mode: 'insensitive' as const } },
              { subject: { contains: query.search, mode: 'insensitive' as const } },
              { customer: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
              { customer: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
              { customer: { email: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
      // History date range on closedAt (inclusive).
      ...(query.closedFrom || query.closedTo
        ? {
            closedAt: {
              ...(query.closedFrom ? { gte: new Date(`${query.closedFrom}T00:00:00Z`) } : {}),
              ...(query.closedTo ? { lte: new Date(`${query.closedTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          ...CUSTOMER_INCLUDE,
          messages: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { createdAt: true } },
          _count: { select: { messages: { where: { senderType: 'CUSTOMER', readByStaffAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items: rows.map(({ messages, _count, ...ticket }) => ({
        ...ticket,
        lastMessageAt: messages[0]?.createdAt ?? ticket.createdAt,
        unreadCount: _count.messages,
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /** Support-specific overview counts (no general admin statistics). */
  async overview() {
    const [total, open, unreadMessages, inProgress, resolved, closed] = await this.prisma.$transaction([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportMessage.count({ where: { senderType: 'CUSTOMER', readByStaffAt: null } }),
      this.prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
    ]);
    return { total, open, unreadMessages, inProgress, resolved, closed };
  }

  /** Full conversation for the agent inbox (oldest first, with senders). */
  async getConversation(id: string) {
    const ticket = await this.findOne(id);
    const messages = await this.prisma.supportMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });
    return { ticket, messages };
  }

  /** Marks every customer message on the ticket as read by staff (inbox badge clears). */
  async markRead(id: string): Promise<{ read: number }> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }
    const result = await this.prisma.supportMessage.updateMany({
      where: { ticketId: id, senderType: 'CUSTOMER', readByStaffAt: null },
      data: { readByStaffAt: new Date() },
    });
    return { read: result.count };
  }

  /**
   * Agent reply: the message is persisted first, then emailed through the
   * existing mail adapter. On delivery failure the message stays recorded
   * with deliveryStatus FAILED and the call errors out — a reply is never
   * reported as sent when the email did not go out.
   */
  async reply(id: string, dto: ReplyTicketDto, agent: AuthUser) {
    const ticket = await this.findOne(id);
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Cannot reply to a closed ticket');
    }

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderType: 'SUPPORT_STAFF',
        senderId: agent.userId,
        body: dto.body,
      },
    });

    try {
      await this.mail.sendSupportReplyEmail(
        { email: ticket.customer.email, firstName: ticket.customer.firstName },
        ticket.ticketNumber,
        dto.body,
      );
    } catch {
      await this.prisma.supportMessage.update({
        where: { id: message.id },
        data: { deliveryStatus: 'FAILED' },
      });
      // Never embed the provider error — it can contain SMTP internals.
      throw new BadGatewayException(
        'Email delivery failed — the reply was recorded but not sent.',
      );
    }

    const sent = await this.prisma.supportMessage.update({
      where: { id: message.id },
      data: { deliveryStatus: 'SENT' },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.auditService.log({
      actorId: agent.userId,
      actorType: 'Staff',
      action: 'TICKET_MESSAGE_SENT',
      targetType: 'SupportTicket',
      targetId: ticket.id,
      metadata: { ticketNumber: ticket.ticketNumber },
    });
    return sent;
  }

  /** Customer-side conversation — ownership enforced (404, never leaks existence). */
  async findConversationForCustomer(id: string, customer: AuthUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId: customer.userId },
      select: { id: true, ticketNumber: true, subject: true, status: true, createdAt: true },
    });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }
    const messages = await this.prisma.supportMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderType: true, body: true, deliveryStatus: true, createdAt: true },
    });
    return { ticket, messages };
  }

  /**
   * Customer follow-up message (owner-only). The message is unread for staff
   * by default. New activity on a CLOSED ticket reopens it (CLOSED → OPEN,
   * following the existing reopen semantics: assignee kept, terminal
   * timestamps cleared) so it resurfaces in the active inbox instead of
   * staying hidden in History.
   */
  async addCustomerMessage(id: string, dto: ReplyTicketDto, customer: AuthUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId: customer.userId },
      select: { id: true, status: true, ticketNumber: true },
    });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'CUSTOMER',
        senderId: customer.userId,
        body: dto.body,
      },
    });

    if (ticket.status === 'CLOSED') {
      await this.prisma.supportTicket.updateMany({
        where: { id: ticket.id, status: 'CLOSED' },
        data: { status: 'OPEN', closedAt: null, resolvedAt: null },
      });
      await this.auditService.log({
        actorId: customer.userId,
        actorType: 'User',
        action: 'TICKET_REOPENED',
        targetType: 'SupportTicket',
        targetId: ticket.id,
        metadata: { ticketNumber: ticket.ticketNumber, previousStatus: 'CLOSED', newStatus: 'OPEN' },
      });
    }

    return message;
  }

  async findOne(id: string): Promise<TicketWithPeople> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: CUSTOMER_INCLUDE });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }
    return ticket;
  }

  /**
   * Applies one explicit lifecycle action. The status transition is a
   * compare-and-set (`where: { id, status: <expected> }`), so concurrent
   * agents can never double-claim or skip states. Audit only on success.
   */
  async transition(id: string, action: TicketAction, agent: AuthUser) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) {
      throw new NotFoundException('Support ticket not found');
    }

    const { from, to, event } = TRANSITIONS[action];
    if (existing.status !== from) {
      throw new BadRequestException(`Cannot ${action} a ticket in status ${existing.status} (requires ${from})`);
    }

    const data: Prisma.SupportTicketUncheckedUpdateManyInput = { status: to };
    if (action === 'claim') data.assigneeId = agent.userId;
    if (action === 'resolve') data.resolvedAt = new Date();
    if (action === 'close') data.closedAt = new Date();
    if (action === 'reopen') data.resolvedAt = null;

    const cas = await this.prisma.supportTicket.updateMany({
      where: { id, status: from },
      data,
    });
    if (cas.count === 0) {
      throw new BadRequestException(`Cannot ${action} a ticket in status ${existing.status} (requires ${from})`);
    }

    const ticket = await this.prisma.supportTicket.findUniqueOrThrow({ where: { id }, include: CUSTOMER_INCLUDE });
    await this.auditService.log({
      actorId: agent.userId,
      actorType: 'Staff',
      action: event,
      targetType: 'SupportTicket',
      targetId: ticket.id,
      metadata: { ticketNumber: ticket.ticketNumber, previousStatus: from, newStatus: to },
    });
    return ticket;
  }
}
