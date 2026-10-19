import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Airport, Booking, BookingExtra, BookingPassenger, CabinClass, CancellationRequest, DiscountType, Fare, Flight, Offer, Passenger, Prisma, Route, Seat, SeatHold } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from '../payments/payments.service.js';
import { OffersService } from '../offers/offers.service.js';
import { ExtrasService } from '../extras/extras.service.js';
import { generateBookingReference } from './booking-reference.js';
import { hashCreateBookingRequest } from './booking-idempotency.js';
import { combineTotals, priceBooking, type BookingPricing, type OfferPricingSource } from './booking-pricing.js';
import { resolveSeatHoldMinutes } from './seat-hold-config.js';
import { refundPolicyFromFareRules, resolveRefundPolicy } from '../payments/refund-policy.js';
import {
  CANCELLATION_REJECTION_MESSAGES,
  evaluateCancellationPolicy,
} from './cancellation-policy.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { PricePreviewDto } from './dto/price-preview.dto.js';
import { AdminBookingQueryDto } from './dto/admin-booking-query.dto.js';
import { RequestCancellationDto } from './dto/request-cancellation.dto.js';

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
  bookingExtras: BookingExtra[];
  seatHolds: (SeatHold & { seat: Seat; flight: FlightInBookingView })[];
  cancellationRequests: CancellationRequest[];
};

const BOOKING_INCLUDE = {
  // Deterministic passenger order = creation order (= the client's passengers
  // array order). Without it Postgres returns physical row order, which
  // scrambled passenger-indexed data (extras associations) under load.
  bookingPassengers: { include: { passenger: true }, orderBy: { passenger: { createdAt: 'asc' as const } } },
  // Extras lines carry their own immutable snapshots (code/name/unit price/
  // currency/unit), so the plain relation is enough — no live catalog join.
  bookingExtras: true,
  seatHolds: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      seat: true,
      flight: { include: { route: { include: { originAirport: true, destinationAirport: true } }, fares: true, segments: true } },
    },
  },
  // Latest cancellation request only — the customer view surfaces its state.
  cancellationRequests: { orderBy: { requestedAt: 'desc' as const }, take: 1 },
} as const;

/**
 * Narrowed injection surface for PaymentsService. The constructor parameter is
 * typed with this Pick (not the class) on purpose: emitDecoratorMetadata emits
 * `Object` for type aliases, so the decorator metadata never eagerly touches
 * the PaymentsService binding across the bookings ⇄ payments ESM import cycle
 * (a class-typed parameter would crash at bootstrap with a TDZ error). The
 * actual injection token stays the lazy forwardRef class reference.
 */
type CancellationPayments = Pick<
  PaymentsService,
  | 'cancelOpenIntentsForCancelledBooking'
  | 'cancellationPreviewForCustomer'
>;

/**
 * Narrows an offer that passed OffersService.assertBookable to the pricing
 * input shape — assertBookable only returns offers with bookable discount
 * terms, so discountType/discountValue are guaranteed non-null here.
 */
