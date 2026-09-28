import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Airport, Booking, BookingPassenger, CabinClass, Fare, Flight, Passenger, Prisma, Route, Seat, SeatHold } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { generateBookingReference } from './booking-reference.js';
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
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      try {
        const booking = await this.createAttempt(user, dto);
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
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      const holds = await tx.seatHold.updateMany({
        where: { bookingId: booking.id, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
      return holds.count;
    });

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

  // ---------- Creation internals ----------

  private createAttempt(user: AuthUser, dto: CreateBookingDto): Promise<BookingWithRelations> {
    const bookingReference = generateBookingReference();
    const holdMinutes = Number(this.config.get('SEAT_HOLD_MINUTES') ?? 15);
    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60000);

    return this.prisma.$transaction(async (tx) => {
      const flight = (await tx.flight.findUnique({
        where: { id: dto.flightId },
        include: {
          route: true,
          fares: { where: { cabinClass: dto.cabinClass } },
          segments: { where: { segmentNumber: 1 }, select: { id: true } },
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

      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId: user.userId,
          status: 'PENDING',
          totalAmount,
          currency: fare.currency,
          contactEmail: dto.contactEmail ?? user.email,
          contactPhone: dto.contactPhone,
          fareRulesSnapshot: {
            cabinClass: dto.cabinClass,
            perPassenger: { ...perPassenger, total: perPassengerTotal },
            passengerCount: dto.passengers.length,
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
