import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { SeatHoldsService } from './seat-holds.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const user = { userId: 'user-1', email: 'customer@example.com', roles: ['Customer'], permissions: [] };

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
  flightId: 'flight-1',
  cabinClass: 'ECONOMY' as const,
  seatIds: ['seat-1'],
  passengers: [{ firstName: 'Lena', lastName: 'Hoffmann', passengerType: 'ADULT' as const, dateOfBirth: '1992-04-18' }],
  ...overrides,
});

const createMockPrisma = () => {
  const tx = {
    flight: { findUnique: vi.fn() },
    fare: {},
    seat: { findMany: vi.fn() },
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findFirst: vi.fn(), create: vi.fn() },
    bookingSeat: { findFirst: vi.fn().mockResolvedValue(null) },
    booking: { findUnique: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    passenger: { create: vi.fn() },
    bookingPassenger: { create: vi.fn() },
  };
  return {
    booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        SeatHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: ConfigService, useValue: { get: vi.fn(() => 15) } },
      ],
    }).compile();
    service = module.get(BookingsService);
  });

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
});

describe('SeatHoldsService', () => {
  it('expires only stale ACTIVE holds and is safe to run repeatedly', async () => {
    const prisma = { seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    const module = await Test.createTestingModule({
      providers: [
        SeatHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();
    const service = module.get(SeatHoldsService);

    expect(await service.expireStaleHolds()).toBe(2);
    expect(prisma.seatHold.updateMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', expiresAt: { lt: expect.any(Date) } },
      data: { status: 'EXPIRED' },
    });

    prisma.seatHold.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.expireStaleHolds()).toBe(0);
  });
});
