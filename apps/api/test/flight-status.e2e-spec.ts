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
 * PATCH /api/flights/:id/status — lifecycle transitions, permission gating,
 * and FLIGHT_STATUS_CHANGED audit persistence. Fixtures are Prisma-level and
 * flight-only: no bookings, payments, or seat holds involved.
 */
describe('Flight status management (e2e)', () => {
  let app: INestApplication<App>;
  let flightManagerRoleId: string;
  let flightId: string;

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
    const role = await prismaTestClient.role.create({
      data: { name: 'Flight Manager', isSuperAdmin: false },
    });
    flightManagerRoleId = role.id;
    await prismaTestClient.rolePermission.create({
      data: { roleId: role.id, permissionId: manage.id },
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
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-ST01', model: 'Test Jet 100', capacity: 12 },
    });
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV990',
        routeId: route.id,
        aircraftId: aircraft.id,
        operatingDate: new Date('2026-10-05T00:00:00Z'),
        departureTime: new Date('2026-10-05T06:00:00Z'),
        arrivalTime: new Date('2026-10-05T14:00:00Z'),
        status: 'SCHEDULED',
      },
    });
    flightId = flight.id;
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

  function patchStatus(token: string | null, id: string, status: string) {
    const req = request(app.getHttpServer()).patch(`/api/flights/${id}/status`).send({ status });
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  }

  const currentStatus = async () =>
    (await prismaTestClient.flight.findUniqueOrThrow({ where: { id: flightId } })).status;

  it('Flight Manager performs an allowed transition; it persists and audits actor, flight, previous and new status', async () => {
    const token = await loginAs('fm@status.test', true);
    const actor = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'fm@status.test' } });

    const res = await patchStatus(token, flightId, 'BOARDING').expect(200);
    expect(res.body.status).toBe('BOARDING');
    expect(await currentStatus()).toBe('BOARDING');

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'FLIGHT_STATUS_CHANGED' } });
    expect(audit.actorId).toBe(actor.id);
    expect(audit.actorType).toBe('Staff');
    expect(audit.targetType).toBe('Flight');
    expect(audit.targetId).toBe(flightId);
    expect(audit.metadata).toEqual({ previousStatus: 'SCHEDULED', newStatus: 'BOARDING' });
  });

  it('walks the full lifecycle SCHEDULED → BOARDING → DEPARTED → ARRIVED → COMPLETED', async () => {
    const token = await loginAs('fm2@status.test', true);

    for (const next of ['BOARDING', 'DEPARTED', 'ARRIVED', 'COMPLETED']) {
      await patchStatus(token, flightId, next).expect(200);
      expect(await currentStatus()).toBe(next);
    }
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_STATUS_CHANGED' } })).toBe(4);
  });

  it('SCHEDULED → CANCELLED is allowed and terminal: nothing leaves CANCELLED', async () => {
    const token = await loginAs('fm3@status.test', true);

    await patchStatus(token, flightId, 'CANCELLED').expect(200);
    expect(await currentStatus()).toBe('CANCELLED');

    for (const next of ['SCHEDULED', 'BOARDING', 'COMPLETED']) {
      await patchStatus(token, flightId, next).expect(400);
    }
    expect(await currentStatus()).toBe('CANCELLED');
  });

  it('rejects invalid jumps (SCHEDULED → COMPLETED/DEPARTED/ARRIVED) without persisting or auditing', async () => {
    const token = await loginAs('fm4@status.test', true);

    for (const next of ['COMPLETED', 'DEPARTED', 'ARRIVED']) {
      await patchStatus(token, flightId, next).expect(400);
    }
    expect(await currentStatus()).toBe('SCHEDULED');
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_STATUS_CHANGED' } })).toBe(0);
  });

  it('rejects transitions out of COMPLETED', async () => {
    const token = await loginAs('fm5@status.test', true);
    for (const next of ['BOARDING', 'DEPARTED', 'ARRIVED', 'COMPLETED']) {
      await patchStatus(token, flightId, next).expect(200);
    }

    await patchStatus(token, flightId, 'SCHEDULED').expect(400);
    await patchStatus(token, flightId, 'BOARDING').expect(400);
    expect(await currentStatus()).toBe('COMPLETED');
  });

  it('returns 403 for a user without flights:manage and 401 unauthenticated', async () => {
    const customer = await loginAs('customer@status.test', false);

    await patchStatus(customer, flightId, 'BOARDING').expect(403);
    await patchStatus(null, flightId, 'BOARDING').expect(401);
    expect(await currentStatus()).toBe('SCHEDULED');
  });

  it('rejects a stale concurrent transition with 409 and audits exactly one change', async () => {
    const token = await loginAs('fm7@status.test', true);

    // Both requests race on the same SCHEDULED flight; exactly one commits.
    // The loser either fails transition validation (400, if it re-read the
    // already-updated status) or loses the compare-and-set (409, if it read
    // before the winner committed) — both are correct rejections.
    const [a, b] = await Promise.all([
      patchStatus(token, flightId, 'BOARDING'),
      patchStatus(token, flightId, 'BOARDING'),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);

    expect(await currentStatus()).toBe('BOARDING');
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_STATUS_CHANGED' } })).toBe(1);
  });

  it('returns 404 for an unknown flight and 400 for a malformed status value', async () => {
    const token = await loginAs('fm6@status.test', true);

    await patchStatus(token, randomUUID(), 'BOARDING').expect(404);
    await patchStatus(token, flightId, 'FLYING').expect(400);
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_STATUS_CHANGED' } })).toBe(0);
  });
});
