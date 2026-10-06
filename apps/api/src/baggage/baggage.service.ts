import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { RecordBaggageEventDto } from './dto/record-baggage-event.dto.js';

const BAGGAGE_INCLUDE = {
  events: { orderBy: { occurredAt: 'asc' } },
  bookingPassenger: {
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      booking: { select: { bookingReference: true } },
    },
  },
} satisfies Prisma.BaggageInclude;

export type BaggageWithHistory = Prisma.BaggageGetPayload<{
  include: typeof BAGGAGE_INCLUDE;
}>;

@Injectable()
export class BaggageService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async findAll(): Promise<BaggageWithHistory[]> {
    return this.prisma.baggage.findMany({
      include: BAGGAGE_INCLUDE,
      orderBy: { id: 'desc' },
    });
  }

  /** Records a handling event and moves the bag to the matching status atomically. */
  async recordEvent(
    baggageId: string,
    dto: RecordBaggageEventDto,
    actor?: AuthUser,
  ): Promise<BaggageWithHistory> {
    const existing = await this.prisma.baggage.findUnique({
      where: { id: baggageId },
    });
    if (!existing) {
      throw new NotFoundException('Baggage record not found');
    }

    const baggage = await this.prisma.$transaction(async (tx) => {
      await tx.baggageEvent.create({
        data: { baggageId, eventType: dto.eventType, location: dto.location },
      });
      return tx.baggage.update({
        where: { id: baggageId },
        data: { status: dto.eventType },
        include: BAGGAGE_INCLUDE,
      });
    });

    await this.auditService.log({
      actorId: actor?.userId,
      actorType: actor ? 'Staff' : 'System',
      action: 'BAGGAGE_EVENT_RECORDED',
      targetType: 'Baggage',
      targetId: baggage.id,
      metadata: {
        tagNumber: baggage.tagNumber,
        eventType: dto.eventType,
        location: dto.location,
      },
    });

    return baggage;
  }
}
