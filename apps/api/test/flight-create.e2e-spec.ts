import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * POST /api/flights — explicit single-flight creation by the Flight Manager —
 * plus the server-side list filters (id, flightNumber, status, date range).
 * Fixtures are Prisma-level; no bookings involved.
 */
describe('Flight creation & list filters (e2e)', () => {
  let app: INestApplication<App>;
  let flightManagerRoleId: string;
  let routeId: string;
  let aircraftId: string;

  const CREATE_BODY = {
    departureDate: '2026-10-05',
    departureTime: '08:00',
    arrivalDate: '2026-10-05',
    arrivalTime: '11:25',
    flightNumber: 'NV900',
    price: 250,
  };

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

    const manage = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'flights', action: 'manage' } },
      update: {},
      create: { resource: 'flights', action: 'manage' },
    });
    const role = await prismaTestClient.role.create({ data: { name: 'Flight Manager', isSuperAdmin: false } });
    flightManagerRoleId = role.id;
    await prismaTestClient.rolePermission.create({ data: { roleId: role.id, permissionId: manage.id } });

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
      data: { registration: 'NV-CR01', model: 'Test Jet 100', capacity: 12 },
    });
    aircraftId = aircraft.id;
  });

  async function loginAs(email: string, flightManager: boolean): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Ops', lastName: 'Tester' });
    if (flightManager) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: flightManagerRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  function createFlight(token: string | null, body: Record<string, unknown>) {
    const req = request(app.getHttpServer())
      .post('/api/flights')
      .send({ routeId, aircraftId, ...body });
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  }

  it('creates a flight from the selected route/aircraft/times with segment, fares, and audit row', async () => {
    const token = await loginAs('fm@create.test', true);
    const actor = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'fm@create.test' } });

    const res = await createFlight(token, CREATE_BODY).expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.flightNumber).toBe('NV900'); // the entered business identifier
    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.scheduleStatus).toBe('ONTIME');
    expect(res.body.route.originAirport.iataCode).toBe('FRA');
    expect(res.body.route.destinationAirport.iataCode).toBe('JFK');
    expect(res.body.aircraft.registration).toBe('NV-CR01');
    // Origin-local 08:00 CEST → 06:00Z; destination-local 11:25 EDT → 15:25Z.
    expect(res.body.departureTime).toBe('2026-10-05T06:00:00.000Z');
    expect(res.body.arrivalTime).toBe('2026-10-05T15:25:00.000Z');
    expect(res.body.segments).toHaveLength(1);
    expect(res.body.fares.length).toBeGreaterThan(0);

    // The entered price lands on the ECONOMY fare with the project's
    // 16% tax / 4% fee convention.
    const economy = res.body.fares.find((f: { cabinClass: string }) => f.cabinClass === 'ECONOMY');
    expect(economy).toMatchObject({ basePrice: 250, taxAmount: 40, feeAmount: 10, currency: 'EUR' });

    const stored = await prismaTestClient.flight.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.scheduleRuleId).toBeNull();
    expect(stored.operatingDate?.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(typeof stored.publicNumber).toBe('number');
    expect(res.body.publicNumber).toBe(stored.publicNumber);

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'FLIGHT_CREATED' } });
    expect(audit.actorId).toBe(actor.id);
    expect(audit.actorType).toBe('Staff');
    expect(audit.targetType).toBe('Flight');
    expect(audit.targetId).toBe(res.body.id);
    expect(audit.metadata).toEqual({ flightNumber: 'NV900' });
  });

  it('rejects duplicates (same flight number) and stays idempotent-safe', async () => {
    const token = await loginAs('fm2@create.test', true);

    await createFlight(token, CREATE_BODY).expect(201);
    const dupe = await createFlight(token, CREATE_BODY).expect(409);
    expect(dupe.body.message).toContain('already exists');
    expect(await prismaTestClient.flight.count()).toBe(1);
  });

  it('validates the flight number: required, NV + digits format, lowercase normalized', async () => {
    const token = await loginAs('fm3@create.test', true);

    const withoutNumber: Record<string, unknown> = { ...CREATE_BODY };
    delete withoutNumber['flightNumber'];
    await createFlight(token, withoutNumber).expect(400); // missing → 400
    for (const bad of ['100', 'ABC100', 'NVABC']) {
      await createFlight(token, { ...CREATE_BODY, flightNumber: bad }).expect(400);
    }
    expect(await prismaTestClient.flight.count()).toBe(0);

    // Lowercase is accepted and normalized to uppercase.
    const res = await createFlight(token, { ...CREATE_BODY, flightNumber: 'nv900' }).expect(201);
    expect(res.body.flightNumber).toBe('NV900');
  });

  it('rejects a flight number owned by a schedule rule with 409', async () => {
    const token = await loginAs('fm5@create.test', true);
    await request(app.getHttpServer())
      .post('/api/schedule-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        routeId,
        aircraftId,
        flightNumber: 'NV300',
        departureTimeLocal: '08:00',
        operatingDays: ['MON'],
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
      })
      .expect(201);

    await createFlight(token, { ...CREATE_BODY, flightNumber: 'NV300' }).expect(409);
    expect(await prismaTestClient.flight.count()).toBe(0);
  });

  it('validates references, time order, and flight number format', async () => {
    const token = await loginAs('fm3@create.test', true);

    await createFlight(token, { ...CREATE_BODY, routeId: randomUUID() }).expect(400);
    await createFlight(token, { ...CREATE_BODY, aircraftId: randomUUID() }).expect(400);
    // 08:00 FRA-local = 06:00Z; 01:30 JFK-local = 05:30Z → arrival not after departure.
    await createFlight(token, { ...CREATE_BODY, arrivalTime: '01:30' }).expect(400);
    await createFlight(token, { ...CREATE_BODY, flightNumber: 'XX900' }).expect(400);
    await createFlight(token, { departureDate: 'not-a-date' }).expect(400);
    expect(await prismaTestClient.flight.count()).toBe(0);
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_CREATED' } })).toBe(0);
  });

  it('requires authentication and flights:manage', async () => {
    const customer = await loginAs('customer@create.test', false);

    await createFlight(null, CREATE_BODY).expect(401);
    await createFlight(customer, CREATE_BODY).expect(403);
  });

  it('filters the flight list by id, flightNumber, status and operating-date range — combined', async () => {
    const token = await loginAs('fm4@create.test', true);
    const first = (await createFlight(token, CREATE_BODY).expect(201)).body;
    const second = (await createFlight(token, {
      ...CREATE_BODY,
      flightNumber: 'NV901',
      departureDate: '2026-10-08',
      arrivalDate: '2026-10-08',
    }).expect(201)).body;
    await prismaTestClient.flight.update({ where: { id: second.id }, data: { status: 'COMPLETED' } });

    const all = await request(app.getHttpServer()).get('/api/flights').expect(200);
    expect(all.body).toHaveLength(2);

    const byId = await request(app.getHttpServer()).get(`/api/flights?id=${first.id}`).expect(200);
    expect(byId.body.map((f: { id: string }) => f.id)).toEqual([first.id]);

    const byNumber = await request(app.getHttpServer()).get('/api/flights?flightNumber=nv9').expect(200);
    expect(byNumber.body).toHaveLength(2); // case-insensitive partial match

    const byStatus = await request(app.getHttpServer()).get('/api/flights?status=COMPLETED').expect(200);
    expect(byStatus.body.map((f: { id: string }) => f.id)).toEqual([second.id]);

    const byRange = await request(app.getHttpServer()).get('/api/flights?from=2026-10-06&to=2026-10-10').expect(200);
    expect(byRange.body.map((f: { id: string }) => f.id)).toEqual([second.id]);

    const combined = await request(app.getHttpServer())
      .get(`/api/flights?id=${first.id}&status=COMPLETED`)
      .expect(200);
    expect(combined.body).toHaveLength(0); // id matches but status does not — filters are conjunctive

    const combinedHit = await request(app.getHttpServer())
      .get('/api/flights?flightNumber=NV900&status=SCHEDULED&from=2026-10-01&to=2026-10-06')
      .expect(200);
    expect(combinedHit.body.map((f: { id: string }) => f.id)).toEqual([first.id]);

    await request(app.getHttpServer()).get('/api/flights?id=not-a-uuid').expect(400);
    await request(app.getHttpServer()).get('/api/flights?status=FLYING').expect(400);
  });

  it('publicNumber is sequential and unique across creations, including concurrent ones', async () => {
    const token = await loginAs('seq@create.test', true);

    const first = (await createFlight(token, { ...CREATE_BODY, flightNumber: 'NV950', departureTime: '08:00', arrivalTime: '11:25' }).expect(201)).body;
    const second = (await createFlight(token, { ...CREATE_BODY, flightNumber: 'NV951', departureTime: '08:30', arrivalTime: '11:55' }).expect(201)).body;
    expect(second.publicNumber).toBe(first.publicNumber + 1);

    // Concurrent creations get distinct sequential numbers (DB sequence, no duplicates).
    const [c1, c2, c3] = await Promise.all([
      createFlight(token, { ...CREATE_BODY, flightNumber: 'NV952', departureTime: '09:00', arrivalTime: '12:25' }).expect(201),
      createFlight(token, { ...CREATE_BODY, flightNumber: 'NV953', departureTime: '10:00', arrivalTime: '13:25' }).expect(201),
      createFlight(token, { ...CREATE_BODY, flightNumber: 'NV954', departureTime: '11:00', arrivalTime: '14:25' }).expect(201),
    ]);
    const numbers = [c1.body.publicNumber, c2.body.publicNumber, c3.body.publicNumber];
    expect(new Set(numbers).size).toBe(3);
    for (const n of numbers) {
      expect(n).toBeGreaterThan(second.publicNumber);
    }
  });

  it('Flight Manager can update the price — the ECONOMY fare follows', async () => {
    const token = await loginAs('price@create.test', true);
    const created = (await createFlight(token, CREATE_BODY).expect(201)).body;

    const updated = await request(app.getHttpServer())
      .patch(`/api/flights/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 300.5 })
      .expect(200);

    const economy = updated.body.fares.find((f: { cabinClass: string }) => f.cabinClass === 'ECONOMY');
    expect(economy).toMatchObject({ basePrice: 300.5, taxAmount: 48, feeAmount: 12 });

    // Invalid prices are rejected.
    for (const price of [-10, 0, 'abc', 25.555]) {
      await request(app.getHttpServer())
        .patch(`/api/flights/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price })
        .expect(400);
    }
    // And a price is required at creation.
    const { price: _omit, ...withoutPrice } = CREATE_BODY;
    await createFlight(token, withoutPrice).expect(400);
  });
});
