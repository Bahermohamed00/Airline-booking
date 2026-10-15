import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Airport,
  Baggage,
  BoardingPass,
  Booking,
  BookingExtra,
  BookingPassenger,
  BookingSeat,
  CabinClass,
  CheckIn,
  ExtraService,
  Flight,
  FlightSegment,
  Passenger,
  Prisma,
  Route,
  SeatHold,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BaggageService } from '../baggage/baggage.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import type { CheckinBookingsQueryDto } from './dto/checkin-bookings-query.dto.js';
import type { CompleteCheckinDto } from './dto/complete-checkin.dto.js';

/** Check-in window: opens 24h before departure, closes 1h before departure. */
const CHECKIN_OPENS_BEFORE_MS = 24 * 60 * 60 * 1000;
const CHECKIN_CLOSES_BEFORE_MS = 60 * 60 * 1000;

/** Operational list: include flights departing up to 2h in the past (just-closed desks). */
const OPERATIONAL_LOOKBACK_MS = 2 * 60 * 60 * 1000;
const OPERATIONAL_LIST_LIMIT = 200;

export type CheckinWindowState = 'NOT_OPEN' | 'OPEN' | 'CLOSED';

/**
 * The single source of truth for the online check-in window — used by both
 * completion (409 codes) and the staff operational list (display state).
 */
export function checkinWindowState(departure: Date, now: Date): CheckinWindowState {
  const dep = departure.getTime();
  const t = now.getTime();
  if (t < dep - CHECKIN_OPENS_BEFORE_MS) return 'NOT_OPEN';
  if (t > dep - CHECKIN_CLOSES_BEFORE_MS) return 'CLOSED';
  return 'OPEN';
}

