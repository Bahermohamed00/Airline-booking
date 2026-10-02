import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { DashboardService, bucketPerDay, bucketSumPerDay } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { FlightsService } from '../flights/flights.service';

const NOW = new Date('2026-09-29T12:00:00Z');

const createMockPrisma = () => ({
  flight: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  booking: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  bookingPassenger: { count: vi.fn().mockResolvedValue(0) },
  bookingSeat: { count: vi.fn().mockResolvedValue(0) },
  payment: { findMany: vi.fn().mockResolvedValue([]) },
  refund: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
  baggage: { count: vi.fn().mockResolvedValue(0) },
});

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let flights: { findAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prisma = createMockPrisma();
    flights = { findAll: vi.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: FlightsService, useValue: flights },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries upcoming flights as departures within [now, now+7d)', async () => {
    await service.getDashboard({});
    const where = prisma.flight.count.mock.calls[0]![0]!.where!;
    expect(where.departureTime.gte).toEqual(NOW);
    expect(where.departureTime.lt).toEqual(
      new Date(NOW.getTime() + 7 * 86_400_000),
    );
  });

  it('counts passengers only on active (PENDING/CONFIRMED) bookings', async () => {
    await service.getDashboard({});
    const where = prisma.bookingPassenger.count.mock.calls[0]![0]!.where!;
    expect(where.booking.status.in).toEqual(['PENDING', 'CONFIRMED']);
  });

  it("reuses the flights service for today's operations and maps a slim view", async () => {
    flights.findAll.mockResolvedValue([
      {
        id: 'f1',
        flightNumber: 'NV100',
        status: 'DELAYED',
        departureTime: new Date('2026-09-29T06:00:00Z'),
        arrivalTime: new Date('2026-09-29T14:00:00Z'),
        route: {
          originAirport: { iataCode: 'FRA' },
          destinationAirport: { iataCode: 'JFK' },
        },
        aircraft: { registration: 'NV-320A' },
        fares: [{ basePrice: 421 }],
      },
    ]);
    const view = await service.getDashboard({});
    expect(flights.findAll).toHaveBeenCalledWith({ date: '2026-09-29' });
    expect(view.todaysFlights).toEqual([
      {
        id: 'f1',
        flightNumber: 'NV100',
        status: 'DELAYED',
        departureTime: new Date('2026-09-29T06:00:00Z'),
        arrivalTime: new Date('2026-09-29T14:00:00Z'),
        originIata: 'FRA',
        destinationIata: 'JFK',
        aircraftRegistration: 'NV-320A',
      },
    ]);
    expect(view.todaysFlights[0]).not.toHaveProperty('fares');
    expect(view.delayedCount).toBe(1);
  });

  it('counts ACTIVE flights as scheduled in the status chips', async () => {
    flights.findAll.mockResolvedValue([
      {
        id: 'f1',
        flightNumber: 'NV1',
        status: 'SCHEDULED',
        departureTime: NOW,
        arrivalTime: NOW,
        route: {
          originAirport: { iataCode: 'FRA' },
          destinationAirport: { iataCode: 'JFK' },
        },
        aircraft: { registration: 'R' },
      },
      {
        id: 'f2',
        flightNumber: 'NV2',
        status: 'ACTIVE',
        departureTime: NOW,
        arrivalTime: NOW,
        route: {
          originAirport: { iataCode: 'FRA' },
          destinationAirport: { iataCode: 'JFK' },
        },
        aircraft: { registration: 'R' },
      },
    ]);
    const view = await service.getDashboard({});
    expect(view.scheduledCount).toBe(2);
  });

  it('computes occupancy from active bookings over non-cancelled upcoming flights', async () => {
    prisma.flight.findMany.mockResolvedValue([
      { id: 'f1', aircraft: { _count: { seats: 100 } } },
      { id: 'f2', aircraft: { _count: { seats: 100 } } },
    ]);
    prisma.bookingSeat.count.mockResolvedValue(50);
    const view = await service.getDashboard({});
    const where = prisma.bookingSeat.count.mock.calls[0]![0]!.where!;
    expect(where.flightSegment.flightId.in).toEqual(['f1', 'f2']);
    expect(where.bookingPassenger.booking.status.in).toEqual([
      'PENDING',
      'CONFIRMED',
    ]);
    expect(prisma.flight.findMany.mock.calls[0]![0]!.where!.status).toEqual({
      not: 'CANCELLED',
    });
    expect(view.occupancyPercent).toBe(25);
  });

  it('returns 0% occupancy instead of dividing by zero when there are no upcoming flights', async () => {
    prisma.flight.findMany.mockResolvedValue([]);
    const view = await service.getDashboard({});
    expect(view.occupancyPercent).toBe(0);
  });

  it('computes net revenue from captured payments minus processed refunds', async () => {
    prisma.payment.findMany.mockResolvedValue([
      { amount: '505.00', paidAt: new Date('2026-09-20T10:00:00Z') },
      { amount: '100.50', paidAt: new Date('2026-09-29T08:00:00Z') },
    ]);
    prisma.refund.findMany.mockResolvedValue([{ amount: '50.25', processedAt: new Date('2026-09-28T10:00:00Z') }]);
    const view = await service.getDashboard({});
    expect(view.revenue).toBe(555.25);
    expect(view.currency).toBe('EUR');
    expect(prisma.payment.findMany.mock.calls[0]![0]!.where).toEqual({
      status: { in: ['SUCCESS', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
      paidAt: { not: null },
    });
    expect(prisma.refund.findMany.mock.calls[0]![0]!.where).toEqual({
      status: 'PROCESSED',
      processedAt: { not: null },
    });
  });

  it('returns zero revenue and a zero-filled trend when no payments exist', async () => {
    const view = await service.getDashboard({ range: '7d' });
    expect(view.revenue).toBe(0);
    expect(view.revenueTrend).toHaveLength(7);
    expect(view.revenueTrend.every((p) => p.value === 0)).toBe(true);
  });

  it('buckets revenue per UTC day with refunds subtracting from their day', async () => {
    prisma.payment.findMany.mockResolvedValue([
      { amount: '505.00', paidAt: new Date('2026-09-29T08:00:00Z') },
      { amount: '200.00', paidAt: new Date('2026-09-27T08:00:00Z') },
    ]);
    prisma.refund.findMany.mockResolvedValue([{ amount: '100.00', processedAt: new Date('2026-09-29T09:00:00Z') }]);
    const view = await service.getDashboard({ range: '7d' });
    const points = Object.fromEntries(view.revenueTrend.map((p) => [p.date, p.value]));
    expect(points['2026-09-29']).toBe(405);
    expect(points['2026-09-27']).toBe(200);
    expect(points['2026-09-28']).toBe(0);
    expect(view.revenue).toBe(605);
  });

  it('maps recent bookings with numeric totals, newest first, capped at 5', async () => {
    prisma.booking.findMany.mockImplementation(
      (args: { take?: number; orderBy?: unknown }) => {
        if (args.take === undefined) return []; // trend query
        expect(args.take).toBe(5);
        expect(args.orderBy).toEqual({ bookedAt: 'desc' });
        return [
          {
            id: 'b1',
            bookingReference: 'NVABC1',
            status: 'PENDING',
            totalAmount: '505.00',
            currency: 'EUR',
            bookedAt: NOW,
          },
        ];
      },
    );
    const view = await service.getDashboard({});
    expect(view.recentBookings).toEqual([
      {
        id: 'b1',
        bookingReference: 'NVABC1',
        status: 'PENDING',
        totalAmount: 505,
        currency: 'EUR',
        bookedAt: NOW,
      },
    ]);
  });

  it('defaults to the 30d range and produces a 30-point zero-filled bookings trend', async () => {
    const view = await service.getDashboard({});
    expect(view.range).toBe('30d');
    expect(view.bookingsTrend).toHaveLength(30);
    expect(view.bookingsTrend.every((p) => p.value === 0)).toBe(true);
    expect(view.bookingsTrend[29]!.date).toBe('2026-09-29');
    expect(view.bookingsTrend[0]!.date).toBe('2026-08-31');
  });

  it('supports 7d and 90d trend ranges', async () => {
    expect(
      (await service.getDashboard({ range: '7d' })).bookingsTrend,
    ).toHaveLength(7);
    expect(
      (await service.getDashboard({ range: '90d' })).bookingsTrend,
    ).toHaveLength(90);
  });

  it('buckets bookings into their UTC day within the trend window', async () => {
    prisma.booking.findMany.mockImplementation((args: { where?: unknown }) => {
      if (args.where) {
        return [
          { bookedAt: new Date('2026-09-29T08:00:00Z') },
          { bookedAt: new Date('2026-09-29T21:00:00Z') },
          { bookedAt: new Date('2026-09-27T10:00:00Z') },
        ];
      }
      return [];
    });
    const view = await service.getDashboard({ range: '7d' });
    const points = Object.fromEntries(
      view.bookingsTrend.map((p) => [p.date, p.value]),
    );
    expect(points['2026-09-29']).toBe(2);
    expect(points['2026-09-27']).toBe(1);
    expect(points['2026-09-28']).toBe(0);
    expect(view.bookingsTrend.reduce((s, p) => s + p.value, 0)).toBe(3);
  });

  it('queries refunds and baggage as real counts of open cases', async () => {
    prisma.refund.count.mockResolvedValue(3);
    prisma.baggage.count.mockResolvedValue(2);
    const view = await service.getDashboard({});
    expect(prisma.refund.count.mock.calls[0]![0]).toEqual({
      where: { status: 'PENDING' },
    });
    expect(prisma.baggage.count.mock.calls[0]![0]).toEqual({
      where: { status: { in: ['LOST', 'DELAYED'] } },
    });
    expect(view.pendingRefunds).toBe(3);
    expect(view.openBaggageCases).toBe(2);
  });
});

