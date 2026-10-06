import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { SeatHoldsService } from './seat-holds.service';
import { hashCreateBookingRequest } from './booking-idempotency';
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
  seatHolds: [],
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
    bookingPassenger: { create: vi.fn() },
  };
  return {
    booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    configGet = vi.fn(() => 15);
    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        SeatHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: ConfigService, useValue: { get: configGet } },
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
      seatHolds: [
        {
          seatId: 'seat-1',
          status: 'ACTIVE',
          expiresAt: new Date(),
          seat: seatFixture(),
          flight: { ...flightFixture(), route: { originAirport: { iataCode: 'FRA' }, destinationAirport: { iataCode: 'JFK' } } },
        },
      ],
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
      bookingPassengers: [], seatHolds: [],
    });

    await service.create(user, dtoFixture() as never);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('cancel: 404 for another user’s booking, 409 when already cancelled, 409 when not PENDING', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(service.cancelMine(user, 'b-x')).rejects.toBeInstanceOf(NotFoundException);

    prisma.booking.findFirst.mockResolvedValue({ id: 'b-1', userId: user.userId, status: 'CANCELLED' });
    await expect(service.cancelMine(user, 'b-1')).rejects.toBeInstanceOf(ConflictException);

    prisma.booking.findFirst.mockResolvedValue({ id: 'b-2', userId: user.userId, status: 'CONFIRMED' });
    await expect(service.cancelMine(user, 'b-2')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cancel: PENDING booking is cancelled and its active holds released', async () => {
    const booking = { id: 'b-1', userId: user.userId, status: 'PENDING', bookingReference: 'NV8K4P2' };
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
      seatHolds: [],
    });

    const view = await service.cancelMine(user, 'b-1');
    expect(view.status).toBe('CANCELLED');
    expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'b-1', status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
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
    const booking = { id: 'b-1', userId: user.userId, status: 'PENDING', bookingReference: 'NV8K4P2' };
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
    const booking = { id: 'b-1', userId: user.userId, status: 'PENDING', bookingReference: 'NV8K4P2' };
    prisma.booking.findFirst
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce({ status: 'CONFIRMED' }); // post-CAS re-read
    prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 }); // payment CAS won

    await expect(service.cancelMine(user, 'b-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.__tx.seatHold.updateMany).not.toHaveBeenCalled();
    expect(prisma.__tx.bookingSeat.deleteMany).not.toHaveBeenCalled();
  });

  it('cancel: losing the race to a concurrent cancellation reports already cancelled', async () => {
    const booking = { id: 'b-1', userId: user.userId, status: 'PENDING', bookingReference: 'NV8K4P2' };
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
      providers: [SeatHoldsService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }],
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
});