const BOOKING_NOT_FOUND = { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' };

type FlightInCheckinView = Flight & {
  route: Route & { originAirport: Airport; destinationAirport: Airport };
  segments: FlightSegment[];
};

export type CheckinBooking = Booking & {
  bookingPassengers: (BookingPassenger & {
    passenger: Passenger;
    seats: BookingSeat[];
    checkIns: (CheckIn & { boardingPass: BoardingPass | null })[];
    baggage: Baggage[];
  })[];
  // Live catalog join: the purchased bag weight is configured on the catalog
  // row (server-validated metadata) — BookingExtra snapshots price fields only.
  bookingExtras: (BookingExtra & { extraService: ExtraService })[];
  seatHolds: (SeatHold & { flight: FlightInCheckinView })[];
};

const BOOKING_INCLUDE = {
  bookingPassengers: {
    include: {
      passenger: true,
      seats: true,
      checkIns: { include: { boardingPass: true } },
      // Issued bags (tags) — surfaced on the owner's boarding-pass view.
      baggage: true,
    },
  },
  // Purchased extras drive the baggage allowance (weight per purchased piece)
  // at issuance time.
  bookingExtras: { include: { extraService: true } },
  seatHolds: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      flight: {
        include: {
          route: { include: { originAirport: true, destinationAirport: true } },
          segments: { orderBy: { segmentNumber: 'asc' as const } },
        },
      },
    },
  },
} as const;

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    // No circularity: the baggage module never imports the checkin module.
    @Inject(BaggageService) private readonly baggage: BaggageService,
  ) {}

  // ---------- Lookup ----------

  /**
   * Manage-lookup security model: authenticated customers only ever resolve
   * their OWN bookings. A reference that does not belong to the caller is
   * indistinguishable from one that does not exist (404) — the endpoint never
   * reveals the existence of other customers' bookings.
   */
  async lookupBookings(user: AuthUser, query: CheckinBookingsQueryDto) {
    const hasReference = !!query.reference;
    const hasEmail = !!query.email;
    if (hasReference === hasEmail) {
      throw new BadRequestException({
        code: 'CHECKIN_LOOKUP_PARAMS',
        message: 'Provide exactly one of reference or email',
      });
    }

    if (hasEmail) {
      if (query.email!.toLowerCase() !== user.email.toLowerCase()) {
        throw new BadRequestException({
          code: 'EMAIL_MISMATCH',
          message: 'Please sign in with the booking email to look up bookings by email',
        });
      }
      const bookings = (await this.prisma.booking.findMany({
        where: { userId: user.userId },
        include: BOOKING_INCLUDE,
        orderBy: { bookedAt: 'desc' },
      })) as CheckinBooking[];
      return bookings.map((b) => this.toLookupView(b));
    }

    const booking = (await this.prisma.booking.findFirst({
      where: {
        userId: user.userId,
        bookingReference: { equals: query.reference!, mode: 'insensitive' },
      },
      include: BOOKING_INCLUDE,
    })) as CheckinBooking | null;
    if (!booking) {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }
    return [this.toLookupView(booking)];
  }

  // ---------- Completion ----------

  async completeCheckIn(user: AuthUser, dto: CompleteCheckinDto) {
    const booking = (await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, userId: user.userId },
      include: BOOKING_INCLUDE,
    })) as CheckinBooking | null;
    if (!booking) {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }

    const bookingPassenger = booking.bookingPassengers.find((bp) => bp.id === dto.bookingPassengerId);
    if (!bookingPassenger) {
      throw new NotFoundException({
        code: 'PASSENGER_NOT_FOUND',
        message: 'Passenger does not belong to this booking',
      });
    }

    if (booking.status !== 'CONFIRMED' && booking.status !== 'CHECKED_IN') {
      throw new ConflictException({
        code: 'CHECKIN_NOT_ELIGIBLE',
        message: 'Only confirmed bookings can be checked in',
      });
    }

    const flight = booking.seatHolds[0]?.flight;
    if (!flight || flight.segments.length === 0) {
      throw new ConflictException({
        code: 'CHECKIN_NOT_ELIGIBLE',
        message: 'Flight information is missing for this booking',
      });
    }

    const now = Date.now();
    const windowState = checkinWindowState(flight.departureTime, new Date(now));
    if (windowState === 'NOT_OPEN') {
      throw new ConflictException({
        code: 'CHECKIN_NOT_OPEN',
        message: 'Online check-in opens 24 hours before departure',
      });
    }
    if (windowState === 'CLOSED') {
      throw new ConflictException({
        code: 'CHECKIN_CLOSED',
        message: 'Online check-in closed 1 hour before departure',
      });
    }

    if (bookingPassenger.checkIns.some((c) => c.status === 'COMPLETED')) {
      throw new ConflictException({
        code: 'ALREADY_CHECKED_IN',
        message: 'Passenger is already checked in for this flight',
      });
    }

    const cabinClass =
      (booking.fareRulesSnapshot as { cabinClass?: CabinClass } | null)?.cabinClass ?? 'ECONOMY';
    const boardingGroup = boardingGroupFor(cabinClass);

    const created = await this.prisma.$transaction(async (tx) => {
      const checkIns: (CheckIn & { boardingPass: BoardingPass })[] = [];
      // True when this check-in revives staff-invalidated (CANCELLED) rows:
      // bags were already issued at the original check-in and are never
      // re-issued, so a re-check-in can never duplicate baggage.
      let revived = false;
      for (const segment of flight.segments) {
        const seatNumber =
          bookingPassenger.seats.find((s) => s.flightSegmentId === segment.id)?.seatNumber ?? 'TBD';
        let checkIn: CheckIn;
        try {
          checkIn = await tx.checkIn.create({
            data: { bookingPassengerId: bookingPassenger.id, flightSegmentId: segment.id },
          });
        } catch (error) {
          if (this.isCheckInConflict(error)) {
            // @@unique([bookingPassengerId, flightSegmentId]) is the authoritative
            // guard against a concurrent double-submit.
            checkIn = await this.reviveCancelledCheckIn(tx, bookingPassenger.id, segment.id);
            revived = true;
          } else {
            throw error;
          }
        }
        const boardingPass = await tx.boardingPass.upsert({
          where: { checkInId: checkIn.id },
          create: { checkInId: checkIn.id, boardingGroup, seatNumber },
          // Revival: refresh the stale pass (seat/group may have changed).
          update: { boardingGroup, seatNumber, issuedAt: new Date() },
        });
        checkIns.push({ ...checkIn, boardingPass });
      }

      // Flip CONFIRMED→CHECKED_IN once EVERY passenger of the booking has a
      // completed check-in; partial check-in leaves the booking CONFIRMED. The
      // status predicate makes the transition a compare-and-set.
      const passengersDone = await tx.checkIn.count({
        where: {
          bookingPassenger: { bookingId: booking.id },
          flightSegmentId: flight.segments[0]!.id,
          status: 'COMPLETED',
        },
      });
      if (passengersDone === booking.bookingPassengers.length) {
        await tx.booking.updateMany({
          where: { id: booking.id, status: 'CONFIRMED' },
          data: { status: 'CHECKED_IN' },
        });
      }

      // Baggage issuance: only bags the passenger explicitly declared (never
      // assumed). Runs inside THIS transaction — a tag-issuance failure rolls
      // back the whole check-in rather than leaving partial records, and a
      // retried check-in (unique bp+segment guard) can never re-issue bags.
      // Each issued bag carries the configured per-piece weight of the
      // passenger's PURCHASED baggage allowance where one covers it — the
      // purchase and the declaration describe the same bags, so the purchased
      // pieces supply the weight for the first declared bags, and declared
      // bags beyond the purchase stay honestly unweighted.
      const bags =
        !revived && dto.checkedBagCount && dto.checkedBagCount > 0
          ? await this.baggage.issueCheckedBags(
              tx,
              bookingPassenger.id,
              dto.checkedBagCount,
              `${flight.route.originAirport.iataCode} online check-in`,
              this.baggageAllowanceWeights(booking, bookingPassenger.id),
            )
          : [];
      return { checkIns, bags };
    });

    const { status: bookingStatus } = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    });

    await this.logCheckInEvent(user, booking, flight, created.checkIns, created.bags.length);

    return {
      checkIns: created.checkIns.map((c) => this.toCheckInView(c)),
      bookingStatus,
      baggage: created.bags.map((b) => ({ tagNumber: b.tagNumber, status: b.status })),
    };
  }

  // ---------- Boarding passes ----------

  async boardingPasses(user: AuthUser, bookingId: string) {
    const booking = (await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      include: BOOKING_INCLUDE,
    })) as CheckinBooking | null;
    if (!booking) {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }

    const checkIns = booking.bookingPassengers.flatMap((bp) =>
      bp.checkIns
        .filter((c) => c.status === 'COMPLETED' && c.boardingPass)
        .map((c) => ({
          ...this.toCheckInView(c as CheckIn & { boardingPass: BoardingPass }),
          passenger: {
            firstName: bp.passenger.firstName,
            lastName: bp.passenger.lastName,
          },
          // Owner-scoped: the customer sees only tags issued for their own bags.
          baggage: bp.baggage.map((b) => ({ tagNumber: b.tagNumber, status: b.status })),
        })),
    );

    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      flight: this.toFlightView(booking.seatHolds[0]?.flight),
      checkIns,
    };
  }

  // ---------- Staff operations (checkin:manage) ----------

  /**
   * Operational check-in list for staff: upcoming confirmed/checked-in
   * bookings with per-passenger check-in aggregates and the server-computed
   * window state (same 24h/-1h rule as completion — never a client-side
   * reimplementation).
   */
  async findOperationalList(now = new Date()) {
    const bookings = (await this.prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        seatHolds: {
          some: {
            flight: {
              departureTime: {
                gte: new Date(now.getTime() - OPERATIONAL_LOOKBACK_MS),
              },
            },
          },
        },
      },
      include: BOOKING_INCLUDE,
      orderBy: { bookedAt: 'desc' },
      take: OPERATIONAL_LIST_LIMIT,
    })) as CheckinBooking[];

    return bookings
      .slice()
      .sort((a, b) => {
        const da = a.seatHolds[0]?.flight.departureTime.getTime() ?? 0;
        const db = b.seatHolds[0]?.flight.departureTime.getTime() ?? 0;
        return da - db;
      })
      .map((b) => this.toOperationalView(b, now));
  }

  /**
   * Staff invalidation of every active boarding pass of a booking (e.g. fraud
   * review, document mismatch). CAS COMPLETED→CANCELLED — concurrent
   * completions lose instead of corrupting — and the booking falls back to
   * CONFIRMED so passengers can check in again (revival path in
   * completeCheckIn). Baggage rows are untouched: already-checked bags follow
   * the separate baggage workflow. Audited, fail-soft.
   */
  async invalidateBoardingPasses(user: AuthUser, bookingId: string) {
    const booking = (await this.prisma.booking.findFirst({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    })) as CheckinBooking | null;
    if (!booking) {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }
    if (booking.status !== 'CONFIRMED' && booking.status !== 'CHECKED_IN') {
      throw new ConflictException({
        code: 'CHECKIN_NOT_ELIGIBLE',
        message: 'Only confirmed bookings can have boarding passes invalidated',
      });
    }

    const invalidated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.checkIn.updateMany({
        where: {
          bookingPassenger: { bookingId: booking.id },
          status: 'COMPLETED',
        },
        data: { status: 'CANCELLED' },
      });
      if (cas.count === 0) {
        throw new ConflictException({
          code: 'NO_ACTIVE_CHECKIN',
          message: 'This booking has no active boarding passes to invalidate',
        });
      }
      await tx.booking.updateMany({
        where: { id: booking.id, status: 'CHECKED_IN' },
        data: { status: 'CONFIRMED' },
      });
      return cas.count;
    });

    const { status: bookingStatus } = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    });

    try {
      await this.auditService.log({
        actorId: user.userId,
        actorType: 'Staff',
        action: 'BOARDING_PASSES_INVALIDATED',
        targetType: 'Booking',
        targetId: booking.id,
        bookingId: booking.id,
        metadata: {
          bookingReference: booking.bookingReference,
          flightNumber: booking.seatHolds[0]?.flight.flightNumber,
          invalidatedCount: invalidated,
        },
      });
    } catch (error) {
      // Audit failure must not break the committed invalidation.
      this.logger.warn(
        `audit log failed for BOARDING_PASSES_INVALIDATED ${booking.bookingReference}: ${String(error)}`,
      );
    }

    return { bookingId: booking.id, invalidatedCount: invalidated, bookingStatus };
  }

  // ---------- View mapping ----------

  private toLookupView(booking: CheckinBooking) {
    const flight = booking.seatHolds[0]?.flight;
    const firstSegmentId = flight?.segments[0]?.id;
    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      contactEmail: booking.contactEmail,
      flight: this.toFlightView(flight),
      segments: flight ? flight.segments.map((s) => ({ id: s.id, segmentNumber: s.segmentNumber })) : [],
      passengers: booking.bookingPassengers.map((bp) => ({
        bookingPassengerId: bp.id,
        firstName: bp.passenger.firstName,
        lastName: bp.passenger.lastName,
        passengerType: bp.passengerType,
        seatNumber: bp.seats.find((s) => s.flightSegmentId === firstSegmentId)?.seatNumber ?? null,
        checkedIn: bp.checkIns.some((c) => c.status === 'COMPLETED'),
      })),
    };
  }

  private toFlightView(flight: FlightInCheckinView | undefined) {
    if (!flight) return null;
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      departureTime: flight.departureTime,
      arrivalTime: flight.arrivalTime,
      route: {
        originIata: flight.route.originAirport.iataCode,
        destinationIata: flight.route.destinationAirport.iataCode,
        originCity: flight.route.originAirport.city,
        destinationCity: flight.route.destinationAirport.city,
      },
    };
  }

  private toCheckInView(checkIn: CheckIn & { boardingPass: BoardingPass }) {
    return {
      id: checkIn.id,
      bookingPassengerId: checkIn.bookingPassengerId,
      flightSegmentId: checkIn.flightSegmentId,
      checkInTime: checkIn.checkInTime,
      status: checkIn.status,
      boardingPass: {
        id: checkIn.boardingPass.id,
        boardingGroup: checkIn.boardingPass.boardingGroup,
        seatNumber: checkIn.boardingPass.seatNumber,
        gate: checkIn.boardingPass.gate,
        issuedAt: checkIn.boardingPass.issuedAt,
      },
    };
  }

  private toOperationalView(booking: CheckinBooking, now: Date) {
    const flight = booking.seatHolds[0]?.flight;
    const passengers = booking.bookingPassengers;
    // Per-passenger semantics: a passenger is checked in when a COMPLETED
    // check-in exists; "invalidated" means passes were cancelled and none is
    // currently active (a re-checked-in passenger counts as checked in again).
    const checkedInCount = passengers.filter((bp) =>
      bp.checkIns.some((c) => c.status === 'COMPLETED'),
    ).length;
    const invalidatedCount = passengers.filter(
      (bp) =>
        !bp.checkIns.some((c) => c.status === 'COMPLETED') &&
        bp.checkIns.some((c) => c.status === 'CANCELLED'),
    ).length;
    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      flight: flight ? { ...this.toFlightView(flight), status: flight.status } : null,
      passengersTotal: passengers.length,
      checkedInCount,
      invalidatedCount,
      windowState: flight ? checkinWindowState(flight.departureTime, now) : null,
    };
  }

  /**
   * Re-check-in after staff invalidated the passes: the CANCELLED row is
   * revived in place (the @@unique([bookingPassengerId, flightSegmentId]) row
   * stays the audit-stable identity, so re-check-in never creates a duplicate
   * record). A COMPLETED row is a genuine concurrent double-submit.
   */
  private async reviveCancelledCheckIn(
    tx: Prisma.TransactionClient,
    bookingPassengerId: string,
    flightSegmentId: string,
  ): Promise<CheckIn> {
    const existing = await tx.checkIn.findUnique({
      where: {
        bookingPassengerId_flightSegmentId: { bookingPassengerId, flightSegmentId },
      },
    });
    if (!existing || existing.status !== 'CANCELLED') {
      throw new ConflictException({
        code: 'ALREADY_CHECKED_IN',
        message: 'Passenger is already checked in for this flight',
      });
    }
    try {
      // Status-predicated update: a concurrent revive loses the race here.
      return await tx.checkIn.update({
        where: { id: existing.id, status: 'CANCELLED' },
        data: { status: 'COMPLETED', checkInTime: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException({
          code: 'ALREADY_CHECKED_IN',
          message: 'Passenger is already checked in for this flight',
        });
      }
      throw error;
    }
  }

  private isCheckInConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  /**
   * The passenger's purchased baggage allowance as one configured per-piece
   * weight per purchased piece, in line order. Only BAGGAGE lines attached to
   * THIS passenger count — a booking-scoped baggage line cannot be honestly
   * attributed to a passenger at issuance. The weight comes from the catalog
   * row's server-validated metadata (BAGGAGE services must declare
   * bagWeightKg); a legacy/invalid value contributes unweighted pieces (null)
   * rather than an invented number.
   */
  private baggageAllowanceWeights(
    booking: CheckinBooking,
    bookingPassengerId: string,
  ): (number | null)[] {
    const weights: (number | null)[] = [];
    for (const line of booking.bookingExtras ?? []) {
      if (line.category !== 'BAGGAGE') continue;
      if (line.bookingPassengerId !== bookingPassengerId) continue;
      const metadata = line.extraService.metadata;
      const raw =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)['bagWeightKg']
          : undefined;
      const weightKg = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
      for (let i = 0; i < line.quantity; i++) {
        weights.push(weightKg);
      }
    }
    return weights;
  }

  private async logCheckInEvent(
    user: AuthUser,
    booking: Booking,
    flight: FlightInCheckinView,
    checkIns: CheckIn[],
    bagCount = 0,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorId: user.userId,
        actorType: user.roles.some((r) => r !== 'Customer') ? 'Staff' : 'User',
        action: 'CHECK_IN_COMPLETED',
        targetType: 'Booking',
        targetId: booking.id,
        bookingId: booking.id,
        metadata: {
          bookingReference: booking.bookingReference,
          flightNumber: flight.flightNumber,
          checkInCount: checkIns.length,
          // Count only — tags stay retrievable via the staff baggage workflow.
          bagCount,
        },
      });
    } catch (error) {
      // Audit failure must not break an already-committed check-in.
      this.logger.warn(`audit log failed for CHECK_IN_COMPLETED ${booking.bookingReference}: ${String(error)}`);
    }
  }
}

function boardingGroupFor(cabinClass: CabinClass): string {
  if (cabinClass === 'FIRST' || cabinClass === 'BUSINESS') return 'A';
  if (cabinClass === 'PREMIUM_ECONOMY') return 'B';
  return 'C';
}