const toPricingSource = (offer: Offer): OfferPricingSource => ({
  id: offer.id,
  title: offer.title,
  discountType: offer.discountType as DiscountType,
  discountValue: offer.discountValue as Prisma.Decimal,
});

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
    // forwardRef: PaymentsService already injects BookingsService — the
    // deferred reference keeps the circular service dependency resolvable.
    // Used post-commit (Phase 3.2C open-PaymentIntent cancellation) and for the
    // paid customer-cancellation flow (approved cancellation policy).
    @Inject(forwardRef(() => PaymentsService)) private readonly payments: CancellationPayments,
    // BR-16: bookable-offer eligibility check. No circularity — the offers
    // module never imports the bookings module.
    @Inject(OffersService) private readonly offersService: OffersService,
    // Purchasable extras: validation + server-side pricing. ExtrasModule does
    // not import BookingsModule, so there is no circularity.
    @Inject(ExtrasService) private readonly extrasService: ExtrasService,
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
        await this.logBookingEvent('BOOKING_CREATED', user, booking, {
          flightNumber,
          extrasCount: booking.bookingExtras.length,
        });
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

  /**
   * BR-16: read-only price preview. Reuses creation's flight/fare guards and
   * the exact same pricing function, but writes nothing — no transaction, no
   * passengers, no seat holds.
   */
  async pricePreview(dto: PricePreviewDto) {
    const flight = await this.prisma.flight.findUnique({
      where: { id: dto.flightId },
      include: { fares: { where: { cabinClass: dto.cabinClass } } },
    });
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

    let offer: Offer | null = null;
    if (dto.offerId) {
      offer = await this.offersService.assertBookable(dto.offerId, {
        routeId: flight.routeId,
        cabinClass: dto.cabinClass,
      });
    }

    // Extras are validated and priced from the live catalog exactly as at
    // creation — an invalid selection fails the preview with EXTRAS_INVALID
    // instead of producing a misleading total.
    const pricedExtras = dto.extras?.length
      ? await this.extrasService.validateAndPrice(dto.extras, {
          currency: fare.currency,
          passengerCount: dto.passengerCount,
        })
      : { lines: [], extrasTotal: 0 };

    const pricing = priceBooking({ fare, passengerCount: dto.passengerCount, offer: offer ? toPricingSource(offer) : null });
    return {
      currency: pricing.currency,
      perPassenger: pricing.perPassenger,
      passengerCount: pricing.passengerCount,
      // Calculation order: discounted fare total first, extras added after at
      // full price (never discounted, never taxed).
      totalAmount: combineTotals(pricing.totalAmount, pricedExtras.extrasTotal),
      offer: pricing.offerSnapshot,
      extras: {
        total: pricedExtras.extrasTotal,
        lines: pricedExtras.lines.map((l) => ({
          serviceId: l.service.id,
          code: l.service.code,
          name: l.service.name,
          category: l.service.category,
          pricingUnit: l.service.pricingUnit,
          quantity: l.quantity,
          passengerIndex: l.passengerIndex,
          unitPrice: l.unitPrice,
          totalPrice: l.totalPrice,
        })),
      },
    };
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

  // ---------- Cancellation ----------

  /**
   * Server-calculated cancellation preview for the customer UI. Informational
   * only — the actual cancellation re-evaluates everything (the preview is
   * never an authorization). Computed in the payments domain where the
   * authoritative paid amounts live.
   */
  cancellationPreview(user: AuthUser, id: string) {
    return this.payments.cancellationPreviewForCustomer(user, id);
  }

  async cancelMine(user: AuthUser, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId: user.userId },
      include: {
        seatHolds: { take: 1, select: { flight: { select: { departureTime: true } } } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Approved NovaAir cancellation policy: status → departure-time → fare
    // refundability → time tiers, evaluated in that order.
    const departureTime = booking.seatHolds?.[0]?.flight.departureTime;
    if (!departureTime && (booking.status === 'PENDING' || booking.status === 'CONFIRMED')) {
      throw new ConflictException('Cancellation cannot be evaluated — flight information is missing');
    }
    const decision = evaluateCancellationPolicy({
      bookingStatus: booking.status,
      // A missing/unconfigured fare policy is treated as non-refundable:
      // automatic refunds are never issued for unknown fare types.
      refundable: resolveRefundPolicy(booking.fareRulesSnapshot)?.refundable ?? false,
      // Status gates (cancelled/completed) evaluate before any time check, so
      // the epoch fallback is never observed for them.
      departureTime: departureTime ?? new Date(0),
    });
    if (!decision.allowed) {
      throw new ConflictException(
        CANCELLATION_REJECTION_MESSAGES[decision.reason] ?? 'This booking cannot be cancelled',
      );
    }

    if (booking.status === 'CONFIRMED') {
      // Paid bookings are never cancelled directly by the customer anymore:
      // the money movement (policy-tiered refund) requires staff review via
      // the cancellation-request workflow (payments domain owns execution).
      throw new ConflictException({
        code: 'CANCELLATION_REQUEST_REQUIRED',
        message:
          'Paid bookings require a cancellation request — submit one via the cancellation-request endpoint and staff will review it',
      });
    }
    if (booking.status !== 'PENDING') {
      throw new ConflictException('This booking cannot be cancelled in its current state');
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
      throw new ConflictException('Booking was modified concurrently — reload and try again');
    }

    await this.logBookingEvent('BOOKING_CANCELLED', user, booking);
    if (released > 0) {
      await this.logBookingEvent('SEAT_HOLD_RELEASED', user, booking, { holdCount: released });
    }
    // Phase 3.2C: with the cancellation committed, close any still-open Stripe
    // PaymentIntent — post-commit, outside every transaction; no-op for mock.
    await this.payments.cancelOpenIntentsForCancelledBooking(booking.id);
    return this.findMineOne(user, id);
  }

  /**
   * Customer cancellation REQUEST for a paid (CONFIRMED) booking. Creates a
   * PENDING CancellationRequest for staff review — no cancellation and no
   * refund happen here; approval executes the policy-tiered refund in the
   * payments domain, rejection leaves everything untouched. At most one
   * PENDING request per booking is enforced by a partial unique index, so a
   * concurrent duplicate surfaces as P2002 and maps to the same 409.
   */
  async requestCancellation(user: AuthUser, id: string, dto: RequestCancellationDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId: user.userId },
      include: {
        seatHolds: { take: 1, select: { flight: { select: { departureTime: true } } } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(
        booking.status === 'PENDING'
          ? 'Unpaid bookings do not need a cancellation request — cancel the booking directly'
          : `A cancellation request is only possible for confirmed bookings (this booking is ${booking.status})`,
      );
    }

    const departureTime = booking.seatHolds?.[0]?.flight.departureTime;
    if (!departureTime) {
      throw new ConflictException('Cancellation cannot be evaluated — flight information is missing');
    }
    const decision = evaluateCancellationPolicy({
      bookingStatus: booking.status,
      // Same convention as cancelMine: an unconfigured fare policy is treated
      // as non-refundable — but still requestable (a 0% refund decision).
      refundable: resolveRefundPolicy(booking.fareRulesSnapshot)?.refundable ?? false,
      departureTime,
    });
    if (!decision.allowed) {
      throw new ConflictException(
        CANCELLATION_REJECTION_MESSAGES[decision.reason] ?? 'This booking cannot be cancelled',
      );
    }

    const pending = await this.prisma.cancellationRequest.findFirst({
      where: { bookingId: booking.id, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw this.duplicateRequestConflict();
    }

    let request: CancellationRequest;
    try {
      request = await this.prisma.cancellationRequest.create({
        data: { bookingId: booking.id, userId: user.userId, reason: dto.reason ?? null },
      });
    } catch (error) {
      // Lost a concurrent same-booking race: the partial unique index on
      // (booking_id) WHERE status = 'PENDING' admitted exactly one request.
      if (this.isDuplicateRequestConflict(error)) {
        throw this.duplicateRequestConflict();
      }
      throw error;
    }

    await this.logBookingEvent('CANCELLATION_REQUESTED', user, booking, { reason: dto.reason });
    return this.toCancellationRequestView(request);
  }

  private duplicateRequestConflict(): ConflictException {
    return new ConflictException({
      code: 'CANCELLATION_REQUEST_PENDING',
      message: 'A cancellation request for this booking is already pending review',
    });
  }

  /** P2002 from the one-pending-request-per-booking partial unique index. */
  private isDuplicateRequestConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toCancellationRequestView(request: CancellationRequest) {
    return {
      id: request.id,
      bookingId: request.bookingId,
      status: request.status,
      reason: request.reason,
      requestedAt: request.requestedAt,
    };
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

      // BR-16: validate the optional offer inside the same transaction so the
      // eligibility check and the booking write are atomic. The client sends
      // only the offer id — discount/totals are always computed server-side.
      let offer: Offer | null = null;
      if (dto.offerId) {
        offer = await this.offersService.assertBookable(
          dto.offerId,
          { routeId: flight.routeId, cabinClass: dto.cabinClass },
          tx,
        );
      }
      // Extras: validate against the live catalog INSIDE this transaction and
      // price from DB rows — a service deactivated or repriced between the
      // customer's selection and this create is rejected (EXTRAS_INVALID) or
      // repriced from current data, never taken from the request.
      const pricedExtras = dto.extras?.length
        ? await this.extrasService.validateAndPrice(dto.extras, {
            currency: fare.currency,
            passengerCount: dto.passengers.length,
          }, tx)
        : { lines: [], extrasTotal: 0 };
      const pricing = priceBooking({ fare, passengerCount: dto.passengers.length, offer: offer ? toPricingSource(offer) : null });
      const refundPolicy = refundPolicyFromFareRules(fare.fareRules);

      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId: user.userId,
          idempotencyKey: dto.idempotencyKey,
          idempotencyRequestHash: requestHash,
          status: 'PENDING',
          // Discounted fare total first, extras added after at full price.
          totalAmount: combineTotals(pricing.totalAmount, pricedExtras.extrasTotal),
          currency: pricing.currency,
          offerId: offer?.id ?? null,
          contactEmail: dto.contactEmail ?? user.email,
          contactPhone: dto.contactPhone,
          fareRulesSnapshot: {
            cabinClass: dto.cabinClass,
            // basePrice stays the ORIGINAL fare base; the offer discount is
            // carried separately as discountAmount so historical views can
            // reconstruct both.
            perPassenger: pricing.perPassenger,
            passengerCount: dto.passengers.length,
            // BR-15: capture the fare's refund policy (when configured) so
            // cancellation refunds are computed from the rules sold, not the
            // rules that happen to be configured at cancellation time.
            refundPolicy: refundPolicy
              ? { refundable: refundPolicy.refundable, cancellationFeePercent: refundPolicy.cancellationFeePercent }
              : null,
            // BR-16: historical snapshot of the applied offer — display reads
            // this, never the live Offer row.
            offer: pricing.offerSnapshot,
          },
        },
      });

      const bookingPassengerIds: string[] = [];
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
        const bookingPassenger = await tx.bookingPassenger.create({
          data: { bookingId: booking.id, passengerId: passenger.id, passengerType: p.passengerType ?? 'ADULT' },
        });
        bookingPassengerIds.push(bookingPassenger.id);
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

      // Persist extras with immutable snapshots (code/name/unit price/unit/
      // currency) so historical totals never depend on the live catalog row.
      // The (booking, service, passenger) unique index is the backstop against
      // duplicate attachment; validation already rejected duplicates above.
      for (const line of pricedExtras.lines) {
        await tx.bookingExtra.create({
          data: {
            bookingId: booking.id,
            extraServiceId: line.service.id,
            bookingPassengerId: line.passengerIndex === null ? null : bookingPassengerIds[line.passengerIndex]!,
            quantity: line.quantity,
            price: line.totalPrice,
            unitPrice: line.unitPrice,
            currency: pricing.currency,
            pricingUnit: line.service.pricingUnit,
            category: line.service.category,
            serviceCode: line.service.code,
            serviceName: line.service.name,
          },
        });
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
    const snapshot = booking.fareRulesSnapshot as {
      cabinClass?: CabinClass;
      perPassenger?: { total: number; discountAmount?: number };
      offer?: BookingPricing['offerSnapshot'];
    } | null;
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
      // BR-16: historical display reads the snapshot captured at booking time,
      // never the live Offer row (which may change or be deactivated later).
      perPassengerDiscountAmount: snapshot?.perPassenger?.discountAmount ?? null,
      offer: snapshot?.offer ?? null,
      bookedAt: booking.bookedAt,
      cancellationRequest: booking.cancellationRequests[0]
        ? {
            id: booking.cancellationRequests[0].id,
            status: booking.cancellationRequests[0].status,
            requestedAt: booking.cancellationRequests[0].requestedAt,
            rejectionReason: booking.cancellationRequests[0].rejectionReason,
          }
        : null,
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
      // Extras read their creation-time snapshots — never the live catalog.
      extras: booking.bookingExtras.map((be) => {
        const bpIndex = be.bookingPassengerId
          ? booking.bookingPassengers.findIndex((bp) => bp.id === be.bookingPassengerId)
          : -1;
        return {
          id: be.id,
          serviceId: be.extraServiceId,
          code: be.serviceCode,
          name: be.serviceName,
          category: be.category,
          pricingUnit: be.pricingUnit,
          quantity: be.quantity,
          unitPrice: Number(be.unitPrice),
          totalPrice: Number(be.price),
          currency: be.currency,
          passengerIndex: bpIndex >= 0 ? bpIndex : null,
        };
      }),
      seats: booking.seatHolds.map((h) => ({
        seatId: h.seatId,
        seatNumber: h.seat.seatNumber,
        holdStatus: h.status,
        holdExpiresAt: h.expiresAt,
      })),
    };
  }
}
