import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';
const DAY_MS = 86_400_000;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const utcDay = (offsetDays: number) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
      offsetDays * DAY_MS,
  );
};

/**
 * Phase 6A: Admin dashboard — real PostgreSQL aggregates behind the
 * dashboard:read permission. No frontend mock data involved.
 */
describe('Admin dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let superAdminRoleId: string;
  let staffRoleId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function loginAs(email: string, roleId?: string): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Dashboard',
      lastName: 'Actor',
    });
    if (roleId) {
      const user = await prismaTestClient.user.findUniqueOrThrow({
        where: { email },
      });
      await prismaTestClient.userRole.create({
        data: { userId: user.id, roleId },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  async function makeFlight(opts: {
    flightNumber: string;
    routeId: string;
    aircraftId: string;
    departsInMs: number;
    status: 'SCHEDULED' | 'DELAYED' | 'CANCELLED' | 'COMPLETED';
    operatingToday?: boolean;
  }) {
    const departure = new Date(Date.now() + opts.departsInMs);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: opts.flightNumber,
        routeId: opts.routeId,
        aircraftId: opts.aircraftId,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 300 * 60000),
        status: opts.status,
        ...(opts.operatingToday ? { operatingDate: utcDay(0) } : {}),
      },
    });
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'FRA' },
      }),
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'JFK' },
      }),
    ]);
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 300 * 60000),
      },
    });
    return flight;
  }

  async function makeBooking(opts: {
    reference: string;
    userId: string;
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
    bookedAt: Date;
    passengerSeats: Array<{
      segmentId: string;
      seatId: string;
      seatNumber: string;
    }>;
  }) {
    const booking = await prismaTestClient.booking.create({
      data: {
        bookingReference: opts.reference,
        userId: opts.userId,
        status: opts.status,
        totalAmount: 505,
        currency: 'EUR',
        contactEmail: 'traveller@test.dev',
        bookedAt: opts.bookedAt,
      },
    });
    for (const [i, seat] of opts.passengerSeats.entries()) {
      const passenger = await prismaTestClient.passenger.create({
        data: {
          userId: opts.userId,
          firstName: `Pax${opts.reference}`,
          lastName: `Nr${i}`,
        },
      });
      const bp = await prismaTestClient.bookingPassenger.create({
        data: {
          bookingId: booking.id,
          passengerId: passenger.id,
          passengerType: 'ADULT',
        },
      });
      await prismaTestClient.bookingSeat.create({
        data: {
          bookingPassengerId: bp.id,
          flightSegmentId: seat.segmentId,
          seatId: seat.seatId,
          seatNumber: seat.seatNumber,
        },
      });
    }
    return booking;
  }

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const permission = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'dashboard', action: 'read' } },
      update: {},
      create: { resource: 'dashboard', action: 'read' },
    });
    const superAdmin = await prismaTestClient.role.upsert({
      where: { name: 'Super Admin' },
      update: { isSuperAdmin: true },
      create: { name: 'Super Admin', isSuperAdmin: true },
    });
    superAdminRoleId = superAdmin.id;
    const staff = await prismaTestClient.role.create({
      data: { name: 'Ops Viewer' },
    });
    await prismaTestClient.rolePermission.create({
      data: { roleId: staff.id, permissionId: permission.id },
    });
    staffRoleId = staff.id;

    await prismaTestClient.airport.createMany({
      data: [
        {
          iataCode: 'FRA',
          name: 'Frankfurt Airport',
          city: 'Frankfurt',
          country: 'Germany',
          timezone: 'Europe/Berlin',
        },
        {
          iataCode: 'JFK',
          name: 'JFK International',
          city: 'New York',
          country: 'United States',
          timezone: 'America/New_York',
        },
      ],
    });
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'FRA' },
      }),
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'JFK' },
      }),
    ]);
    const route = await prismaTestClient.route.create({
      data: {
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        distanceKm: 6201,
        durationMinutes: 505,
      },
    });
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
    });
    await prismaTestClient.seat.createMany({
      data: generateSeatMap(aircraft.capacity).map((s) => ({
        ...s,
        aircraftId: aircraft.id,
        features: {},
      })),
    });

    // Today: one scheduled, one delayed. Upcoming: +3d. Outside: +10d and yesterday.
    const f1 = await makeFlight({
      flightNumber: 'NV100',
      routeId: route.id,
      aircraftId: aircraft.id,
      departsInMs: 2 * 3_600_000,
      status: 'SCHEDULED',
      operatingToday: true,
    });
    await makeFlight({
      flightNumber: 'NV101',
      routeId: route.id,
      aircraftId: aircraft.id,
      departsInMs: 5 * 3_600_000,
      status: 'DELAYED',
      operatingToday: true,
    });
    await makeFlight({
      flightNumber: 'NV102',
      routeId: route.id,
      aircraftId: aircraft.id,
      departsInMs: 3 * DAY_MS,
      status: 'SCHEDULED',
    });
    await makeFlight({
      flightNumber: 'NV103',
      routeId: route.id,
      aircraftId: aircraft.id,
      departsInMs: 10 * DAY_MS,
      status: 'SCHEDULED',
    });
    await makeFlight({
      flightNumber: 'NV104',
      routeId: route.id,
      aircraftId: aircraft.id,
      departsInMs: -DAY_MS,
      status: 'COMPLETED',
    });

    const seats = await prismaTestClient.seat.findMany({
      where: { aircraftId: aircraft.id },
      orderBy: { seatNumber: 'asc' },
    });
    const f1Segment = await prismaTestClient.flightSegment.findFirstOrThrow({
      where: { flightId: f1.id },
    });
    const user = await registerVerifiedUser(app, {
      email: 'booker@test.dev',
      password: PASSWORD,
      firstName: 'Book',
      lastName: 'Er',
    }).then(() =>
      prismaTestClient.user.findUniqueOrThrow({
        where: { email: 'booker@test.dev' },
      }),
    );

    const seatRef = (i: number) => ({
      segmentId: f1Segment.id,
      seatId: seats[i]!.id,
      seatNumber: seats[i]!.seatNumber,
    });
    await makeBooking({
      reference: 'NVDASH',
      userId: user.id,
      status: 'PENDING',
      bookedAt: new Date(),
      passengerSeats: [seatRef(0), seatRef(1)],
    });
    await makeBooking({
      reference: 'NVCONF',
      userId: user.id,
      status: 'CONFIRMED',
      bookedAt: new Date(Date.now() - 2 * DAY_MS),
      passengerSeats: [seatRef(2)],
    });
    await makeBooking({
      reference: 'NVCANC',
      userId: user.id,
      status: 'CANCELLED',
      bookedAt: new Date(Date.now() - 4 * DAY_MS),
      passengerSeats: [seatRef(3)],
    });
  });

  function get(token: string | undefined, query = '') {
    const req = request(app.getHttpServer()).get(
      `/api/admin/dashboard${query}`,
    );
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  // ---------- Authorization ----------

  it('rejects unauthenticated callers with 401', async () => {
    await get(undefined).expect(401);
  });

  it('rejects an authenticated customer without dashboard:read with 403', async () => {
    const token = await loginAs('dashboard-customer@test.dev');
    await get(token).expect(403);
  });

  it('allows staff holding dashboard:read', async () => {
    const token = await loginAs('dashboard-staff@test.dev', staffRoleId);
    await get(token).expect(200);
  });

  it('allows Super Admin via the existing bypass', async () => {
    const token = await loginAs('dashboard-admin@test.dev', superAdminRoleId);
    await get(token).expect(200);
  });

  // ---------- Range validation ----------

  it('rejects an unsupported range with 400', async () => {
    const token = await loginAs('dashboard-range@test.dev', staffRoleId);
    await get(token, '?range=14d').expect(400);
  });

  it.each([
    ['7d', 7],
    ['30d', 30],
    ['90d', 90],
  ] as const)(
    'returns a %i-point bookings trend for range=%s',
    async (range, days) => {
      const token = await loginAs(`dashboard-${range}@test.dev`, staffRoleId);
      const body = (await get(token, `?range=${range}`).expect(200)).body;
      expect(body.range).toBe(range);
      expect(body.bookingsTrend).toHaveLength(days);
      expect(body.bookingsTrend[days - 1].date).toBe(isoDay(new Date()));
    },
  );

  // ---------- Real data ----------

  it('returns KPIs aggregated from PostgreSQL', async () => {
    const token = await loginAs('dashboard-data@test.dev', staffRoleId);
    const body = (await get(token).expect(200)).body;

    // Upcoming 7-day departures: NV100, NV101, NV102 (not +10d, not yesterday).
    expect(body.totalFlights).toBe(3);
    expect(body.totalBookings).toBe(3);
    expect(body.confirmedBookings).toBe(1);
    // 2 PENDING + 1 CONFIRMED passengers; the CANCELLED one is excluded.
    expect(body.passengers).toBe(3);
    // 3 occupied seats over 3 upcoming flights × 12 seats = 8%.
    expect(body.occupancyPercent).toBe(8);
    // Payments are live (Phase 6F): with none recorded, revenue is a truthful
    // 0 and the trend a zero-filled series for the default 30d range.
    expect(body.revenue).toBe(0);
    expect(body.revenueTrend).toHaveLength(30);
    expect(
      body.revenueTrend.every((p: { value: number }) => p.value === 0),
    ).toBe(true);
    expect(body.currency).toBe('EUR');
    // Deferred domains report real zero counts.
    expect(body.pendingRefunds).toBe(0);
    expect(body.openBaggageCases).toBe(0);
  });

  it("returns today's operations with status chips from real flights", async () => {
    const token = await loginAs('dashboard-ops@test.dev', staffRoleId);
    const body = (await get(token).expect(200)).body;

    const numbers = body.todaysFlights
      .map((f: { flightNumber: string }) => f.flightNumber)
      .sort();
    expect(numbers).toEqual(['NV100', 'NV101']);
    expect(body.scheduledCount).toBe(1);
    expect(body.delayedCount).toBe(1);
    expect(body.cancelledCount).toBe(0);
    expect(body.completedCount).toBe(0);

    const f100 = body.todaysFlights.find(
      (f: { flightNumber: string }) => f.flightNumber === 'NV100',
    );
    expect(f100.originIata).toBe('FRA');
    expect(f100.destinationIata).toBe('JFK');
    expect(f100.aircraftRegistration).toBe('NV-T100');
    expect(f100).not.toHaveProperty('fares');
  });

  it('returns recent bookings newest-first without contact PII', async () => {
    const token = await loginAs('dashboard-recent@test.dev', staffRoleId);
    const body = (await get(token).expect(200)).body;

    expect(body.recentBookings).toHaveLength(3);
    expect(body.recentBookings[0].bookingReference).toBe('NVDASH');
    expect(body.recentBookings[0].totalAmount).toBe(505);
    for (const b of body.recentBookings) {
      expect(b).not.toHaveProperty('contactEmail');
      expect(b).not.toHaveProperty('userId');
    }
  });

  it('buckets the bookings trend per UTC day with zero-filled gaps', async () => {
    const token = await loginAs('dashboard-trend@test.dev', staffRoleId);
    const body = (await get(token, '?range=7d').expect(200)).body;

    const byDate = Object.fromEntries(
      body.bookingsTrend.map((p: { date: string; value: number }) => [
        p.date,
        p.value,
      ]),
    );
    expect(byDate[isoDay(new Date())]).toBe(1);
    expect(byDate[isoDay(new Date(Date.now() - 2 * DAY_MS))]).toBe(1);
    expect(byDate[isoDay(new Date(Date.now() - 4 * DAY_MS))]).toBe(1);
    expect(
      body.bookingsTrend.reduce(
        (s: number, p: { value: number }) => s + p.value,
        0,
      ),
    ).toBe(3);
  });
});