describe('bucketSumPerDay', () => {
  it('zero-fills a trailing window ordered oldest to newest', () => {
    const points = bucketSumPerDay([], 3, NOW);
    expect(points).toEqual([
      { date: '2026-09-27', value: 0 },
      { date: '2026-09-28', value: 0 },
      { date: '2026-09-29', value: 0 },
    ]);
  });

  it('sums signed amounts on their UTC day and rounds to cents', () => {
    const points = bucketSumPerDay(
      [
        { date: new Date('2026-09-28T10:00:00Z'), value: 100.1 },
        { date: new Date('2026-09-28T11:00:00Z'), value: 100.2 },
        { date: new Date('2026-09-28T12:00:00Z'), value: -50.05 },
      ],
      2,
      NOW,
    );
    expect(points).toEqual([
      { date: '2026-09-28', value: 150.25 },
      { date: '2026-09-29', value: 0 },
    ]);
  });
});

describe('bucketPerDay', () => {
  it('zero-fills a trailing window ordered oldest to newest', () => {
    const points = bucketPerDay([], 3, NOW);
    expect(points).toEqual([
      { date: '2026-09-27', value: 0 },
      { date: '2026-09-28', value: 0 },
      { date: '2026-09-29', value: 0 },
    ]);
  });

  it('counts events on their UTC day and ignores nothing inside the window', () => {
    const points = bucketPerDay(
      [new Date('2026-09-28T23:59:00Z'), new Date('2026-09-28T00:01:00Z')],
      2,
      NOW,
    );
    expect(points).toEqual([
      { date: '2026-09-28', value: 2 },
      { date: '2026-09-29', value: 0 },
    ]);
  });
});
