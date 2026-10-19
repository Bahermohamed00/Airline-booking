import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, DiscountType } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { SeatHoldsService } from './seat-holds.service';
import { hashCreateBookingRequest } from './booking-idempotency';
import { PaymentsService } from '../payments/payments.service';
import { OffersService } from '../offers/offers.service';
import { ExtrasService } from '../extras/extras.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const user = { userId: 'user-1', email: 'customer@example.com', roles: ['Customer'], permissions: [] };

const IDEMPOTENCY_KEY = '3f6b1d2e-7a9c-4e5b-9d8c-1a2b3c4d5e6f';

const flightFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'flight-1',
  flightNumber: 'NV100',
  routeId: 'route-1',
  aircraftId: 'aircraft-1',
  status: 'SCHEDULED',
  departureTime: new Date(Date.now() + 86_400_000),
  arrivalTime: new Date(Date.now() + 90_000_000),
  route: { id: 'route-1', originAirportId: 'fra', destinationAirportId: 'jfk' },
  fares: [{ id: 'fare-1', cabinClass: 'ECONOMY', basePrice: 421, taxAmount: 67, feeAmount: 17, currency: 'EUR' }],
  segments: [{ id: 'seg-1' }],
  ...overrides,
});

const seatFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'seat-1',
  aircraftId: 'aircraft-1',
  seatNumber: '1A',
  cabinClass: 'ECONOMY',
  ...overrides,
});

const dtoFixture = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: IDEMPOTENCY_KEY,
  flightId: 'flight-1',
  cabinClass: 'ECONOMY' as const,
  seatIds: ['seat-1'],
  passengers: [{ firstName: 'Lena', lastName: 'Hoffmann', passengerType: 'ADULT' as const, dateOfBirth: '1992-04-18' }],
  ...overrides,
});

/** Minimal booking row with relations, as BOOKING_INCLUDE would return it. */
const bookingViewFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'b-1',
  bookingReference: 'NV8K4P2',
  status: 'PENDING',
  totalAmount: 505,
  currency: 'EUR',
  contactEmail: user.email,
  contactPhone: null,
  fareRulesSnapshot: { cabinClass: 'ECONOMY', perPassenger: { total: 505 } },
  bookedAt: new Date(),
  idempotencyKey: IDEMPOTENCY_KEY,
  idempotencyRequestHash: hashCreateBookingRequest(dtoFixture() as never),
  bookingPassengers: [],
  bookingExtras: [],
  seatHolds: [],
  cancellationRequests: [],
  ...overrides,
});

const idempotencyP2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`user_id`,`idempotency_key`)', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['user_id', 'idempotency_key'] },
  });

