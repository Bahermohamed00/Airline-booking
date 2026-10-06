import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Airport, Booking, BookingPassenger, CabinClass, Fare, Flight, Passenger, Prisma, Route, Seat, SeatHold } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { generateBookingReference } from './booking-reference.js';
import { hashCreateBookingRequest } from './booking-idempotency.js';
import { resolveSeatHoldMinutes } from './seat-hold-config.js';
import { refundPolicyFromFareRules } from '../payments/refund-policy.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { AdminBookingQueryDto } from './dto/admin-booking-query.dto.js';

const BOOKABLE_STATUSES = ['SCHEDULED', 'DELAYED'] as const;
const MAX_REFERENCE_ATTEMPTS = 3;

type FlightForValidation = Flight & { route: Route; fares: Fare[]; segments: { id: string }[] };

type FlightInBookingView = Flight & {
  route: Route & { originAirport: Airport; destinationAirport: Airport };
  fares: Fare[];
  segments: unknown[];
};

type BookingWithRelations = Booking & {
  bookingPassengers: (BookingPassenger & { passenger: Passenger })[];
  seatHolds: (SeatHold & { seat: Seat; flight: FlightInBookingView })[];
};

const BOOKING_INCLUDE = {
  bookingPassengers: { include: { passenger: true } },
  seatHolds: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      seat: true,
      flight: { include: { route: { include: { originAirport: true, destinationAirport: true } }, fares: true, segments: true } },
    },
  },
} as const;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  // ---------- Customer ----------

  async create(user: AuthUser, dto: CreateBookingDto) {
    const requestHash = hashCreateBookingRequest(dto);
    // Idempotent replay: same customer + same key returns the original booking;
    // the same key with a materially different request conflicts. Lookups are
    // scoped to the authenticated user, so a key never leaks across customers.
    const existing = await this.findByIdempotencyKey(user.userId, dto.idempotencyKey);
    if (existing) {
      return this.replayIdempotent(existing, requestHash);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      try {
        const booking = await this.createAttempt(user, dto, requestHash);
        const flightNumber = booking.seatHolds[0]?.flight.flightNumber;
        await this.logBookingEvent('BOOKING_CREATED', user, booking, { flightNumber });
        await this.logBookingEvent('SEAT_HELD', user, booking, {
          flightNumber,
          seatNumbers: booking.seatHolds.map((h) => h.seat.seatNumber),
          holdCount: booking.seatHolds.length,
        });
        return this.toView(booking);
      } catch (error) {
        lastError = error;
        if (this.isIdempotencyConflict(error)) {
          // Lost a concurrent same-key race: the (user_id, idempotency_key)
          // unique index serializes the inserts, so the winning booking is
          // already committed here. Replay it — exactly one booking exists.
          const winner = await this.findByIdempotencyKey(user.userId, dto.idempotencyKey);
          if (winner) {
            return this.replayIdempotent(winner, requestHash);
          }
          throw new ConflictException('A booking with this idempotency key is being created concurrently — retry the request');
        }
        if (attempt < MAX_REFERENCE_ATTEMPTS - 1 && this.isReferenceConflict(error)) continue;
        throw error;
      }
    }
    throw lastError;
  }

  async findMine(user: AuthUser) {
    const bookings = await this.prisma.booking.findMany({
      where: { userId: user.userId },
      include: BOOKING_INCLUDE,
      orderBy: { bookedAt: 'desc' },
    });
    return bookings.map((b) => this.toView(b));
  }

  async findMineOne(user: AuthUser, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId: user.userId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.toView(booking);
  }

  async cancelMine(user: AuthUser, id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, userId: user.userId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === 'CANCELLED') {
      throw new ConflictException('Booking is already cancelled');
    }
    if (booking.status !== 'PENDING') {
      throw new ConflictException('Only bookings awaiting payment can be cancelled at this time');
    }

    const released = await this.prisma.$transaction(async (tx) => {
      // Atomic compare-and-set: the status predicate is part of the UPDATE, so
      // a booking confirmed concurrently (PENDING→CONFIRMED by payment) never
      // matches — exactly one of the two transitions can win. An unconditional
      // update-by-id would be a TOCTOU race against payment confirmation.
      const cas = await tx.booking.updateMany({
        where: { id: booking.id, userId: user.userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (cas.count !== 1) {
        return null;
      }
      // A cancelled booking must never hold seat inventory. PENDING bookings
      // have no BookingSeat rows by construction (they are created only at
      // payment confirmation); the scoped delete enforces the invariant
      // unconditionally. Booking, passenger and payment history are preserved.
      await tx.bookingSeat.deleteMany({
        where: { bookingPassenger: { bookingId: booking.id } },
      });
      const holds = await tx.seatHold.updateMany({
        where: { bookingId: booking.id, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
      return holds.count;
    });

    if (released === null) {
      // The CAS lost a concurrent race — report the transition that won.
      const current = await this.prisma.booking.findFirst({
        where: { id: booking.id },
        select: { status: true },
      });
      if (!current) {
        throw new NotFoundException('Booking not found');
      }
      if (current.status === 'CANCELLED') {
        throw new ConflictException('Booking is already cancelled');
      }
      throw new ConflictException('Only bookings awaiting payment can be cancelled at this time');
    }

    await this.logBookingEvent('BOOKING_CANCELLED', user, booking);
    if (released > 0) {
      await this.logBookingEvent('SEAT_HOLD_RELEASED', user, booking, { holdCount: released });
    }
    return this.findMineOne(user, id);
  }

  // ---------- Staff (read-only, existing bookings:read permission) ----------

  async findAllAdmin(query: AdminBookingQueryDto) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        bookingReference: query.reference ? { equals: query.reference.toUpperCase() } : undefined,
        status: query.status,
        contactEmail: query.email ? { contains: query.email, mode: 'insensitive' } : undefined,
      },
      include: BOOKING_INCLUDE,
      orderBy: { bookedAt: 'desc' },
    });
    return bookings.map((b) => this.toView(b));
  }

  async findOneAdmin(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.toView(booking);
  }

  /** Shared booking view for lifecycle flows (payments module) after mutations. */
  async getBookingView(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.toView(booking);
  }

  // ---------- Creation internals ----------

  private createAttempt(user: AuthUser, dto: CreateBookingDto, requestHash: string): Promise<BookingWithRelations> {
    const bookingReference = generateBookingReference();
    const holdMinutes = resolveSeatHoldMinutes(this.config.get('SEAT_HOLD_MINUTES'));
    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60000);

    return this.prisma.$transaction(async (tx) => {
      const flight = (await tx.flight.findUnique({
        where: { id: dto.flightId },
        include: {
          route: true,
          fares: { where: { cabinClass: dto.cabinClass } },
          // Payment confirmation creates BookingSeat rows for EVERY segment, so
          // creation must validate seat availability against all of them too.
          segments: { orderBy: { segmentNumber: 'asc' }, select: { id: true } },
        },
      })) as FlightForValidation | null;
      if (!flight) {
        throw new NotFoundException('Flight not found');
      }
      if (!(BOOKABLE_STATUSES as readonly string[]).includes(flight.status)) {
        throw new ConflictException(`Flight ${flight.flightNumber} is not bookable (status ${flight.status})`);
      }
      if (flight.departureTime.getTime() <= Date.now()) {
        throw new ConflictException(`Flight ${flight.flightNumber} has already departed`);
      }
      if (flight.segments.length === 0) {
        // Same precondition as payment confirmation — a segmentless flight
        // could never receive BookingSeat rows, so reject it at creation.
        throw new ConflictException(`Flight ${flight.flightNumber} has no segments — seats cannot be assigned`);
      }
      const fare = flight.fares[0];
      if (!fare) {
        throw new BadRequestException(`Cabin ${dto.cabinClass} is not offered on flight ${flight.flightNumber}`);
      }

      if (new Set(dto.seatIds).size !== dto.seatIds.length) {
        throw new BadRequestException('Duplicate seats in request');
      }
      if (dto.seatIds.length !== dto.passengers.length) {
        throw new BadRequestException('Seat count must match passenger count');
      }

      const seats = await tx.seat.findMany({ where: { id: { in: dto.seatIds } } });
      if (seats.length !== dto.seatIds.length) {
        throw new BadRequestException('One or more seats do not exist');
      }
      for (const seat of seats) {
        if (seat.aircraftId !== flight.aircraftId) {
          throw new BadRequestException(`Seat ${seat.seatNumber} does not belong to the aircraft of flight ${flight.flightNumber}`);
        }
        if (seat.cabinClass !== dto.cabinClass) {
          throw new BadRequestException(`Seat ${seat.seatNumber} is not in cabin ${dto.cabinClass}`);
        }
      }

      // Self-heal stale holds on these seats before checking availability;
      // the (flight, seat) partial unique index only protects ACTIVE rows.
      await tx.seatHold.updateMany({
        where: { flightId: flight.id, seatId: { in: dto.seatIds }, status: 'ACTIVE', expiresAt: { lte: new Date() } },
        data: { status: 'EXPIRED' },
      });

      const assigned = await tx.bookingSeat.findFirst({
        where: { flightSegmentId: { in: flight.segments.map((s) => s.id) }, seatId: { in: dto.seatIds } },
        select: { seatNumber: true },
      });
      if (assigned) {
        throw new ConflictException(`Seat ${assigned.seatNumber} is no longer available`);
      }
      const held = await tx.seatHold.findFirst({
        where: { flightId: flight.id, seatId: { in: dto.seatIds }, status: 'ACTIVE' },
        include: { seat: { select: { seatNumber: true } } },
      });
      if (held) {
        throw new ConflictException(`Seat ${held.seat.seatNumber} is no longer available`);
      }

      const taken = await tx.booking.findUnique({ where: { bookingReference }, select: { id: true } });
      if (taken) {
        throw new Prisma.PrismaClientKnownRequestError('booking reference collision', {
          code: 'P2002',
          clientVersion: 'booking-reference',
          meta: { target: ['booking_reference'] },
        });
      }

      const perPassenger = {
        basePrice: Number(fare.basePrice),
        taxAmount: Number(fare.taxAmount),
        feeAmount: Number(fare.feeAmount),
      };
      const perPassengerTotal = perPassenger.basePrice + perPassenger.taxAmount + perPassenger.feeAmount;
      const totalAmount = perPassengerTotal * dto.passengers.length;
      const refundPolicy = refundPolicyFromFareRules(fare.fareRules);

      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId: user.userId,
          idempotencyKey: dto.idempotencyKey,
          idempotencyRequestHash: requestHash,
          status: 'PENDING',
          totalAmount,
          currency: fare.currency,
          contactEmail: dto.contactEmail ?? user.email,
          contactPhone: dto.contactPhone,
          fareRulesSnapshot: {
            cabinClass: dto.cabinClass,
            perPassenger: { ...perPassenger, total: perPassengerTotal },
            passengerCount: dto.passengers.length,
            // BR-15: capture the fare's refund policy (when configured) so
            // cancellation refunds are computed from the rules sold, not the
            // rules that happen to be configured at cancellation time.
            refundPolicy: refundPolicy
              ? { refundable: refundPolicy.refundable, cancellationFeePercent: refundPolicy.cancellationFeePercent }
              : null,
          },
        },
      });

      for (let i = 0; i < dto.passengers.length; i++) {
        const p = dto.passengers[i]!;
        const passenger = await tx.passenger.create({
          data: {
            userId: user.userId,
            firstName: p.firstName,
            lastName: p.lastName,
            dateOfBirth: p.dateOfBirth ? new Date(`${p.dateOfBirth}T00:00:00Z`) : null,
            nationality: p.nationality,
            passportNumber: p.passportNumber,
          },
        });
        await tx.bookingPassenger.create({
          data: { bookingId: booking.id, passengerId: passenger.id, passengerType: p.passengerType ?? 'ADULT' },
        });
        try {
          await tx.seatHold.create({
            data: {
              flightId: flight.id,
              seatId: dto.seatIds[i]!,
              userId: user.userId,
              bookingId: booking.id,
              status: 'ACTIVE',
              expiresAt: holdExpiresAt,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const seatNumber = seats.find((s) => s.id === dto.seatIds[i])?.seatNumber ?? dto.seatIds[i];
            throw new ConflictException(`Seat ${seatNumber} is no longer available`);
          }
          throw error;
        }
      }

      const created = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: BOOKING_INCLUDE,
      });
      return created as BookingWithRelations;
    });
  }

  private isReferenceConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    return Array.isArray(target) && target.includes('booking_reference');
  }

  /** P2002 on the (user_id, idempotency_key) unique index — a concurrent same-key create won. */
  private isIdempotencyConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    return Array.isArray(target) && target.includes('idempotency_key');
  }

  private findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<BookingWithRelations | null> {
    return this.prisma.booking.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: BOOKING_INCLUDE,
    }) as Promise<BookingWithRelations | null>;
  }

  /** Replays a booking found by idempotency key; identical requests get the original result, different ones conflict. */
  private replayIdempotent(existing: BookingWithRelations, requestHash: string) {
    if (existing.idempotencyRequestHash !== requestHash) {
      throw new ConflictException('Idempotency key was already used with a different booking request');
    }
    return this.toView(existing);
  }

  private async logBookingEvent(action: string, user: AuthUser, booking: Booking, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await this.auditService.log({
        actorId: user.userId,
        actorType: user.roles.some((r) => r !== 'Customer') ? 'Staff' : 'User',
        action,
        targetType: 'Booking',
        targetId: booking.id,
        bookingId: booking.id,
        metadata: { bookingReference: booking.bookingReference, ...metadata },
      });
    } catch (error) {
      // Audit failure must not break an already-committed booking operation.
      this.logger.warn(`audit log failed for ${action} ${booking.bookingReference}: ${String(error)}`);
    }
  }

  // ---------- View mapping ----------

  private toView(booking: BookingWithRelations) {
    const flight = booking.seatHolds[0]?.flight;
    const snapshot = booking.fareRulesSnapshot as { cabinClass?: CabinClass; perPassenger?: { total: number } } | null;
    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      currency: booking.currency,
      contactEmail: booking.contactEmail,
      contactPhone: booking.contactPhone,
      cabinClass: snapshot?.cabinClass ?? null,
      perPassengerTotal: snapshot?.perPassenger?.total ?? null,
      bookedAt: booking.bookedAt,
      flight: flight
        ? {
            id: flight.id,
            flightNumber: flight.flightNumber,
            departureTime: flight.departureTime,
            arrivalTime: flight.arrivalTime,
            status: flight.status,
            origin: flight.route.originAirport.iataCode,
            destination: flight.route.destinationAirport.iataCode,
          }
        : null,
      passengers: booking.bookingPassengers.map((bp) => ({
        id: bp.passenger.id,
        firstName: bp.passenger.firstName,
        lastName: bp.passenger.lastName,
        dateOfBirth: bp.passenger.dateOfBirth,
        nationality: bp.passenger.nationality,
        passportNumber: bp.passenger.passportNumber,
        passengerType: bp.passengerType,
      })),
      seats: booking.seatHolds.map((h) => ({
        seatId: h.seatId,
        seatNumber: h.seat.seatNumber,
        holdStatus: h.status,
        holdExpiresAt: h.expiresAt,
      })),
    };
  }
}
