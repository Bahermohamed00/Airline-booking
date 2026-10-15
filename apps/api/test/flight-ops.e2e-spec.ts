import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Flight Manager operations APIs (e2e): overview dashboard, completed flights,
 * flight-domain history, tripType, and the operational (excludeCompleted) list.
 */
describe('Flight Manager operations (e2e)', () => {
  let app: INestApplication<App>;
  let flightManagerRoleId: string;
  let routeId: string;
  let aircraftId: string;

  const CREATE_BODY = (() => {
    // Two days out so the created flight is genuinely "upcoming" regardless of run date.
    const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    return {
      departureDate: day,
      departureTime: '08:00',
      arrivalDate: day,
      arrivalTime: '11:25',
      flightNumber: 'NV900',
      price: 250,
    };
  })();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
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

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const [read, manage] = await Promise.all([
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'flights', action: 'read' } },
        update: {},
        create: { resource: 'flights', action: 'read' },
      }),
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'flights', action: 'manage' } },
        update: {},
        create: { resource: 'flights', action: 'manage' },
      }),
    ]);
    const role = await prismaTestClient.role.create({ data: { name: 'Flight Manager', isSuperAdmin: false } });
    flightManagerRoleId = role.id;
    await prismaTestClient.rolePermission.createMany({
      data: [
        { roleId: role.id, permissionId: read.id },
        { roleId: role.id, permissionId: manage.id },
      ],
    });

    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.create({
        data: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
      }),
      prismaTestClient.airport.create({
        data: { iataCode: 'JFK', name: 'JFK International', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      }),
    ]);
    const route = await prismaTestClient.route.create({
      data: { originAirportId: fra.id, destinationAirportId: jfk.id, distanceKm: 6201, durationMinutes: 505 },
    });
    routeId = route.id;
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-OPS1', model: 'Test Jet 100', capacity: 12 },
    });
    aircraftId = aircraft.id;
  });

  async function loginAs(email: string, flightManager = true): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Ops', lastName: 'Tester' });
    if (flightManager) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: flightManagerRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  async function createFlight(token: string, body: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/flights')
      .set('Authorization', `Bearer ${token}`)
      .send({ routeId, aircraftId, ...CREATE_BODY, ...body });
    expect(res.status).toBe(201);
    return res.body;
  }

  it('overview reflects real DB state and updates after create + completion', async () => {
    const token = await loginAs('ov-ops@test.dev');

    const before = (await request(app.getHttpServer())
      .get('/api/admin/flights/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(before).toMatchObject({ totalFlights: 0, completedFlights: 0, routes: 1, airports: 2, aircraft: 1 });
    expect(before.statusBreakdown).toMatchObject({ SCHEDULED: 0, COMPLETED: 0 });

    const flight = await createFlight(token, { tripType: 'ROUND_TRIP' });

    const afterCreate = (await request(app.getHttpServer())
      .get('/api/admin/flights/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(afterCreate.totalFlights).toBe(before.totalFlights + 1);
    expect(afterCreate.upcomingFlights).toBe(before.upcomingFlights + 1);
    expect(afterCreate.statusBreakdown.SCHEDULED).toBe(1);
    expect(afterCreate.upcoming[0]).toMatchObject({
      flightNumber: 'NV900',
      publicNumber: flight.publicNumber,
      tripType: 'ROUND_TRIP',
    });
    expect(afterCreate.recentActivity.some((a: { action: string }) => a.action === 'FLIGHT_CREATED')).toBe(true);

    // Complete the flight via the real lifecycle transitions.
    for (const status of ['BOARDING', 'DEPARTED', 'ARRIVED', 'COMPLETED']) {
      await request(app.getHttpServer())
        .patch(`/api/flights/${flight.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status })
        .expect(200);
    }

    const afterComplete = (await request(app.getHttpServer())
      .get('/api/admin/flights/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(afterComplete.completedFlights).toBe(1);
    expect(afterComplete.upcomingFlights).toBe(before.upcomingFlights);
    expect(afterComplete.statusBreakdown.COMPLETED).toBe(1);
    expect(afterComplete.upcoming).toHaveLength(0);
  });

  it('history lists flight-domain audit events immutably (GET-only), scoped and paginated', async () => {
    const token = await loginAs('hist-ops@test.dev');
    await createFlight(token);

    const history = (await request(app.getHttpServer())
      .get('/api/admin/flights/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(history.total).toBeGreaterThan(0);
    const created = history.items.find((i: { action: string }) => i.action === 'FLIGHT_CREATED');
    expect(created).toMatchObject({ actorType: 'Staff', targetType: 'Flight' });

    // Domain scoping: airports domain contains only airport events (here: none).
    const airports = (await request(app.getHttpServer())
      .get('/api/admin/flights/history?domain=airports')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(airports.total).toBe(0);

    // Non-flight events never appear: write an unrelated audit row directly.
    await prismaTestClient.auditLog.create({
      data: { actorType: 'User', action: 'USER_LOGGED_IN', targetType: 'User' },
    });
    const after = (await request(app.getHttpServer())
      .get('/api/admin/flights/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(after.items.every((i: { action: string }) => i.action !== 'USER_LOGGED_IN')).toBe(true);

    // Search + pagination contract.
    const search = (await request(app.getHttpServer())
      .get('/api/admin/flights/history?search=FLIGHT_CREATED&page=1&limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(search).toMatchObject({ page: 1, limit: 1 });
    expect(search.items).toHaveLength(1);

    // RBAC: customers get 403, anonymous 401.
    const customerToken = await loginAs('cust-ops@test.dev', false);
    await request(app.getHttpServer())
      .get('/api/admin/flights/history')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer()).get('/api/admin/flights/history').expect(401);
  });

  it('completed flights carry public ID, trip type and fares; FL-id search finds them; lifecycle separation holds', async () => {
    const token = await loginAs('comp-ops@test.dev');
    const flight = await createFlight(token, { tripType: 'ROUND_TRIP' });

    for (const status of ['BOARDING', 'DEPARTED', 'ARRIVED', 'COMPLETED']) {
      await request(app.getHttpServer())
        .patch(`/api/flights/${flight.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status })
        .expect(200);
    }

    const completed = (await request(app.getHttpServer())
      .get('/api/admin/flights/completed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(completed.total).toBe(1);
    expect(completed.items[0]).toMatchObject({
      flightNumber: 'NV900',
      publicNumber: flight.publicNumber,
      tripType: 'ROUND_TRIP',
      status: 'COMPLETED',
    });
    expect(completed.items[0].fares[0]).toMatchObject({ cabinClass: 'ECONOMY', basePrice: 250, currency: 'EUR' });

    // FL-id search resolves to the publicNumber.
    const publicId = `FL-${1000 + flight.publicNumber}`;
    const found = (await request(app.getHttpServer())
      .get(`/api/admin/flights/completed?search=${publicId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(found.total).toBe(1);
    expect(found.items[0].id).toBe(flight.id);

    // The operational list hides COMPLETED; the default list keeps it; the record is never deleted.
    const operational = (await request(app.getHttpServer())
      .get('/api/flights?excludeCompleted=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(operational.map((f: { id: string }) => f.id)).not.toContain(flight.id);

    const all = (await request(app.getHttpServer())
      .get('/api/flights')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)).body;
    expect(all.map((f: { id: string }) => f.id)).toContain(flight.id);
    expect(await prismaTestClient.flight.count()).toBe(1);
  });

  it('tripType defaults to ONE_WAY, persists ROUND_TRIP, and rejects invalid values', async () => {
    const token = await loginAs('trip-ops@test.dev');

    const defaulted = await createFlight(token, { flightNumber: 'NV910', departureTime: '09:00', arrivalTime: '12:25' });
    expect(defaulted.tripType).toBe('ONE_WAY');

    const roundTrip = await createFlight(token, { flightNumber: 'NV911', departureTime: '10:00', arrivalTime: '13:25', tripType: 'ROUND_TRIP' });
    expect(roundTrip.tripType).toBe('ROUND_TRIP');
    const stored = await prismaTestClient.flight.findUniqueOrThrow({ where: { id: roundTrip.id } });
    expect(stored.tripType).toBe('ROUND_TRIP');

    await request(app.getHttpServer())
      .post('/api/flights')
      .set('Authorization', `Bearer ${token}`)
      .send({ routeId, aircraftId, ...CREATE_BODY, flightNumber: 'NV912', tripType: 'MULTI_CITY' })
      .expect(400);
  });
});
