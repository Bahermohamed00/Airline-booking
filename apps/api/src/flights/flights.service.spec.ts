import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FlightsService } from './flights.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const createMockEvents = () => ({ publish: vi.fn().mockResolvedValue(undefined) });

const createMockPrisma = () => {
  const tx = {
    flightSegment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
    flight: { update: vi.fn(), create: vi.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'new-f1', ...(data as object) })) },
    fare: { create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    flight: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    route: { findUnique: vi.fn(), count: vi.fn() },
    aircraft: { findUnique: vi.fn(), count: vi.fn() },
    airport: { count: vi.fn() },
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    bookingSeat: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    seatHold: { findMany: vi.fn() },
    scheduleRule: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
    __tx: tx,
  };
};

const actor = { userId: 'staff-1' } as unknown as AuthUser;

/** Minimal FlightWithRelations shape accepted by toFlightView. */
const flightWithRelations = (status: string) => ({
  id: 'f1',
  flightNumber: 'NV100',
  publicNumber: 50,
  tripType: 'ONE_WAY',
  status,
  route: {
    originAirport: { id: 'a1', iataCode: 'FRA', latitude: null, longitude: null },
    destinationAirport: { id: 'a2', iataCode: 'JFK', latitude: null, longitude: null },
  },
  aircraft: { id: 'ac1' },
  fares: [],
});

describe('FlightsService.getSeatAvailability', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('404s for an unknown flight without querying seats', async () => {
    prisma.flight.findUnique.mockResolvedValue(null);
    await expect(service.getSeatAvailability('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.bookingSeat.findMany).not.toHaveBeenCalled();
    expect(prisma.seatHold.findMany).not.toHaveBeenCalled();
  });

  it('excludes cancelled bookings from occupied seats', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.bookingSeat.findMany.mockResolvedValue([]);
    prisma.seatHold.findMany.mockResolvedValue([]);
    await service.getSeatAvailability('f1');
    const where = prisma.bookingSeat.findMany.mock.calls[0]![0]!.where!;
    expect(where.flightSegment).toEqual({ flightId: 'f1' });
    expect(where.bookingPassenger.booking.status).toEqual({ not: 'CANCELLED' });
  });

  it('excludes expired and non-active holds from held seats', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.bookingSeat.findMany.mockResolvedValue([]);
    prisma.seatHold.findMany.mockResolvedValue([]);
    await service.getSeatAvailability('f1');
    const where = prisma.seatHold.findMany.mock.calls[0]![0]!.where!;
    expect(where.flightId).toBe('f1');
    expect(where.status).toBe('ACTIVE');
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it('returns occupied and held seat id lists', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.bookingSeat.findMany.mockResolvedValue([
      { seatId: 's1' },
      { seatId: 's2' },
    ]);
    prisma.seatHold.findMany.mockResolvedValue([{ seatId: 's3' }]);
    const view = await service.getSeatAvailability('f1');
    expect(view).toEqual({
      flightId: 'f1',
      occupiedSeatIds: ['s1', 's2'],
      heldSeatIds: ['s3'],
    });
  });
});

