import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupportService } from './support.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const createMockPrisma = () => ({
  supportTicket: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  supportMessage: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((arg: unknown[]) => Promise.all(arg)),
});

const customer = { userId: 'cust-1' } as unknown as AuthUser;
const agent = { userId: 'agent-1' } as unknown as AuthUser;

const ticketRow = (status: string) => ({
  id: 't-1',
  ticketNumber: 'NT7K2P9Q',
  subject: 'Cannot log in',
  description: 'My password does not work',
  status,
  assigneeId: null,
  customer: { id: 'cust-1', firstName: 'Lena', lastName: 'Hoffmann', email: 'lena@example.com' },
  assignee: null,
});

describe('SupportService', () => {
  let service: SupportService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let mail: { sendSupportReplyEmail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    mail = { sendSupportReplyEmail: vi.fn().mockResolvedValue(undefined) };
    service = new SupportService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      mail as unknown as MailService,
    );
  });

  it('creates an OPEN ticket with a unique NT number, the JWT identity, and TICKET_CREATED audit', async () => {
    prisma.supportTicket.create.mockImplementation(({ data }) => Promise.resolve({ id: 't-1', ...data }));

    const ticket = await service.create(
      { subject: 'Cannot log in', description: 'My password does not work' },
      customer,
    );

    expect(ticket.status).toBe('OPEN');
    expect(ticket.ticketNumber).toMatch(/^NT[A-Z0-9]{6}$/);
    expect(ticket.userId).toBe('cust-1');
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'cust-1',
      actorType: 'User',
      action: 'TICKET_CREATED',
      targetType: 'SupportTicket',
      targetId: 't-1',
      metadata: { ticketNumber: ticket.ticketNumber },
    });
  });

  it('retries once on a ticket-number collision (P2002)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
    prisma.supportTicket.create
      .mockRejectedValueOnce(p2002)
      .mockImplementation(({ data }) => Promise.resolve({ id: 't-2', ...data }));

    const ticket = await service.create({ subject: 'Profile wrong', description: 'My name is misspelled' }, customer);

    expect(prisma.supportTicket.create).toHaveBeenCalledTimes(2);
    expect(ticket.id).toBe('t-2');
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('claim: OPEN → IN_PROGRESS, assigns the acting agent, audits TICKET_CLAIMED', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1', status: 'OPEN' });
    prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue(ticketRow('IN_PROGRESS'));

    await service.transition('t-1', 'claim', agent);

    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: 't-1', status: 'OPEN' },
      data: { status: 'IN_PROGRESS', assigneeId: 'agent-1' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'agent-1',
        actorType: 'Staff',
        action: 'TICKET_CLAIMED',
        metadata: { ticketNumber: 'NT7K2P9Q', previousStatus: 'OPEN', newStatus: 'IN_PROGRESS' },
      }),
    );
  });

  it('resolve: IN_PROGRESS → RESOLVED with resolvedAt, audits TICKET_RESOLVED', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1', status: 'IN_PROGRESS' });
    prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue(ticketRow('RESOLVED'));

    await service.transition('t-1', 'resolve', agent);

    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-1', status: 'IN_PROGRESS' },
        data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TICKET_RESOLVED' }));
  });

  it('close: RESOLVED → CLOSED, audits TICKET_CLOSED', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1', status: 'RESOLVED' });
    prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue(ticketRow('CLOSED'));

    await service.transition('t-1', 'close', agent);

    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TICKET_CLOSED' }));
  });

  it('reopen: RESOLVED → OPEN, clears resolvedAt, audits TICKET_REOPENED', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1', status: 'RESOLVED' });
    prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue(ticketRow('OPEN'));

    await service.transition('t-1', 'reopen', agent);

    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OPEN', resolvedAt: null }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TICKET_REOPENED' }));
  });

  it.each([
    ['claim', 'IN_PROGRESS'],
    ['resolve', 'OPEN'],
    ['close', 'OPEN'], // an agent must never close an OPEN ticket directly
    ['close', 'IN_PROGRESS'],
    ['reopen', 'OPEN'],
    ['reopen', 'CLOSED'],
  ] as const)('rejects %s when the ticket is %s — no write, no audit', async (action, status) => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1', status });

    await expect(service.transition('t-1', action, agent)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('treats a lost compare-and-set race as an invalid transition (no audit)', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1', status: 'OPEN' });
    prisma.supportTicket.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.transition('t-1', 'claim', agent)).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('404s transitions and reads for unknown tickets', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(null);

    await expect(service.transition('missing', 'claim', agent)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll applies status/ticketNumber/email filters with pagination', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([{ ...ticketRow('OPEN'), messages: [], _count: { messages: 0 } }]);
    prisma.supportTicket.count.mockResolvedValue(41);

    const result = await service.findAll({ page: 2, limit: 20, status: 'OPEN', ticketNumber: 'NT7K', email: 'lena' });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'OPEN',
          ticketNumber: { contains: 'NT7K' },
          customer: { email: { contains: 'lena', mode: 'insensitive' } },
        },
        skip: 20,
        take: 20,
      }),
    );
    expect(result).toMatchObject({ page: 2, limit: 20, total: 41, totalPages: 3 });
  });

  it('findMine returns only the authenticated customer’s tickets', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);

    await service.findMine(customer);

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'cust-1' } }),
    );
  });

  it('creates the complaint as the opening CUSTOMER message (unread for staff)', async () => {
    prisma.supportTicket.create.mockImplementation(({ data }) => Promise.resolve({ id: 't-1', ...data }));
    prisma.supportMessage.create.mockResolvedValue({});

    await service.create({ subject: 'Cannot log in', description: 'My password does not work' }, customer);

    expect(prisma.supportMessage.create).toHaveBeenCalledWith({
      data: {
        ticketId: 't-1',
        senderType: 'CUSTOMER',
        senderId: 'cust-1',
        body: 'My password does not work',
      },
    });
  });

  it('overview returns support-only counts', async () => {
    prisma.supportTicket.count
      .mockResolvedValueOnce(7) // total
      .mockResolvedValueOnce(3) // open
      .mockResolvedValueOnce(2) // in progress
      .mockResolvedValueOnce(1) // resolved
      .mockResolvedValueOnce(1); // closed
    prisma.supportMessage.count.mockResolvedValue(4);

    const result = await service.overview();

    expect(result).toEqual({ total: 7, open: 3, unreadMessages: 4, inProgress: 2, resolved: 1, closed: 1 });
  });

  it('findAll maps lastMessageAt and unreadCount from the messages relation', async () => {
    const lastAt = new Date('2026-10-07T10:00:00Z');
    prisma.supportTicket.findMany.mockResolvedValue([
      {
        ...ticketRow('OPEN'),
        messages: [{ createdAt: lastAt }],
        _count: { messages: 2 },
      },
    ]);
    prisma.supportTicket.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.items[0]).toMatchObject({ lastMessageAt: lastAt, unreadCount: 2 });
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { messages: { where: { senderType: 'CUSTOMER', readByStaffAt: null } } } },
        }),
      }),
    );
  });

  it('getConversation returns messages oldest-first with sender info', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(ticketRow('OPEN'));
    prisma.supportMessage.findMany.mockResolvedValue([{ id: 'm-1' }]);

    const result = await service.getConversation('t-1');

    expect(result.messages).toHaveLength(1);
    expect(prisma.supportMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticketId: 't-1' }, orderBy: { createdAt: 'asc' } }),
    );
  });

  it('markRead clears unread customer messages and 404s unknown tickets', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't-1' });
    prisma.supportMessage.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markRead('t-1');

    expect(result).toEqual({ read: 2 });
    expect(prisma.supportMessage.updateMany).toHaveBeenCalledWith({
      where: { ticketId: 't-1', senderType: 'CUSTOMER', readByStaffAt: null },
      data: { readByStaffAt: expect.any(Date) },
    });

    prisma.supportTicket.findUnique.mockResolvedValue(null);
    await expect(service.markRead('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reply: persists the message, emails the customer, marks SENT, audits TICKET_MESSAGE_SENT', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(ticketRow('IN_PROGRESS'));
    prisma.supportMessage.create.mockResolvedValue({ id: 'm-1' });
    prisma.supportMessage.update.mockResolvedValue({ id: 'm-1', deliveryStatus: 'SENT' });

    const result = await service.reply('t-1', { body: 'We reset your password.' }, agent);

    expect(prisma.supportMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 't-1', senderType: 'SUPPORT_STAFF', senderId: 'agent-1', body: 'We reset your password.' },
    });
    expect(mail.sendSupportReplyEmail).toHaveBeenCalledWith(
      { email: 'lena@example.com', firstName: 'Lena' },
      'NT7K2P9Q',
      'We reset your password.',
    );
    expect(prisma.supportMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deliveryStatus: 'SENT' } }),
    );
    expect(result.deliveryStatus).toBe('SENT');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'agent-1', actorType: 'Staff', action: 'TICKET_MESSAGE_SENT' }),
    );
  });

  it('reply: on email failure the message stays FAILED and the call errors — never marked SENT', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(ticketRow('IN_PROGRESS'));
    prisma.supportMessage.create.mockResolvedValue({ id: 'm-1' });
    mail.sendSupportReplyEmail.mockRejectedValue(new Error('smtp down'));
    prisma.supportMessage.update.mockResolvedValue({ id: 'm-1', deliveryStatus: 'FAILED' });

    await expect(service.reply('t-1', { body: 'Hello' }, agent)).rejects.toBeInstanceOf(BadGatewayException);
    // The 502 body must not leak provider internals (e.g. SMTP errors).
    await expect(service.reply('t-1', { body: 'Hello' }, agent)).rejects.toThrow(
      'Email delivery failed — the reply was recorded but not sent.',
    );
    await expect(service.reply('t-1', { body: 'Hello' }, agent)).rejects.not.toThrow('smtp down');
    expect(prisma.supportMessage.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { deliveryStatus: 'FAILED' },
    });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects replies to CLOSED tickets', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(ticketRow('CLOSED'));

    await expect(service.reply('t-1', { body: 'Hello' }, agent)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
    expect(mail.sendSupportReplyEmail).not.toHaveBeenCalled();
  });

  it('customer conversation is scoped to the owner — other customers get 404', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't-1', ticketNumber: 'NT7K2P9Q' });
    prisma.supportMessage.findMany.mockResolvedValue([]);

    await service.findConversationForCustomer('t-1', customer);
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't-1', userId: 'cust-1' } }),
    );

    prisma.supportTicket.findFirst.mockResolvedValue(null);
    await expect(service.findConversationForCustomer('t-1', customer)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unreadOnly=true filters to tickets with at least one unread CUSTOMER message', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    prisma.supportTicket.count.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20, unreadOnly: 'true' });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          messages: { some: { senderType: 'CUSTOMER', readByStaffAt: null } },
        }),
      }),
    );
  });

  it('unreadOnly absent or false does not constrain the query', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    prisma.supportTicket.count.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20 });
    await service.findAll({ page: 1, limit: 20, unreadOnly: 'false' });

    for (const call of prisma.supportTicket.findMany.mock.calls) {
      expect(call[0].where).not.toHaveProperty('messages.some');
    }
  });

  it('history search matches number, subject, customer name, or customer email (case-insensitive)', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    prisma.supportTicket.count.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20, status: 'CLOSED', search: 'lena' });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CLOSED',
          OR: [
            { ticketNumber: { contains: 'lena', mode: 'insensitive' } },
            { subject: { contains: 'lena', mode: 'insensitive' } },
            { customer: { firstName: { contains: 'lena', mode: 'insensitive' } } },
            { customer: { lastName: { contains: 'lena', mode: 'insensitive' } } },
            { customer: { email: { contains: 'lena', mode: 'insensitive' } } },
          ],
        }),
      }),
    );
  });

  it('history date filters use closedAt inclusively, and combine with search', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    prisma.supportTicket.count.mockResolvedValue(0);

    await service.findAll({
      page: 1,
      limit: 20,
      status: 'CLOSED',
      search: 'lena',
      closedFrom: '2026-10-01',
      closedTo: '2026-10-07',
    });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CLOSED',
          closedAt: {
            gte: new Date('2026-10-01T00:00:00Z'),
            lte: new Date('2026-10-07T23:59:59.999Z'),
          },
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('addCustomerMessage creates an unread CUSTOMER message without touching open tickets', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't-1', status: 'IN_PROGRESS', ticketNumber: 'NT7K2P9Q' });
    prisma.supportMessage.create.mockImplementation(({ data }) => Promise.resolve({ id: 'm-9', ...data }));

    const message = await service.addCustomerMessage('t-1', { body: 'One more detail…' }, customer);

    expect(message).toMatchObject({ senderType: 'CUSTOMER', senderId: 'cust-1' });
    expect(message).not.toHaveProperty('readByStaffAt');
    expect(prisma.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('addCustomerMessage on a CLOSED ticket reopens it (OPEN, timestamps cleared) and audits TICKET_REOPENED', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't-1', status: 'CLOSED', ticketNumber: 'NT7K2P9Q' });
    prisma.supportMessage.create.mockImplementation(({ data }) => Promise.resolve({ id: 'm-9', ...data }));
    prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });

    await service.addCustomerMessage('t-1', { body: 'The problem is back.' }, customer);

    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: 't-1', status: 'CLOSED' },
      data: { status: 'OPEN', closedAt: null, resolvedAt: null },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'cust-1',
        actorType: 'User',
        action: 'TICKET_REOPENED',
        metadata: { ticketNumber: 'NT7K2P9Q', previousStatus: 'CLOSED', newStatus: 'OPEN' },
      }),
    );
  });

  it('addCustomerMessage enforces customer ownership (404 for other people’s tickets)', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);

    await expect(service.addCustomerMessage('t-1', { body: 'x' }, customer)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
  });
});
