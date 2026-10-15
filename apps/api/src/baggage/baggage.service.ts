import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Baggage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { RecordBaggageEventDto } from './dto/record-baggage-event.dto.js';
import { generateBagTag, isTagCollision, MAX_TAG_ATTEMPTS } from './bag-tag.js';

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

/**
 * Public tracking view — deliberately excludes passenger names, booking
 * references and internal ids. The tag number alone authorizes the lookup.
 */
export interface TrackedBaggageView {
  tagNumber: string;
  type: string;
  pieces: number;
  weightKg: number | null;
  status: string;
  events: Array<{ eventType: string; location: string | null; occurredAt: Date }>;
}

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

  /** Public tag lookup for customer baggage tracking — PII-free view, 404 when unknown. */
  async trackByTag(tagNumber: string): Promise<TrackedBaggageView> {    const bag = await this.prisma.baggage.findUnique({
      where: { tagNumber },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!bag) {
      throw new NotFoundException({
        code: 'BAGGAGE_NOT_FOUND',
        message: 'No bag was found for this tag number',
      });
    }
    return {
      // Non-null by construction: the row was found by this exact tag.
      tagNumber: bag.tagNumber ?? tagNumber,
      type: bag.type,
      pieces: bag.pieces,
      weightKg: bag.weightKg,
      status: bag.status,
      events: bag.events.map((e) => ({
        eventType: e.eventType,
        location: e.location,
        occurredAt: e.occurredAt,
      })),
    };
  }

  /**
   * Issues `count` checked-bag records for a booking passenger, each with a
   * freshly generated CSPRNG tag and its initial CHECKED_IN event. Runs inside
   * the CALLER's transaction so issuance is atomic with the triggering
   * operation (check-in) — a failure rolls back everything.
   *
   * `weightsKg[i]` is the configured per-piece weight of bag i from the
   * passenger's purchased baggage allowance (ExtraService metadata); bags
   * without a purchased/configured weight get null — weight is never invented.
   *
   * Collision policy: the tag_number unique index is the authority; only
   * recognized P2002 tag collisions retry with a fresh tag, bounded by
   * MAX_TAG_ATTEMPTS. Exhaustion (astronomically unlikely) fails the whole
   * operation rather than ever reusing or degrading a tag.
   */
  async issueCheckedBags(
    tx: Prisma.TransactionClient,
    bookingPassengerId: string,
    count: number,
    location: string,
    weightsKg: (number | null)[] = [],
  ): Promise<Baggage[]> {
    if (!Number.isInteger(count) || count < 0) {
      throw new BadRequestException({ code: 'BAGGAGE_COUNT_INVALID', message: 'checkedBagCount must be a non-negative integer' });
    }
    const issued: Baggage[] = [];
    for (let i = 0; i < count; i++) {
      issued.push(await this.issueOneBag(tx, bookingPassengerId, location, weightsKg[i] ?? null));
    }
    return issued;
  }

  private async issueOneBag(
    tx: Prisma.TransactionClient,
    bookingPassengerId: string,
    location: string,
    weightKg: number | null,
  ): Promise<Baggage> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_TAG_ATTEMPTS; attempt++) {
      const tagNumber = generateBagTag();
      try {
        const bag = await tx.baggage.create({
          data: {
            bookingPassengerId,
            type: 'CHECKED',
            pieces: 1,
            tagNumber,
            status: 'CHECKED_IN',
            weightKg,
          },
        });
        await tx.baggageEvent.create({
          data: { baggageId: bag.id, eventType: 'CHECKED_IN', location },
        });
        return bag;
      } catch (error) {
        if (isTagCollision(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw new InternalServerErrorException({
      code: 'BAG_TAG_ISSUANCE_FAILED',
      message: 'Could not issue a unique baggage tag — please retry the operation',
      cause: String(lastError),
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