describe('FlightsService.generate', () => {
  let service: FlightsService;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(async () => {
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: createMockPrisma() },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('audits FLIGHTS_GENERATED once per run with summary counts only', async () => {
    const summary = await service.generate({ from: '2026-10-05', to: '2026-10-11' }, actor);

    expect(summary.flightsCreated).toBe(0);
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'FLIGHTS_GENERATED',
      targetType: 'Flight',
      metadata: { flightsCreated: 0, flightsUpdated: 0 },
    });
    // Nothing created or updated → no dashboard invalidation.
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rejects an inverted range without auditing', async () => {
    await expect(service.generate({ from: '2026-10-14', to: '2026-10-01' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects a range beyond the 62-day cap without auditing', async () => {
    await expect(service.generate({ from: '2026-10-01', to: '2026-12-31' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('has no automatic rolling generation — flights are only created manually', () => {
    // Business decision: the daily rolling-window cron was removed. Manual
    // generation via POST /flights/generate is the only way flights are created.
    expect((service as unknown as Record<string, unknown>)['generateRollingWindow']).toBeUndefined();
  });
});

describe('FlightsService.updateStatus', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('applies an allowed transition, persists it, and audits previous/new status', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: 'SCHEDULED' });
    prisma.flight.update.mockResolvedValue(flightWithRelations('BOARDING'));

    const view = await service.updateStatus('f1', { status: 'BOARDING' }, actor);

    // Compare-and-set: the where clause carries the status seen during validation.
    expect(prisma.flight.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1', status: 'SCHEDULED' }, data: { status: 'BOARDING' } }),
    );
    expect(view.status).toBe('BOARDING');
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'FLIGHT_STATUS_CHANGED',
      targetType: 'Flight',
      targetId: 'f1',
      metadata: { previousStatus: 'SCHEDULED', newStatus: 'BOARDING' },
    });
    expect(events.publish).toHaveBeenCalledWith('flight.status.changed');
  });

  it.each([
    ['SCHEDULED', 'COMPLETED'],
    ['SCHEDULED', 'ARRIVED'],
    ['SCHEDULED', 'DEPARTED'],
    ['DEPARTED', 'COMPLETED'],
    ['DEPARTED', 'CANCELLED'],
    ['BOARDING', 'ARRIVED'],
  ] as const)('rejects the invalid transition %s → %s without persisting or auditing', async (from, to) => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: from });

    await expect(service.updateStatus('f1', { status: to }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.flight.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it.each([
    ['COMPLETED', 'SCHEDULED'],
    ['COMPLETED', 'BOARDING'],
    ['CANCELLED', 'SCHEDULED'],
    ['CANCELLED', 'BOARDING'],
    ['CANCELLED', 'COMPLETED'],
  ] as const)('rejects transitions out of terminal state %s (→ %s)', async (from, to) => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: from });

    await expect(service.updateStatus('f1', { status: to }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.flight.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('walks the full happy-path lifecycle chain', async () => {
    const chain = [
      ['SCHEDULED', 'BOARDING'],
      ['BOARDING', 'DEPARTED'],
      ['DEPARTED', 'ARRIVED'],
      ['ARRIVED', 'COMPLETED'],
    ] as const;
    for (const [from, to] of chain) {
      prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: from });
      prisma.flight.update.mockResolvedValue(flightWithRelations(to));
      const view = await service.updateStatus('f1', { status: to }, actor);
      expect(view.status).toBe(to);
    }
    expect(audit.log).toHaveBeenCalledTimes(4);
  });

  it('404s for an unknown flight without auditing', async () => {
    prisma.flight.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus('missing', { status: 'BOARDING' }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects cancellation when the flight has active bookings (Booking/Finance boundary)', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: 'SCHEDULED' });
    prisma.bookingSeat.count.mockResolvedValue(2);

    await expect(service.updateStatus('f1', { status: 'CANCELLED' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.flight.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('maps a stale concurrent update (P2025) to 409 without auditing or publishing events', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: 'SCHEDULED' });
    prisma.flight.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: '6.7.0' }),
    );

    await expect(service.updateStatus('f1', { status: 'BOARDING' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rethrows non-P2025 update errors unchanged', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: 'SCHEDULED' });
    prisma.flight.update.mockRejectedValue(new Error('db down'));

    await expect(service.updateStatus('f1', { status: 'BOARDING' }, actor)).rejects.toThrow('db down');
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('allows cancellation when no active bookings reference the flight', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1', status: 'SCHEDULED' });
    prisma.bookingSeat.count.mockResolvedValue(0);
    prisma.flight.update.mockResolvedValue(flightWithRelations('CANCELLED'));

    const view = await service.updateStatus('f1', { status: 'CANCELLED' }, actor);

    expect(view.status).toBe('CANCELLED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FLIGHT_STATUS_CHANGED', metadata: { previousStatus: 'SCHEDULED', newStatus: 'CANCELLED' } }),
    );
    expect(events.publish).toHaveBeenCalledWith('flight.status.changed');
    expect(events.publish).toHaveBeenCalledWith('flight.cancelled');
  });
});

describe('FlightsService.update', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  const existing = {
    id: 'f1',
    status: 'SCHEDULED',
    departureTime: new Date('2026-10-05T12:00:00Z'),
    arrivalTime: new Date('2026-10-05T14:00:00Z'),
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('edits times, syncs segment times in the same transaction, and audits FLIGHT_UPDATED', async () => {
    prisma.flight.findUnique.mockResolvedValue({ ...existing });
    prisma.__tx.flight.update.mockResolvedValue(flightWithRelations('SCHEDULED'));

    await service.update('f1', { departureTime: '2026-10-05T13:00:00Z', arrivalTime: undefined }, actor);

    expect(prisma.__tx.flightSegment.updateMany).toHaveBeenCalledWith({
      where: { flightId: 'f1' },
      data: { departureTime: new Date('2026-10-05T13:00:00Z') },
    });
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'FLIGHT_UPDATED',
      targetType: 'Flight',
      targetId: 'f1',
      metadata: { flightNumber: 'NV100', changedFields: ['departureTime'] },
    });
    expect(events.publish).toHaveBeenCalledWith('flight.updated');
  });

  it.each(['CANCELLED', 'COMPLETED'] as const)('rejects editing a %s flight without persisting or auditing', async (status) => {
    prisma.flight.findUnique.mockResolvedValue({ ...existing, status });

    await expect(service.update('f1', { departureTime: '2026-10-05T13:00:00Z' }, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('updates the economy fare price with recomputed taxes/fees inside the same transaction', async () => {
    prisma.flight.findUnique.mockResolvedValue({ ...existing });
    prisma.__tx.flight.update.mockResolvedValue(flightWithRelations('SCHEDULED'));

    await service.update('f1', { price: 300.5 }, actor);

    expect(prisma.__tx.fare.updateMany).toHaveBeenCalledWith({
      where: { flightId: 'f1', cabinClass: 'ECONOMY' },
      data: { basePrice: 300.5, taxAmount: Math.round(300.5 * 0.16), feeAmount: Math.round(300.5 * 0.04) },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ changedFields: ['price'] }) }),
    );
  });

  it('rejects an inverted time range after merging with existing times', async () => {
    prisma.flight.findUnique.mockResolvedValue({ ...existing });

    await expect(service.update('f1', { arrivalTime: '2026-10-05T11:00:00Z' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('404s for an unknown flight', async () => {
    prisma.flight.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { departureTime: '2026-10-05T13:00:00Z' }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('FlightsService.create', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  const routeFixture = {
    id: 'route-1',
    originAirportId: 'a1',
    destinationAirportId: 'a2',
    distanceKm: 6201,
    durationMinutes: 505,
    originAirport: { id: 'a1', iataCode: 'FRA', timezone: 'Europe/Berlin', latitude: null, longitude: null },
    destinationAirport: { id: 'a2', iataCode: 'JFK', timezone: 'America/New_York', latitude: null, longitude: null },
  };

  const dto = {
    routeId: 'route-1',
    aircraftId: 'ac-1',
    departureDate: '2026-10-05',
    departureTime: '08:00',
    arrivalDate: '2026-10-05',
    arrivalTime: '11:25',
    flightNumber: 'NV720',
    price: 250,
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);

    prisma.route.findUnique.mockResolvedValue(routeFixture);
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'ac-1', capacity: 12 });
    prisma.scheduleRule.findUnique.mockResolvedValue(null);
    prisma.flight.findFirst.mockResolvedValue(null); // no duplicate
    prisma.flight.findMany.mockResolvedValue([]); // NV9xx block empty
    prisma.flight.findUnique.mockResolvedValue(flightWithRelations('SCHEDULED')); // findOne at the end
  });

  it('creates the flight with segment and fares in one transaction and audits FLIGHT_CREATED', async () => {
    const view = await service.create(dto, actor);

    expect(view.status).toBe('SCHEDULED');
    const flightData = prisma.__tx.flight.create.mock.calls[0]![0]!.data as Record<string, unknown>;
    expect(flightData).toMatchObject({
      flightNumber: 'NV720', // the entered number — no auto-assignment exists
      routeId: 'route-1',
      aircraftId: 'ac-1',
      status: 'SCHEDULED',
      scheduleStatus: 'ONTIME',
    });
    // 08:00 Europe/Berlin (CEST, UTC+2) = 06:00Z — same convention as the rule generator.
    expect((flightData['departureTime'] as Date).toISOString()).toBe('2026-10-05T06:00:00.000Z');
    // 11:25 America/New_York (EDT, UTC-4) = 15:25Z.
    expect((flightData['arrivalTime'] as Date).toISOString()).toBe('2026-10-05T15:25:00.000Z');
    expect(flightData['operatingDate']).toEqual(new Date('2026-10-05T00:00:00Z'));
    expect(prisma.__tx.flightSegment.create).toHaveBeenCalledOnce();
    expect(prisma.__tx.fare.create).toHaveBeenCalledOnce(); // 12-seat all-economy test aircraft
    // The Flight Manager's price lands on the ECONOMY fare with the project's
    // 16% tax / 4% fee convention (16% of 250 = 40, 4% = 10).
    expect(prisma.__tx.fare.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ basePrice: 250, taxAmount: 40, feeAmount: 10 }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'FLIGHT_CREATED',
      targetType: 'Flight',
      targetId: 'new-f1',
      metadata: { flightNumber: 'NV720' },
    });
    expect(events.publish).toHaveBeenCalledWith('flight.created');
  });

  it('rejects a flight number already used by another flight with 409', async () => {
    prisma.flight.findFirst.mockResolvedValueOnce({ id: 'other-flight' }); // number-taken check

    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects a duplicate (route, aircraft, departureTime) with 409 and no writes', async () => {
    prisma.flight.findFirst
      .mockResolvedValueOnce(null) // number free
      .mockResolvedValueOnce({ id: 'existing' }); // route/aircraft/time duplicate

    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled(); // failed creation emits nothing
  });

  it('rejects a flight number already owned by a schedule rule', async () => {
    prisma.scheduleRule.findUnique.mockResolvedValue({ id: 'rule-1' });

    await expect(service.create({ ...dto, flightNumber: 'NV300' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unknown route or aircraft with 400', async () => {
    prisma.route.findUnique.mockResolvedValue(null);
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(BadRequestException);

    prisma.route.findUnique.mockResolvedValue(routeFixture);
    prisma.aircraft.findUnique.mockResolvedValue(null);
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects an arrival that is not after the departure', async () => {
    await expect(
      service.create({ ...dto, arrivalDate: '2026-10-05', arrivalTime: '00:30' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('FlightsService.overview', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('returns real counts, status breakdown, upcoming list and recent activity from the DB', async () => {
    const countValues = [100, 42, 3, 74, 2, 1, 80, 4, 5, 2, 74, 2, 10, 1];
    let i = 0;
    prisma.flight.count.mockImplementation(() => Promise.resolve(countValues[i++]));
    prisma.route.count.mockResolvedValue(18);
    prisma.airport.count.mockResolvedValue(10);
    prisma.aircraft.count.mockResolvedValue(6);
    prisma.flight.findMany.mockResolvedValue([flightWithRelations('SCHEDULED')]);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'FLIGHT_CREATED',
        actorType: 'Staff',
        actorId: 'u-1',
        targetType: 'Flight',
        targetId: 'f1',
        metadata: { flightNumber: 'NV100' },
        createdAt: new Date('2026-10-07T12:00:00Z'),
      },
    ]);

    const result = await service.overview();

    expect(result).toMatchObject({
      totalFlights: 100,
      upcomingFlights: 42,
      activeFlights: 3,
      completedFlights: 74,
      cancelledFlights: 2,
      delayedFlights: 1,
      routes: 18,
      airports: 10,
      aircraft: 6,
    });
    expect(result.statusBreakdown).toEqual({
      SCHEDULED: 80, BOARDING: 4, DEPARTED: 5, ARRIVED: 2, COMPLETED: 74, CANCELLED: 2, ACTIVE: 10, DELAYED: 1,
    });
    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({ flightNumber: 'NV100', publicNumber: 50, tripType: 'ONE_WAY' });
    expect(result.recentActivity[0]).toMatchObject({ action: 'FLIGHT_CREATED', targetId: 'f1' });
  });
});

describe('FlightsService.history', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('scopes to flight-domain events with search, actorType and pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(41);

    const result = await service.history({ page: 2, limit: 20, domain: 'flights', actorType: 'Staff', search: 'NV100' });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { in: ['FLIGHT_CREATED', 'FLIGHT_UPDATED', 'FLIGHT_STATUS_CHANGED', 'FLIGHTS_GENERATED'] },
          actorType: 'Staff',
          OR: [
            { action: { contains: 'NV100', mode: 'insensitive' } },
            { targetId: { contains: 'NV100', mode: 'insensitive' } },
            { targetType: { contains: 'NV100', mode: 'insensitive' } },
          ],
        }),
        skip: 20,
        take: 20,
      }),
    );
    expect(result).toMatchObject({ page: 2, limit: 20, total: 41, totalPages: 3 });
  });

  it('uses all domain events by default and applies the date range', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await service.history({ page: 1, limit: 20, from: '2026-10-01', to: '2026-10-07' });

    const where = prisma.auditLog.findMany.mock.calls[0]![0]!.where!;
    expect(where.action).toHaveProperty('in');
    expect((where.action as { in: string[] }).in).toContain('AIRPORT_CREATED');
    expect(where.createdAt).toEqual({
      gte: new Date('2026-10-01T00:00:00Z'),
      lte: new Date('2026-10-07T23:59:59.999Z'),
    });
  });
});

describe('FlightsService completed flights & operational list', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = createMockEvents();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('findCompleted returns publicNumber, tripType and fares; FL-xxxx search maps to publicNumber', async () => {
    prisma.flight.findMany.mockResolvedValue([
      {
        ...flightWithRelations('COMPLETED'),
        publicNumber: 50,
        tripType: 'ROUND_TRIP',
        route: {
          originAirport: { id: 'a1', iataCode: 'FRA', latitude: null, longitude: null },
          destinationAirport: { id: 'a2', iataCode: 'JFK', latitude: null, longitude: null },
        },
        fares: [{ id: 'fare-1', cabinClass: 'ECONOMY', basePrice: 250, taxAmount: 40, feeAmount: 10, currency: 'EUR', availableCount: 174, fareRules: null, flightId: 'f1' }],
        segments: [{ id: 's-1', _count: { bookingSeats: 120 } }],
      },
    ]);
    prisma.flight.count.mockResolvedValue(1);

    const result = await service.findCompleted({ page: 1, limit: 20, search: 'FL-1050' });

    expect(prisma.flight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED', publicNumber: 50 }),
      }),
    );
    const item = result.items[0]!;
    expect(item).toMatchObject({ publicNumber: 50, tripType: 'ROUND_TRIP', bookedSeats: 120 });
    expect(item.fares[0]).toMatchObject({ basePrice: 250, taxAmount: 40, feeAmount: 10 });
  });

  it('findAll excludeCompleted excludes COMPLETED only when no explicit status is given', async () => {
    prisma.flight.findMany.mockResolvedValue([]);

    await service.findAll({ excludeCompleted: 'true' });
    expect(prisma.flight.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: 'COMPLETED' } }) }),
    );

    await service.findAll({ excludeCompleted: 'true', status: 'COMPLETED' });
    expect(prisma.flight.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });
});