const createMockPrisma = () => {
  const tx = {
    flight: { findUnique: vi.fn() },
    fare: {},
    seat: { findMany: vi.fn() },
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findFirst: vi.fn(), create: vi.fn() },
    bookingSeat: { findFirst: vi.fn().mockResolvedValue(null), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    booking: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    passenger: { create: vi.fn() },
    bookingPassenger: { create: vi.fn().mockResolvedValue({ id: 'bp-1' }) },
    bookingExtra: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'be-1', ...data })) },
  };
  return {
    booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    cancellationRequest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configGet: ReturnType<typeof vi.fn>;
  let payments: {
    cancelOpenIntentsForCancelledBooking: ReturnType<typeof vi.fn>;
    cancelConfirmedForCustomer: ReturnType<typeof vi.fn>;
  };
  let offers: { assertBookable: ReturnType<typeof vi.fn> };
  let extras: { validateAndPrice: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    configGet = vi.fn(() => 15);
    payments = {
      cancelOpenIntentsForCancelledBooking: vi.fn().mockResolvedValue(undefined),
      cancelConfirmedForCustomer: vi.fn().mockResolvedValue(undefined),
    };
    offers = { assertBookable: vi.fn() };
    extras = { validateAndPrice: vi.fn().mockResolvedValue({ lines: [], extrasTotal: 0 }) };
    audit = { log: vi.fn().mockResolvedValue({}) };
    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        SeatHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: PaymentsService, useValue: payments },
        { provide: OffersService, useValue: offers },
        { provide: ExtrasService, useValue: extras },
      ],
    }).compile();
    service = module.get(BookingsService);
  });

  /** Happy-path transaction mocks for a successful creation. */
  const mockCreateSuccess = () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null); // reference free
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p-1', ...data }));
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(bookingViewFixture());
  };

  const expectCreateError = async (errorClass: unknown, flight: unknown = flightFixture(), dto = dtoFixture()) => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flight);
    await expect(service.create(user, dto as never)).rejects.toBeInstanceOf(errorClass as never);
  };

  it('rejects a nonexistent flight with 404', async () => {
    await expectCreateError(NotFoundException, null);
  });

  it('rejects a cancelled flight with 409', async () => {
    await expectCreateError(ConflictException, flightFixture({ status: 'CANCELLED' }));
  });

  it('rejects an already departed flight with 409', async () => {
    await expectCreateError(ConflictException, flightFixture({ departureTime: new Date(Date.now() - 1000) }));
  });

  it('rejects a cabin the flight does not offer with 400', async () => {
    await expectCreateError(BadRequestException, flightFixture({ fares: [] }));
  });

  it('rejects duplicate seats in the request with 400', async () => {
    await expectCreateError(BadRequestException, flightFixture(), dtoFixture({ seatIds: ['seat-1', 'seat-1'] }));
  });

  it('rejects seat/passenger count mismatch with 400', async () => {
    await expectCreateError(BadRequestException, flightFixture(), dtoFixture({ seatIds: ['seat-1', 'seat-2'] }));
  });

  it('rejects seats that do not exist with 400', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([]);
    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a seat from the wrong aircraft with 400', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture({ aircraftId: 'other-aircraft' })]);
    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a seat incompatible with the requested cabin with 400', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture({ cabinClass: 'BUSINESS' })]);
    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an already held seat with 409', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue({ seat: { seatNumber: '1A' } });
    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an already assigned seat with 409', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.bookingSeat.findFirst.mockResolvedValue({ seatNumber: '1A' });
    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a PENDING booking with DB-fare totals, passengers and holds', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null); // reference free
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p-1', ...data }));
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
      id: 'b-1',
      bookingReference: 'NV8K4P2',
      status: 'PENDING',
      totalAmount: 505,
      currency: 'EUR',
      contactEmail: user.email,
      contactPhone: null,
      fareRulesSnapshot: { cabinClass: 'ECONOMY', perPassenger: { total: 505 } },
      bookedAt: new Date(),
      bookingPassengers: [{ passengerType: 'ADULT', passenger: { id: 'p-1', firstName: 'Lena', lastName: 'Hoffmann', dateOfBirth: null, nationality: null, passportNumber: null } }],
      bookingExtras: [],
      seatHolds: [
        {
          seatId: 'seat-1',
          status: 'ACTIVE',
          expiresAt: new Date(),
          seat: seatFixture(),
          flight: { ...flightFixture(), route: { originAirport: { iataCode: 'FRA' }, destinationAirport: { iataCode: 'JFK' } } },
        },
      ],
      cancellationRequests: [],
    });

    const view = await service.create(user, dtoFixture() as never);

    const createData = prisma.__tx.booking.create.mock.calls[0]![0] as { data: { status: string; totalAmount: number; bookingReference: string } };
    expect(createData.data.status).toBe('PENDING');
    expect(createData.data.totalAmount).toBe(505); // (421+67+17) × 1 — from DB fare, not client
    expect(createData.data.bookingReference).toMatch(/^NV[A-Z0-9]{6}$/);
    expect(prisma.__tx.passenger.create).toHaveBeenCalledOnce();
    expect(prisma.__tx.seatHold.create).toHaveBeenCalledOnce();
    expect(view.status).toBe('PENDING');
    expect(view.flight!.origin).toBe('FRA');
    expect(view.passengers[0]!.firstName).toBe('Lena');
    expect(view.seats[0]!.seatNumber).toBe('1A');
  });

  it('retries on a booking-reference collision and succeeds on a later attempt', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique
      .mockResolvedValueOnce({ id: 'taken' }) // first candidate collides
      .mockResolvedValueOnce(null); // second is free
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockResolvedValue({ id: 'p-1' });
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
      id: 'b-1', bookingReference: 'NV7Q9M3', status: 'PENDING', totalAmount: 505, currency: 'EUR',
      contactEmail: user.email, contactPhone: null, fareRulesSnapshot: {}, bookedAt: new Date(),
      bookingPassengers: [], bookingExtras: [], seatHolds: [], cancellationRequests: [],
    });

    await service.create(user, dtoFixture() as never);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('cancel: 404 for another user’s booking, 409 when already cancelled, 409 for completed bookings', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(service.cancelMine(user, 'b-x')).rejects.toBeInstanceOf(NotFoundException);

    prisma.booking.findFirst.mockResolvedValue({ id: 'b-1', userId: user.userId, status: 'CANCELLED' });
    await expect(service.cancelMine(user, 'b-1')).rejects.toBeInstanceOf(ConflictException);

    prisma.booking.findFirst.mockResolvedValue({ id: 'b-2', userId: user.userId, status: 'CHECKED_IN' });
    await expect(service.cancelMine(user, 'b-2')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cancel: PENDING booking is cancelled and its active holds released', async () => {
    const booking = {
      id: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: {},
      seatHolds: [{ flight: { departureTime: new Date(Date.now() + 96 * 3_600_000) } }],
    };
    prisma.booking.findFirst.mockResolvedValue(booking);
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });
    prisma.booking.findFirst.mockResolvedValueOnce(booking).mockResolvedValue({
      ...booking,
      status: 'CANCELLED',
      totalAmount: 505,
      currency: 'EUR',
      contactEmail: user.email,
      contactPhone: null,
      fareRulesSnapshot: {},
      bookedAt: new Date(),
      bookingPassengers: [],
      bookingExtras: [],
      seatHolds: [],
      cancellationRequests: [],
    });

    const view = await service.cancelMine(user, 'b-1');
    expect(view.status).toBe('CANCELLED');
    expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'b-1', status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  });

  it('cancel: closes open Stripe PaymentIntents for the cancelled booking after commit (Phase 3.2C)', async () => {
    const booking = {
      id: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: {},
      seatHolds: [{ flight: { departureTime: new Date(Date.now() + 96 * 3_600_000) } }],
    };
    prisma.booking.findFirst.mockResolvedValueOnce(booking).mockResolvedValue({
      ...booking,
      status: 'CANCELLED',
      totalAmount: 505,
      currency: 'EUR',
      contactEmail: user.email,
      contactPhone: null,
      fareRulesSnapshot: {},
      bookedAt: new Date(),
      bookingPassengers: [],
      bookingExtras: [],
      seatHolds: [],
      cancellationRequests: [],
    });

    await service.cancelMine(user, 'b-1');

    // Post-commit protection: the cancellation transaction ran, then the
    // open-intent cancellation was delegated to PaymentsService.
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(payments.cancelOpenIntentsForCancelledBooking).toHaveBeenCalledWith('b-1');
  });

  it('cancel: CONFIRMED (paid) booking now requires a cancellation request — 409 CANCELLATION_REQUEST_REQUIRED', async () => {
    const booking = {
      id: 'b-2',
      userId: user.userId,
      status: 'CONFIRMED',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: { refundPolicy: { refundable: true, cancellationFeePercent: 10 } },
      seatHolds: [{ flight: { departureTime: new Date(Date.now() + 200 * 3_600_000) } }],
    };
    prisma.booking.findFirst.mockResolvedValue(booking);

    const error = await service.cancelMine(user, 'b-2').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'CANCELLATION_REQUEST_REQUIRED',
    });
    // No cancellation and no refund happen without staff review.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(payments.cancelConfirmedForCustomer).not.toHaveBeenCalled();
  });

  it('cancel: rejects cancellation after the scheduled departure (AFTER_DEPARTURE)', async () => {
    const booking = {
      id: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: {},
      seatHolds: [{ flight: { departureTime: new Date(Date.now() - 60_000) } }],
    };
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(service.cancelMine(user, 'b-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(payments.cancelConfirmedForCustomer).not.toHaveBeenCalled();
  });

  // ---------- Customer cancellation requests ----------

  const confirmedBookingFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'b-1',
    userId: user.userId,
    status: 'CONFIRMED',
    bookingReference: 'NV8K4P2',
    fareRulesSnapshot: { refundPolicy: { refundable: true, cancellationFeePercent: 10 } },
    seatHolds: [{ flight: { departureTime: new Date(Date.now() + 200 * 3_600_000) } }],
    ...overrides,
  });

  it('requestCancellation: creates a PENDING request, audits it and returns the view', async () => {
    prisma.booking.findFirst.mockResolvedValue(confirmedBookingFixture());
    const created = {
      id: 'cr-1',
      bookingId: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      reason: 'Plans changed',
      requestedAt: new Date(),
    };
    prisma.cancellationRequest.create.mockResolvedValue(created);

    const view = await service.requestCancellation(user, 'b-1', { reason: 'Plans changed' });

    expect(view).toEqual({
      id: 'cr-1',
      bookingId: 'b-1',
      status: 'PENDING',
      reason: 'Plans changed',
      requestedAt: created.requestedAt,
    });
    expect(prisma.cancellationRequest.create).toHaveBeenCalledWith({
      data: { bookingId: 'b-1', userId: user.userId, reason: 'Plans changed' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANCELLATION_REQUESTED', actorType: 'User', targetId: 'b-1' }),
    );
  });

  it('requestCancellation: 404 for a booking the customer does not own', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(service.requestCancellation(user, 'b-x', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.cancellationRequest.create).not.toHaveBeenCalled();
  });

  it('requestCancellation: 409 for a PENDING booking — unpaid bookings cancel directly', async () => {
    prisma.booking.findFirst.mockResolvedValue(confirmedBookingFixture({ status: 'PENDING' }));
    await expect(service.requestCancellation(user, 'b-1', {})).rejects.toThrow(/cancel the booking directly/);
    expect(prisma.cancellationRequest.create).not.toHaveBeenCalled();
  });

  it('requestCancellation: 409 for a non-CONFIRMED completed booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(confirmedBookingFixture({ status: 'CHECKED_IN' }));
    await expect(service.requestCancellation(user, 'b-1', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('requestCancellation: 409 when the policy no longer allows cancellation (departed)', async () => {
    prisma.booking.findFirst.mockResolvedValue(
      confirmedBookingFixture({ seatHolds: [{ flight: { departureTime: new Date(Date.now() - 60_000) } }] }),
    );
    await expect(service.requestCancellation(user, 'b-1', {})).rejects.toThrow(/departure time has passed/);
    expect(prisma.cancellationRequest.create).not.toHaveBeenCalled();
  });

  it('requestCancellation: 409 CANCELLATION_REQUEST_PENDING when a request is already pending', async () => {
    prisma.booking.findFirst.mockResolvedValue(confirmedBookingFixture());
    prisma.cancellationRequest.findFirst.mockResolvedValue({ id: 'cr-existing' });

    const error = await service.requestCancellation(user, 'b-1', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'CANCELLATION_REQUEST_PENDING' });
    expect(prisma.cancellationRequest.create).not.toHaveBeenCalled();
  });

  it('requestCancellation: a lost unique-index race (P2002) maps to the same 409', async () => {
    prisma.booking.findFirst.mockResolvedValue(confirmedBookingFixture());
    prisma.cancellationRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['booking_id'] },
      }),
    );

    const error = await service.requestCancellation(user, 'b-1', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'CANCELLATION_REQUEST_PENDING' });
  });

  it('view: the latest cancellation request summary is exposed on the booking view', async () => {
    const requestedAt = new Date();
    prisma.booking.findFirst.mockResolvedValue(
      bookingViewFixture({
        cancellationRequests: [{ id: 'cr-1', status: 'REJECTED', requestedAt, rejectionReason: 'Fare rules' }],
      }),
    );

    const view = await service.findMineOne(user, 'b-1');
    expect(view.cancellationRequest).toEqual({
      id: 'cr-1',
      status: 'REJECTED',
      requestedAt,
      rejectionReason: 'Fare rules',
    });
  });

  // ---------- BR-16: bookable offers ----------

  const OFFER_ID = 'b2f6a6c0-3f8d-4a0e-9d1c-7c2f0a1b2c3d';
  const offerRow = (overrides: Record<string, unknown> = {}) => ({
    id: OFFER_ID,
    title: 'Spring Sale',
    discountType: DiscountType.PERCENT,
    discountValue: new Prisma.Decimal('10.00'),
    ...overrides,
  });

  it('offer: a valid offer discounts the fare base only, persists the snapshot and sets offerId', async () => {
    mockCreateSuccess();
    offers.assertBookable.mockResolvedValue(offerRow());

    await service.create(user, dtoFixture({ offerId: OFFER_ID }) as never);

    expect(offers.assertBookable).toHaveBeenCalledWith(
      OFFER_ID,
      { routeId: 'route-1', cabinClass: 'ECONOMY' },
      prisma.__tx,
    );
    const data = prisma.__tx.booking.create.mock.calls[0]![0].data as {
      totalAmount: number;
      currency: string;
      offerId: string | null;
      fareRulesSnapshot: Record<string, unknown>;
    };
    // 10% of 421.00 = 42.10 off the base → (421 − 42.10 + 67 + 17) × 1
    expect(data.totalAmount).toBe(462.9);
    expect(data.currency).toBe('EUR');
    expect(data.offerId).toBe(OFFER_ID);
    expect(data.fareRulesSnapshot).toMatchObject({
      cabinClass: 'ECONOMY',
      perPassenger: { basePrice: 421, discountAmount: 42.1, taxAmount: 67, feeAmount: 17, total: 462.9 },
      passengerCount: 1,
      offer: {
        id: OFFER_ID,
        title: 'Spring Sale',
        discountType: 'PERCENT',
        discountValue: 10,
        discountAmountPerPassenger: 42.1,
        currency: 'EUR',
      },
    });
  });

  it('offer: a FIXED_AMOUNT offer is applied in exact cents', async () => {
    mockCreateSuccess();
    offers.assertBookable.mockResolvedValue(
      offerRow({ discountType: DiscountType.FIXED_AMOUNT, discountValue: new Prisma.Decimal('50.00') }),
    );

    await service.create(user, dtoFixture({ offerId: OFFER_ID }) as never);

    const data = prisma.__tx.booking.create.mock.calls[0]![0].data as { totalAmount: number };
    expect(data.totalAmount).toBe(455); // 421 − 50 + 67 + 17
  });

  it('offer: OFFER_NOT_FOUND (404) from assertBookable propagates and nothing is created', async () => {
    mockCreateSuccess();
    offers.assertBookable.mockRejectedValue(new NotFoundException({ code: 'OFFER_NOT_FOUND' }));

    await expect(service.create(user, dtoFixture({ offerId: OFFER_ID }) as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();
  });

  it('offer: OFFER_NOT_AVAILABLE (409) from assertBookable propagates and nothing is created', async () => {
    mockCreateSuccess();
    offers.assertBookable.mockRejectedValue(new ConflictException({ code: 'OFFER_NOT_AVAILABLE' }));

    await expect(service.create(user, dtoFixture({ offerId: OFFER_ID }) as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();
  });

  it('offer: a discount that zeroes the payable total is rejected with OFFER_TOTAL_NOT_PAYABLE', async () => {
    mockCreateSuccess();
    offers.assertBookable.mockResolvedValue(
      offerRow({ discountType: DiscountType.FIXED_AMOUNT, discountValue: new Prisma.Decimal('505.00') }),
    );

    try {
      await service.create(user, dtoFixture({ offerId: OFFER_ID }) as never);
      expect.unreachable('expected create to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'OFFER_TOTAL_NOT_PAYABLE' });
    }
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();
  });

  it('offer: bookings without an offer never consult the offers service and are unchanged', async () => {
    mockCreateSuccess();

    await service.create(user, dtoFixture() as never);

    expect(offers.assertBookable).not.toHaveBeenCalled();
    const data = prisma.__tx.booking.create.mock.calls[0]![0].data as {
      totalAmount: number;
      offerId: string | null;
      fareRulesSnapshot: { perPassenger: { discountAmount: number }; offer: unknown };
    };
    expect(data.totalAmount).toBe(505);
    expect(data.offerId).toBeNull();
    expect(data.fareRulesSnapshot.perPassenger.discountAmount).toBe(0);
    expect(data.fareRulesSnapshot.offer).toBeNull();
  });

  it('offer idempotency: same key + same offer replays; same key + different offer conflicts', async () => {
    const replayDto = dtoFixture({ offerId: OFFER_ID });
    prisma.booking.findUnique.mockResolvedValue(
      bookingViewFixture({ idempotencyRequestHash: hashCreateBookingRequest(replayDto as never) }),
    );

    const view = await service.create(user, replayDto as never);
    expect(view.bookingReference).toBe('NV8K4P2');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await expect(
      service.create(user, dtoFixture({ offerId: 'c3a7b7d1-4a9e-5b1f-8e2d-8d3a1b2c3d4e' }) as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('view: the historical offer snapshot and per-passenger discount come from fareRulesSnapshot', async () => {
    const snapshotOffer = {
      id: OFFER_ID,
      title: 'Spring Sale',
      discountType: 'PERCENT',
      discountValue: 10,
      discountAmountPerPassenger: 42.1,
      currency: 'EUR',
    };
    prisma.booking.findFirst.mockResolvedValue(
      bookingViewFixture({
        fareRulesSnapshot: {
          cabinClass: 'ECONOMY',
          perPassenger: { basePrice: 421, discountAmount: 42.1, taxAmount: 67, feeAmount: 17, total: 462.9 },
          passengerCount: 1,
          offer: snapshotOffer,
        },
      }),
    );

    const view = await service.findMineOne(user, 'b-1');

    expect(view.offer).toEqual(snapshotOffer);
    expect(view.perPassengerDiscountAmount).toBe(42.1);
    expect(view.perPassengerTotal).toBe(462.9);
  });

  it('view: a booking without an offer exposes null offer and null discount', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingViewFixture());

    const view = await service.findMineOne(user, 'b-1');

    expect(view.offer).toBeNull();
    expect(view.perPassengerDiscountAmount).toBeNull();
  });

  // ---------- BR-16: price preview ----------

  it('pricePreview: returns server-computed totals without touching seats, passengers or bookings', async () => {
    prisma.flight = { findUnique: vi.fn().mockResolvedValue(flightFixture()) } as never;

    const preview = await service.pricePreview({ flightId: 'flight-1', cabinClass: 'ECONOMY', passengerCount: 2 } as never);

    expect(preview).toEqual({
      currency: 'EUR',
      perPassenger: { basePrice: 421, discountAmount: 0, taxAmount: 67, feeAmount: 17, total: 505 },
      passengerCount: 2,
      totalAmount: 1010,
      offer: null,
      extras: { total: 0, lines: [] },
    });
    expect(offers.assertBookable).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.__tx.seatHold.create).not.toHaveBeenCalled();
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();
  });

  it('pricePreview: applies a valid offer to the base only', async () => {
    prisma.flight = { findUnique: vi.fn().mockResolvedValue(flightFixture()) } as never;
    offers.assertBookable.mockResolvedValue(offerRow());

    const preview = await service.pricePreview({
      flightId: 'flight-1',
      cabinClass: 'ECONOMY',
      passengerCount: 2,
      offerId: OFFER_ID,
    } as never);

    expect(offers.assertBookable).toHaveBeenCalledWith(OFFER_ID, { routeId: 'route-1', cabinClass: 'ECONOMY' });
    expect(preview.perPassenger.total).toBe(462.9);
    expect(preview.totalAmount).toBe(925.8);
    expect(preview.offer).toMatchObject({ id: OFFER_ID, discountAmountPerPassenger: 42.1 });
  });

  it('pricePreview: mirrors creation guards — 404 unknown flight, 409 cancelled/departed, 400 unoffered cabin', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    prisma.flight = { findUnique } as never;
    await expect(
      service.pricePreview({ flightId: 'flight-x', cabinClass: 'ECONOMY', passengerCount: 1 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    findUnique.mockResolvedValue(flightFixture({ status: 'CANCELLED' }));
    await expect(
      service.pricePreview({ flightId: 'flight-1', cabinClass: 'ECONOMY', passengerCount: 1 } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    findUnique.mockResolvedValue(flightFixture({ departureTime: new Date(Date.now() - 1000) }));
    await expect(
      service.pricePreview({ flightId: 'flight-1', cabinClass: 'ECONOMY', passengerCount: 1 } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    findUnique.mockResolvedValue(flightFixture({ fares: [] }));
    await expect(
      service.pricePreview({ flightId: 'flight-1', cabinClass: 'BUSINESS', passengerCount: 1 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(offers.assertBookable).not.toHaveBeenCalled();
  });

  it('pricePreview: an unavailable offer is rejected with 409', async () => {
    prisma.flight = { findUnique: vi.fn().mockResolvedValue(flightFixture()) } as never;
    offers.assertBookable.mockRejectedValue(new ConflictException({ code: 'OFFER_NOT_AVAILABLE' }));

    await expect(
      service.pricePreview({ flightId: 'flight-1', cabinClass: 'ECONOMY', passengerCount: 1, offerId: OFFER_ID } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ---------- Idempotency ----------

  it('idempotency: creation persists the key and request hash on the booking row', async () => {
    mockCreateSuccess();
    await service.create(user, dtoFixture() as never);
    const data = prisma.__tx.booking.create.mock.calls[0]![0].data as {
      idempotencyKey: string;
      idempotencyRequestHash: string;
    };
    expect(data.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(data.idempotencyRequestHash).toBe(hashCreateBookingRequest(dtoFixture() as never));
  });

  it('idempotency: same key + same user + same request replays the original booking without creating', async () => {
    prisma.booking.findUnique.mockResolvedValue(bookingViewFixture());

    const view = await service.create(user, dtoFixture() as never);

    expect(view.bookingReference).toBe('NV8K4P2');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();
  });

  it('idempotency: same key + materially different request is rejected with 409', async () => {
    prisma.booking.findUnique.mockResolvedValue(bookingViewFixture({ idempotencyRequestHash: 'different-hash' }));

    await expect(service.create(user, dtoFixture({ seatIds: ['seat-2'] }) as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('idempotency: a different customer reusing the key never sees the original booking', async () => {
    const other = { ...user, userId: 'user-2' };
    mockCreateSuccess();

    await service.create(other, dtoFixture() as never);

    // The lookup is scoped to the authenticated user — the first customer's
    // booking is never matched, and this customer gets their own booking.
    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_idempotencyKey: { userId: 'user-2', idempotencyKey: IDEMPOTENCY_KEY } },
      }),
    );
    expect(prisma.__tx.booking.create).toHaveBeenCalledOnce();
  });

  it('idempotency: a concurrent same-key create loses the unique-index race and replays the winner', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(null) // pre-check: nothing committed yet
      .mockResolvedValueOnce(bookingViewFixture()); // the winner has committed
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null); // reference free
    prisma.__tx.booking.create.mockRejectedValue(idempotencyP2002());

    const view = await service.create(user, dtoFixture() as never);

    expect(view.bookingReference).toBe('NV8K4P2');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.booking.create).toHaveBeenCalledTimes(1);
  });

  it('idempotency: a concurrent same-key create with a different request conflicts', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(bookingViewFixture({ idempotencyRequestHash: 'other-hash' }));
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null);
    prisma.__tx.booking.create.mockRejectedValue(idempotencyP2002());

    await expect(service.create(user, dtoFixture({ seatIds: ['seat-2'] }) as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('idempotency: a failed attempt does not consume the key — the same key can be retried', async () => {
    // First attempt fails because the seat is held by someone else.
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValueOnce({ seat: { seatNumber: '1A' } });
    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();

    // Retry with the SAME key succeeds after the seat frees up.
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null);
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockResolvedValue({ id: 'p-1' });
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(bookingViewFixture());

    const view = await service.create(user, dtoFixture() as never);
    expect(view.status).toBe('PENDING');
    expect(prisma.__tx.booking.create).toHaveBeenCalledTimes(1);
  });

  // ---------- Cancellation race ----------

  it('cancel: the transition is an atomic CAS on id + owner + PENDING and releases seats + holds', async () => {
    const booking = {
      id: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: {},
      seatHolds: [{ flight: { departureTime: new Date(Date.now() + 96 * 3_600_000) } }],
    };
    prisma.booking.findFirst.mockResolvedValueOnce(booking).mockResolvedValue(bookingViewFixture({ status: 'CANCELLED' }));
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });

    await service.cancelMine(user, 'b-1');

    expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b-1', userId: user.userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(prisma.__tx.bookingSeat.deleteMany).toHaveBeenCalledWith({
      where: { bookingPassenger: { bookingId: 'b-1' } },
    });
  });

  it('cancel: losing the race to payment confirmation conflicts and changes nothing', async () => {
    const booking = {
      id: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: {},
      seatHolds: [{ flight: { departureTime: new Date(Date.now() + 96 * 3_600_000) } }],
    };
    prisma.booking.findFirst
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce({ status: 'CONFIRMED' }); // post-CAS re-read
    prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 }); // payment CAS won

    await expect(service.cancelMine(user, 'b-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.__tx.seatHold.updateMany).not.toHaveBeenCalled();
    expect(prisma.__tx.bookingSeat.deleteMany).not.toHaveBeenCalled();
  });

  it('cancel: losing the race to a concurrent cancellation reports already cancelled', async () => {
    const booking = {
      id: 'b-1',
      userId: user.userId,
      status: 'PENDING',
      bookingReference: 'NV8K4P2',
      fareRulesSnapshot: {},
      seatHolds: [{ flight: { departureTime: new Date(Date.now() + 96 * 3_600_000) } }],
    };
    prisma.booking.findFirst.mockResolvedValueOnce(booking).mockResolvedValueOnce({ status: 'CANCELLED' });
    prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancelMine(user, 'b-1')).rejects.toThrow(/already cancelled/);
    expect(prisma.__tx.seatHold.updateMany).not.toHaveBeenCalled();
  });

  // ---------- Multi-segment ----------

  it('multi-segment: seat conflicts are checked across ALL segments, not only segment 1', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture({ segments: [{ id: 'seg-1' }, { id: 'seg-2' }] }));
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.bookingSeat.findFirst.mockResolvedValue({ seatNumber: '1A' }); // conflict on segment 2

    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.__tx.bookingSeat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ flightSegmentId: { in: ['seg-1', 'seg-2'] } }) }),
    );
  });

  it('multi-segment: a valid booking across multiple segments passes validation', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture({ segments: [{ id: 'seg-1' }, { id: 'seg-2' }] }));
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null);
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockResolvedValue({ id: 'p-1' });
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(bookingViewFixture());

    const view = await service.create(user, dtoFixture() as never);
    expect(view.status).toBe('PENDING');
  });

  it('rejects a flight with no segments — it could never be confirmed', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture({ segments: [] }));

    await expect(service.create(user, dtoFixture() as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.__tx.seat.findMany).not.toHaveBeenCalled();
  });

  // ---------- Seat-hold configuration ----------

  it('config: an invalid SEAT_HOLD_MINUTES still produces a finite positive hold expiry', async () => {
    configGet.mockReturnValue('not-a-number');
    mockCreateSuccess();

    await service.create(user, dtoFixture() as never);

    const expiresAt = prisma.__tx.seatHold.create.mock.calls[0]![0].data.expiresAt as Date;
    expect(Number.isFinite(expiresAt.getTime())).toBe(true);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    // Falls back to the 15-minute default.
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000 + 1000);
  });
  // ---------- Extras ----------

  it('extras: validates selections via the extras service inside the transaction and persists snapshot lines', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null);
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p-1', ...data }));
    const serviceRow = {
      id: 'svc-bag', code: 'BAG_23KG', name: 'Extra checked bag (23 kg)',
      category: 'BAGGAGE', pricingUnit: 'PER_ITEM', price: 65, currency: 'EUR',
    };
    extras.validateAndPrice.mockResolvedValue({
      lines: [{ service: serviceRow, quantity: 2, passengerIndex: 0, unitPrice: 65, totalPrice: 130 }],
      extrasTotal: 130,
    });
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(bookingViewFixture({
      totalAmount: 635,
      bookingPassengers: [{ id: 'bp-1', passengerType: 'ADULT', passenger: { id: 'p-1', firstName: 'Lena', lastName: 'Hoffmann', dateOfBirth: null, nationality: null, passportNumber: null } }],
      bookingExtras: [{
        id: 'be-1', bookingId: 'b-1', extraServiceId: 'svc-bag', bookingPassengerId: 'bp-1',
        quantity: 2, price: 130, unitPrice: 65, currency: 'EUR', pricingUnit: 'PER_ITEM',
        category: 'BAGGAGE', serviceCode: 'BAG_23KG', serviceName: 'Extra checked bag (23 kg)',
      }],
    }));

    const dto = dtoFixture({ extras: [{ serviceId: 'svc-bag', quantity: 2, passengerIndex: 0 }] });
    const view = await service.create(user, dto as never);

    // Validation ran inside the transaction against the fare currency/pax count.
    expect(extras.validateAndPrice).toHaveBeenCalledWith(
      [{ serviceId: 'svc-bag', quantity: 2, passengerIndex: 0 }],
      { currency: 'EUR', passengerCount: 1 },
      expect.anything(),
    );
    // totalAmount = fare 505 + extras 130 — never client input.
    const createData = prisma.__tx.booking.create.mock.calls[0]![0] as { data: { totalAmount: number } };
    expect(createData.data.totalAmount).toBe(635);
    // Line persisted with immutable snapshots and the passenger association.
    expect(prisma.__tx.bookingExtra.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'b-1',
        extraServiceId: 'svc-bag',
        bookingPassengerId: 'bp-1',
        quantity: 2,
        price: 130,
        unitPrice: 65,
        currency: 'EUR',
        pricingUnit: 'PER_ITEM',
        category: 'BAGGAGE',
        serviceCode: 'BAG_23KG',
        serviceName: 'Extra checked bag (23 kg)',
      }),
    });
    // The view exposes snapshot lines with the passenger index resolved.
    expect(view.extras).toEqual([
      expect.objectContaining({ code: 'BAG_23KG', quantity: 2, unitPrice: 65, totalPrice: 130, passengerIndex: 0 }),
    ]);
  });

  it('extras: an EXTRAS_INVALID rejection aborts creation — nothing is persisted', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null);
    extras.validateAndPrice.mockRejectedValue(
      new BadRequestException({ code: 'EXTRAS_INVALID', message: 'unavailable', issues: [] }),
    );

    await expect(
      service.create(user, dtoFixture({ extras: [{ serviceId: 'svc-gone', quantity: 1 }] }) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.__tx.booking.create).not.toHaveBeenCalled();
    expect(prisma.__tx.bookingExtra.create).not.toHaveBeenCalled();
  });

  it('extras: the extras service is not consulted when nothing is selected', async () => {
    prisma.__tx.flight.findUnique.mockResolvedValue(flightFixture());
    prisma.__tx.seat.findMany.mockResolvedValue([seatFixture()]);
    prisma.__tx.seatHold.findFirst.mockResolvedValue(null);
    prisma.__tx.booking.findUnique.mockResolvedValue(null);
    prisma.__tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    prisma.__tx.passenger.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p-1', ...data }));
    prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(bookingViewFixture());

    await service.create(user, dtoFixture() as never);
    expect(extras.validateAndPrice).not.toHaveBeenCalled();
    const createData = prisma.__tx.booking.create.mock.calls[0]![0] as { data: { totalAmount: number } };
    expect(createData.data.totalAmount).toBe(505);
  });

  it('pricePreview: extras are validated and priced server-side and included in the total', async () => {
    prisma.flight = { findUnique: vi.fn().mockResolvedValue(flightFixture()) } as never;
    extras.validateAndPrice.mockResolvedValue({
      lines: [{
        service: { id: 'svc-meal', code: 'MEAL_HOT', name: 'Hot meal', category: 'MEAL', pricingUnit: 'PER_ITEM' },
        quantity: 2, passengerIndex: 1, unitPrice: 12.5, totalPrice: 25,
      }],
      extrasTotal: 25,
    });

    const preview = await service.pricePreview({
      flightId: 'flight-1', cabinClass: 'ECONOMY', passengerCount: 2,
      extras: [{ serviceId: 'svc-meal', quantity: 2, passengerIndex: 1 }],
    } as never);

    expect(extras.validateAndPrice).toHaveBeenCalledWith(
      [{ serviceId: 'svc-meal', quantity: 2, passengerIndex: 1 }],
      { currency: 'EUR', passengerCount: 2 },
    );
    expect(preview.totalAmount).toBe(1035); // 1010 fare + 25 extras
    expect(preview.extras.total).toBe(25);
    expect(preview.extras.lines[0]).toMatchObject({ code: 'MEAL_HOT', quantity: 2, unitPrice: 12.5, totalPrice: 25, passengerIndex: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('pricePreview: an invalid extras selection fails the preview with EXTRAS_INVALID', async () => {
    prisma.flight = { findUnique: vi.fn().mockResolvedValue(flightFixture()) } as never;
    extras.validateAndPrice.mockRejectedValue(
      new BadRequestException({ code: 'EXTRAS_INVALID', message: 'unavailable', issues: [] }),
    );
    await expect(
      service.pricePreview({
        flightId: 'flight-1', cabinClass: 'ECONOMY', passengerCount: 1,
        extras: [{ serviceId: 'svc-gone', quantity: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

});

describe('SeatHoldsService', () => {
  const createSweepPrisma = () => {
    const tx = {
      seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      booking: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    return { $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)), __tx: tx };
  };

  const createSweepService = async (prisma: ReturnType<typeof createSweepPrisma>, audit: { log: ReturnType<typeof vi.fn> }) => {
    const module = await Test.createTestingModule({
      providers: [
        SeatHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        {
          provide: PaymentsService,
          useValue: { cancelOpenIntentsForCancelledBooking: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    return module.get(SeatHoldsService);
  };

  it('expires only stale ACTIVE holds and is safe to run repeatedly', async () => {
    const prisma = createSweepPrisma();
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 2 });
    const service = await createSweepService(prisma, { log: vi.fn() });

    expect(await service.expireStaleHolds()).toBe(2);
    expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', expiresAt: { lt: expect.any(Date) } },
      data: { status: 'EXPIRED' },
    });

    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.expireStaleHolds()).toBe(0);
  });

  it('cancels a PENDING booking left without ACTIVE holds and audits a system cancellation', async () => {
    const prisma = createSweepPrisma();
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });
    prisma.__tx.booking.findMany.mockResolvedValue([{ id: 'b-1', bookingReference: 'NV8K4P2' }]);
    prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
    const audit = { log: vi.fn() };
    const service = await createSweepService(prisma, audit);

    expect(await service.expireStaleHolds()).toBe(1);
    expect(prisma.__tx.booking.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', seatHolds: { none: { status: 'ACTIVE' } } },
      select: { id: true, bookingReference: true },
    });
    expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b-1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'System',
        action: 'BOOKING_CANCELLED',
        targetType: 'Booking',
        targetId: 'b-1',
        bookingId: 'b-1',
        metadata: expect.objectContaining({ bookingReference: 'NV8K4P2' }),
      }),
    );
  });

  it('does not cancel bookings that still have an ACTIVE hold', async () => {
    const prisma = createSweepPrisma();
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });
    // The none-ACTIVE filter excludes them, so no cancellation candidates exist.
    prisma.__tx.booking.findMany.mockResolvedValue([]);
    const audit = { log: vi.fn() };
    const service = await createSweepService(prisma, audit);

    expect(await service.expireStaleHolds()).toBe(1);
    expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1); // SEAT_HOLD_EXPIRED only
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SEAT_HOLD_EXPIRED' }));
  });

  it('skips the cancellation audit when the compare-and-set loses a concurrent race', async () => {
    const prisma = createSweepPrisma();
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });
    prisma.__tx.booking.findMany.mockResolvedValue([{ id: 'b-1', bookingReference: 'NV8K4P2' }]);
    prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 }); // confirmed/cancelled concurrently
    const audit = { log: vi.fn() };
    const service = await createSweepService(prisma, audit);

    expect(await service.expireStaleHolds()).toBe(1);
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'BOOKING_CANCELLED' }));
  });

  it('closes open Stripe PaymentIntents for auto-cancelled bookings after the sweep transaction commits (Phase 3.2C)', async () => {
    const prisma = createSweepPrisma();
    prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });
    prisma.__tx.booking.findMany.mockResolvedValue([{ id: 'b-1', bookingReference: 'NV8K4P2' }]);
    prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
    const payments = { cancelOpenIntentsForCancelledBooking: vi.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        SeatHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: PaymentsService, useValue: payments },
      ],
    }).compile();
    const service = module.get(SeatHoldsService);

    expect(await service.expireStaleHolds()).toBe(1);

    // The protection ran once per auto-cancelled booking — and only ever
    // after the expiry transaction (Stripe I/O never happens inside it).
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(payments.cancelOpenIntentsForCancelledBooking).toHaveBeenCalledTimes(1);
    expect(payments.cancelOpenIntentsForCancelledBooking).toHaveBeenCalledWith('b-1');
  });

});
