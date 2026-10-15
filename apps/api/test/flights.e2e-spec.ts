import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { randomUUID } from 'crypto';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Phase 3: ScheduleRule CRUD, deterministic timezone-aware flight generation
 * with fares, idempotency, and the Flights API — all against PostgreSQL.
 */
describe('Flights & schedule rules (e2e)', () => {
  let app: INestApplication<App>;
  let superAdminRoleId: string;

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

    for (const [resource, action] of [
      ['flights', 'read'],
      ['flights', 'manage'],
    ] as const) {
      await prismaTestClient.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
    }
    const superAdmin = await prismaTestClient.role.upsert({
      where: { name: 'Super Admin' },
      update: { isSuperAdmin: true },
      create: { name: 'Super Admin', isSuperAdmin: true },
    });
    superAdminRoleId = superAdmin.id;

    await prismaTestClient.airport.createMany({
      data: [
        { iataCode: 'FRA', icaoCode: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
        { iataCode: 'JFK', icaoCode: 'KJFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      ],
    });
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } }),
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } }),
    ]);
    await prismaTestClient.route.createMany({
      data: [
        { originAirportId: fra.id, destinationAirportId: jfk.id, distanceKm: 6201, durationMinutes: 505 },
        { originAirportId: jfk.id, destinationAirportId: fra.id, distanceKm: 6201, durationMinutes: 470 },
      ],
    });
    await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
    });
  });

  async function loginAs(email: string, superAdmin: boolean): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Ops', lastName: 'Actor' });
    if (superAdmin) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: superAdminRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const fixtures = async () => {
    const [fra, jfk, aircraft, routeFraJfk, routeJfkFra] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } }),
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } }),
      prismaTestClient.aircraft.findUniqueOrThrow({ where: { registration: 'NV-T100' } }),
      prismaTestClient.route.findFirstOrThrow({ where: { originAirport: { iataCode: 'FRA' } } }),
      prismaTestClient.route.findFirstOrThrow({ where: { originAirport: { iataCode: 'JFK' } } }),
    ]);
    return { fra, jfk, aircraft, routeFraJfk, routeJfkFra };
  };

  function createRule(body: Record<string, unknown>, token?: string) {
    const req = request(app.getHttpServer()).post('/api/schedule-rules');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  }

  const baseRule = (f: Awaited<ReturnType<typeof fixtures>>, flightNumber: string) => ({
    routeId: f.routeFraJfk.id,
    aircraftId: f.aircraft.id,
    flightNumber,
    departureTimeLocal: '08:00',
    operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    effectiveFrom: '2026-10-01',
    effectiveTo: '2026-10-31',
  });

  function generateRange(token: string, from: string, to: string) {
    return request(app.getHttpServer())
      .post('/api/flights/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ from, to });
  }

  // ---------- Schedule rules ----------

  it('creates a schedule rule with route and aircraft resolved', async () => {
    const token = await loginAs('rules-admin@test.dev', true);
    const f = await fixtures();

    const res = await createRule(baseRule(f, 'NV300'), token).expect(201);
    expect(res.body).toMatchObject({
      flightNumber: 'NV300',
      departureTimeLocal: '08:00',
      status: 'ACTIVE',
      route: { originAirport: { iataCode: 'FRA' }, destinationAirport: { iataCode: 'JFK' } },
      aircraft: { registration: 'NV-T100' },
    });

    const stored = await prismaTestClient.scheduleRule.findUniqueOrThrow({ where: { flightNumber: 'NV300' } });
    expect(stored.operatingDays).toHaveLength(7);
  });

  it('rejects invalid schedule rules (route/aircraft/range/days/time/number/duplicate)', async () => {
    const token = await loginAs('rules-admin2@test.dev', true);
    const f = await fixtures();
    const valid = baseRule(f, 'NV300');

    await createRule({ ...valid, routeId: randomUUID() }, token).expect(400);
    await createRule({ ...valid, aircraftId: randomUUID() }, token).expect(400);
    await createRule({ ...valid, effectiveFrom: '2026-12-31', effectiveTo: '2026-10-01' }, token).expect(400);
    await createRule({ ...valid, operatingDays: [] }, token).expect(400);
    await createRule({ ...valid, operatingDays: ['FRIDAY'] }, token).expect(400);
    await createRule({ ...valid, departureTimeLocal: '25:00' }, token).expect(400);
    await createRule({ ...valid, flightNumber: 'LH100' }, token).expect(400);

    await createRule(valid, token).expect(201);
    await createRule(valid, token).expect(409);
  });

  it('guards schedule-rule reads (401) and supports activate/deactivate via PATCH', async () => {
    const token = await loginAs('rules-admin3@test.dev', true);
    const f = await fixtures();
    const created = (await createRule(baseRule(f, 'NV300'), token).expect(201)).body;

    await request(app.getHttpServer()).get('/api/schedule-rules').expect(401);
    const list = await request(app.getHttpServer()).get('/api/schedule-rules').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/api/schedule-rules/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(updated.body.status).toBe('INACTIVE');

    await request(app.getHttpServer())
      .patch(`/api/schedule-rules/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(404);
  });

  it('audits SCHEDULE_RULE_CREATED and SCHEDULE_RULE_UPDATED for rule mutations', async () => {
    const token = await loginAs('rules-audit@test.dev', true);
    const actor = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'rules-audit@test.dev' } });
    const f = await fixtures();

    const created = (await createRule(baseRule(f, 'NV300'), token).expect(201)).body;

    const createdAudit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'SCHEDULE_RULE_CREATED', targetId: created.id },
    });
    expect(createdAudit.actorId).toBe(actor.id);
    expect(createdAudit.actorType).toBe('Staff');
    expect(createdAudit.targetType).toBe('ScheduleRule');
    expect(createdAudit.metadata).toEqual({ flightNumber: 'NV300' });

    await request(app.getHttpServer())
      .patch(`/api/schedule-rules/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE' })
      .expect(200);

    const updatedAudit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'SCHEDULE_RULE_UPDATED', targetId: created.id },
    });
    expect(updatedAudit.actorId).toBe(actor.id);
    expect(updatedAudit.metadata).toEqual({ flightNumber: 'NV300', changedFields: ['status'] });
  });

  it('deactivated rules are rejected clearly, existing flights stay untouched, reactivation restores generation', async () => {
    const token = await loginAs('gen-admin4@test.dev', true);
    const f = await fixtures();
    const rule = (await createRule(baseRule(f, 'NV300'), token).expect(201)).body;

    // Manual generation from the ACTIVE rule works.
    const first = await generateRange(token, '2026-10-05', '2026-10-07').expect(201);
    expect(first.body.flightsCreated).toBe(3);

    // Deactivate → generation rejects the rule explicitly and creates nothing.
    await request(app.getHttpServer())
      .patch(`/api/schedule-rules/${rule.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE' })
      .expect(200);

    const second = await generateRange(token, '2026-10-08', '2026-10-09').expect(201);
    expect(second.body.flightsCreated).toBe(0);
    expect(second.body.skippedRules).toEqual([{ flightNumber: 'NV300', reason: 'rule is deactivated' }]);

    // Existing flights remain untouched — no cascade delete, no status change.
    const surviving = await prismaTestClient.flight.findMany({ where: { flightNumber: 'NV300' } });
    expect(surviving).toHaveLength(3);
    expect(surviving.every((x) => x.status === 'SCHEDULED')).toBe(true);

    // Reactivate → generation resumes; overlapping dates stay idempotent.
    await request(app.getHttpServer())
      .patch(`/api/schedule-rules/${rule.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    const third = await generateRange(token, '2026-10-05', '2026-10-07').expect(201);
    expect(third.body.flightsCreated).toBe(0); // same rule+dates → no duplicates
    expect(third.body.flightsUpdated).toBe(3);
    const fourth = await generateRange(token, '2026-10-08', '2026-10-08').expect(201);
    expect(fourth.body.flightsCreated).toBe(1);

    // Both lifecycle toggles are audited as rule updates.
    expect(
      await prismaTestClient.auditLog.count({
        where: { action: 'SCHEDULE_RULE_UPDATED', targetId: rule.id },
      }),
    ).toBe(2);
  });

  // ---------- Flight generation ----------

  it('guards generation: 401 unauthenticated, 403 without flights:manage, 400 invalid ranges', async () => {
    const token = await loginAs('gen-user@test.dev', false);
    const admin = await loginAs('gen-admin@test.dev', true);

    await request(app.getHttpServer()).post('/api/flights/generate').send({ from: '2026-10-01', to: '2026-10-14' }).expect(401);
    await generateRange(token, '2026-10-01', '2026-10-14').expect(403);
    await generateRange(admin, '2026-10-14', '2026-10-01').expect(400);
    await generateRange(admin, '2026-10-01', '2026-12-31').expect(400); // > 62 days
    await generateRange(admin, 'not-a-date', '2026-10-14').expect(400);
  });

  it('generates flights deterministically from rules: operating days, effective range, inactive rules, fares, segments', async () => {
    const token = await loginAs('gen-admin2@test.dev', true);
    const f = await fixtures();

    // Daily FRA→JFK (Berlin origin), M/W/F JFK→FRA (New York origin), one INACTIVE rule.
    await createRule(baseRule(f, 'NV300'), token).expect(201);
    await createRule(
      {
        ...baseRule(f, 'NV301'),
        routeId: f.routeJfkFra.id,
        departureTimeLocal: '09:30',
        operatingDays: ['MON', 'WED', 'FRI'],
      },
      token,
    ).expect(201);
    await createRule({ ...baseRule(f, 'NV302'), status: 'INACTIVE' }, token).expect(201);

    const res = await generateRange(token, '2026-10-05', '2026-10-11').expect(201);
    // The INACTIVE rule is rejected explicitly, not silently ignored.
    expect(res.body).toMatchObject({ rulesEvaluated: 2, flightsCreated: 10, flightsUpdated: 0 });
    expect(res.body.skippedRules).toEqual([{ flightNumber: 'NV302', reason: 'rule is deactivated' }]);

    const flights = await prismaTestClient.flight.findMany({ orderBy: { departureTime: 'asc' } });
    expect(flights).toHaveLength(10);
    expect(flights.filter((x) => x.flightNumber === 'NV300')).toHaveLength(7); // daily Mon–Sun
    expect(flights.filter((x) => x.flightNumber === 'NV301')).toHaveLength(3); // Mon/Wed/Fri
    expect(flights.every((x) => x.status === 'SCHEDULED' && x.scheduleRuleId && x.operatingDate)).toBe(true);

    // One segment and one ECONOMY fare (12-seat test aircraft) per flight.
    expect(await prismaTestClient.flightSegment.count()).toBe(10);
    const fares = await prismaTestClient.fare.findMany();
    expect(fares).toHaveLength(10);
    for (const fare of fares) {
      expect(fare.cabinClass).toBe('ECONOMY');
      expect(fare.currency).toBe('EUR');
      expect(Number(fare.basePrice)).toBe(Math.round(49 + 6201 * 0.06)); // deterministic
    }
  });

  it('computes timezone-correct departure/arrival instants across origin zones', async () => {
    const token = await loginAs('gen-admin3@test.dev', true);
    const f = await fixtures();
    await createRule(baseRule(f, 'NV300'), token).expect(201); // 08:00 Europe/Berlin
    await createRule({ ...baseRule(f, 'NV301'), routeId: f.routeJfkFra.id, departureTimeLocal: '09:30', operatingDays: ['MON'] }, token).expect(201); // 09:30 America/New_York

    await generateRange(token, '2026-10-05', '2026-10-05').expect(201);

    const fra = await prismaTestClient.flight.findFirstOrThrow({ where: { flightNumber: 'NV300' } });
    // 08:00 CEST (UTC+2, DST) = 06:00Z; elapsed = route duration 505 min.
    expect(fra.departureTime.toISOString()).toBe('2026-10-05T06:00:00.000Z');
    expect((fra.arrivalTime.getTime() - fra.departureTime.getTime()) / 60000).toBe(505);

    const jfk = await prismaTestClient.flight.findFirstOrThrow({ where: { flightNumber: 'NV301' } });
    // 09:30 EDT (UTC-4, DST) = 13:30Z; elapsed = 470 min.
    expect(jfk.departureTime.toISOString()).toBe('2026-10-05T13:30:00.000Z');
    expect((jfk.arrivalTime.getTime() - jfk.departureTime.getTime()) / 60000).toBe(470);

    // Same-ish wall times, different UTC instants — origin zone decides.
    expect(jfk.departureTime.getTime()).not.toBe(fra.departureTime.getTime());
  });

  it('is idempotent: regenerating the same range creates nothing and changes no counts', async () => {
    const token = await loginAs('gen-admin4@test.dev', true);
    const f = await fixtures();
    await createRule(baseRule(f, 'NV300'), token).expect(201);
    await createRule({ ...baseRule(f, 'NV301'), routeId: f.routeJfkFra.id, operatingDays: ['MON', 'WED', 'FRI'] }, token).expect(201);

    await generateRange(token, '2026-10-01', '2026-10-14').expect(201);
    const countsBefore = {
      flights: await prismaTestClient.flight.count(),
      fares: await prismaTestClient.fare.count(),
      segments: await prismaTestClient.flightSegment.count(),
    };

    const second = await generateRange(token, '2026-10-01', '2026-10-14').expect(201);
    expect(second.body.flightsCreated).toBe(0);
    expect(second.body.faresCreated).toBe(0);
    expect(second.body.segmentsCreated).toBe(0);
    expect(second.body.flightsUpdated).toBe(countsBefore.flights);

    expect(await prismaTestClient.flight.count()).toBe(countsBefore.flights);
    expect(await prismaTestClient.fare.count()).toBe(countsBefore.fares);
    expect(await prismaTestClient.flightSegment.count()).toBe(countsBefore.segments);
  });

  it('respects effectiveFrom/effectiveTo when generating', async () => {
    const token = await loginAs('gen-admin5@test.dev', true);
    const f = await fixtures();
    await createRule({ ...baseRule(f, 'NV300'), effectiveFrom: '2026-10-07', effectiveTo: '2026-10-09' }, token).expect(201);

    await generateRange(token, '2026-10-01', '2026-10-14').expect(201);
    const flights = await prismaTestClient.flight.findMany();
    expect(flights).toHaveLength(3);
    expect(flights.map((x) => x.operatingDate!.toISOString().slice(0, 10)).sort()).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
  });

  // ---------- Flights API ----------

  it('audits FLIGHTS_GENERATED once per successful run with summary counts; failed runs write nothing', async () => {
    const token = await loginAs('audit-ops@test.dev', true);
    const actor = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'audit-ops@test.dev' } });
    const f = await fixtures();
    await createRule(baseRule(f, 'NV300'), token).expect(201);

    const res = await generateRange(token, '2026-10-05', '2026-10-11').expect(201);
    expect(res.body.flightsCreated).toBeGreaterThan(1);

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'FLIGHTS_GENERATED' } });
    expect(audit.actorId).toBe(actor.id);
    expect(audit.actorType).toBe('Staff');
    expect(audit.targetType).toBe('Flight');
    const metadata = audit.metadata as Record<string, unknown>;
    expect(metadata['flightsCreated']).toBe(res.body.flightsCreated);
    expect(metadata['flightsUpdated']).toBe(res.body.flightsUpdated);

    // One summary row per run — not one row per generated flight.
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHTS_GENERATED' } })).toBe(1);

    await generateRange(token, '2026-10-14', '2026-10-01').expect(400);
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHTS_GENERATED' } })).toBe(1);
  });

  it('GET /api/flights is public and filters by origin, destination and date from PostgreSQL', async () => {
    const token = await loginAs('gen-admin6@test.dev', true);
    const f = await fixtures();
    await createRule(baseRule(f, 'NV300'), token).expect(201);
    await createRule({ ...baseRule(f, 'NV301'), routeId: f.routeJfkFra.id, operatingDays: ['MON', 'WED', 'FRI'] }, token).expect(201);
    await generateRange(token, '2026-10-05', '2026-10-11').expect(201);

    const all = await request(app.getHttpServer()).get('/api/flights').expect(200);
    expect(all.body).toHaveLength(10);
    expect(all.body[0]).toHaveProperty('route.originAirport.iataCode');
    expect(all.body[0]).toHaveProperty('fares[0].basePrice');
    expect(typeof all.body[0].fares[0].basePrice).toBe('number');

    const fromFra = await request(app.getHttpServer()).get('/api/flights?origin=FRA').expect(200);
    expect(fromFra.body).toHaveLength(7);
    expect(fromFra.body.every((x: { flightNumber: string }) => x.flightNumber === 'NV300')).toBe(true);

    const toFra = await request(app.getHttpServer()).get('/api/flights?destination=FRA').expect(200);
    expect(toFra.body).toHaveLength(3);

    const onTuesday = await request(app.getHttpServer()).get('/api/flights?date=2026-10-06').expect(200);
    expect(onTuesday.body).toHaveLength(1);
    expect(onTuesday.body[0].flightNumber).toBe('NV300');

    const range = await request(app.getHttpServer()).get('/api/flights?from=2026-10-07&to=2026-10-09').expect(200);
    expect(range.body).toHaveLength(5); // NV300 ×3 + NV301 ×2 (Wed/Fri)

    await request(app.getHttpServer()).get('/api/flights?origin=fr').expect(400);
    await request(app.getHttpServer()).get('/api/flights?date=05-10-2026').expect(400);
  });

  it('GET /api/flights paginates only when page/limit is provided', async () => {
    const token = await loginAs('gen-admin8@test.dev', true);
    const f = await fixtures();
    await createRule(baseRule(f, 'NV300'), token).expect(201);
    await createRule({ ...baseRule(f, 'NV301'), routeId: f.routeJfkFra.id, operatingDays: ['MON', 'WED', 'FRI'] }, token).expect(201);
    await generateRange(token, '2026-10-05', '2026-10-11').expect(201);

    // No pagination params → legacy bare array, unchanged shape.
    const legacy = await request(app.getHttpServer()).get('/api/flights').expect(200);
    expect(Array.isArray(legacy.body)).toBe(true);
    expect(legacy.body).toHaveLength(10);

    // Paginated envelope: page/limit echoed, totals computed from the same filters.
    const page1 = await request(app.getHttpServer()).get('/api/flights?page=1&limit=4').expect(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 4, total: 10, totalPages: 3 });
    expect(page1.body.items).toHaveLength(4);
    expect(page1.body.items[0]).toHaveProperty('route.originAirport.iataCode');
    expect(typeof page1.body.items[0].fares[0].basePrice).toBe('number');

    const page3 = await request(app.getHttpServer()).get('/api/flights?page=3&limit=4').expect(200);
    expect(page3.body.items).toHaveLength(2);

    // A lone limit defaults page to 1; a lone page defaults limit to 20.
    const onlyLimit = await request(app.getHttpServer()).get('/api/flights?limit=3').expect(200);
    expect(onlyLimit.body.page).toBe(1);
    expect(onlyLimit.body.items).toHaveLength(3);
    const onlyPage = await request(app.getHttpServer()).get('/api/flights?page=1').expect(200);
    expect(onlyPage.body.limit).toBe(20);
    expect(onlyPage.body.items).toHaveLength(10);

    // Empty result set → total 0, totalPages 1, empty items.
    const empty = await request(app.getHttpServer()).get('/api/flights?date=2026-10-12&page=1&limit=5').expect(200);
    expect(empty.body).toMatchObject({ page: 1, limit: 5, total: 0, totalPages: 1 });
    expect(empty.body.items).toHaveLength(0);

    // Existing filters still apply in paginated mode.
    const filtered = await request(app.getHttpServer()).get('/api/flights?origin=FRA&page=1&limit=10').expect(200);
    expect(filtered.body.total).toBe(7);
    expect(filtered.body.items.every((x: { flightNumber: string }) => x.flightNumber === 'NV300')).toBe(true);

    // Validation: positive integers, limit capped at 100.
    await request(app.getHttpServer()).get('/api/flights?page=0').expect(400);
    await request(app.getHttpServer()).get('/api/flights?page=abc').expect(400);
    await request(app.getHttpServer()).get('/api/flights?limit=0').expect(400);
    await request(app.getHttpServer()).get('/api/flights?limit=101').expect(400);
  });

  it('GET /api/flights/:id returns full detail, 404 unknown, 400 malformed', async () => {
    const token = await loginAs('gen-admin7@test.dev', true);
    const f = await fixtures();
    await createRule(baseRule(f, 'NV300'), token).expect(201);
    await generateRange(token, '2026-10-05', '2026-10-05').expect(201);
    const flight = await prismaTestClient.flight.findFirstOrThrow();

    const res = await request(app.getHttpServer()).get(`/api/flights/${flight.id}`).expect(200);
    expect(res.body).toMatchObject({ flightNumber: 'NV300', status: 'SCHEDULED' });
    expect(res.body.aircraft.registration).toBe('NV-T100');
    expect(res.body.segments).toHaveLength(1);
    expect(res.body.scheduleRule.flightNumber).toBe('NV300');

    await request(app.getHttpServer()).get(`/api/flights/${randomUUID()}`).expect(404);
    await request(app.getHttpServer()).get('/api/flights/not-a-uuid').expect(400);
  });
});
