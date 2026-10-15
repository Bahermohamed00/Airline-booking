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
 * GET /api/admin/flights/completed — completed-flight operational report:
 * filtering, pagination, authorization, booked-seat counts. Read-only;
 * no financial data is exposed.
 */
describe('Completed-flights report (e2e)', () => {
  let app: INestApplication<App>;
  let readerRoleId: string;

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

    const read = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'flights', action: 'read' } },
      update: {},
      create: { resource: 'flights', action: 'read' },
    });
    const role = await prismaTestClient.role.create({ data: { name: 'Flight Manager', isSuperAdmin: false } });
    readerRoleId = role.id;
    await prismaTestClient.rolePermission.create({ data: { roleId: role.id, permissionId: read.id } });

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
      data: { registration: 'NV-CP01', model: 'Test Jet 100', capacity: 12 },
    });

    const mk = (flightNumber: string, status: string, operatingDate: string, arrivalTime: string) =>
      prismaTestClient.flight.create({
        data: {
          flightNumber,
          routeId: route.id,
          aircraftId: aircraft.id,
          operatingDate: new Date(`${operatingDate}T00:00:00Z`),
          departureTime: new Date(`${operatingDate}T08:00:00Z`),
          arrivalTime: new Date(arrivalTime),
          status: status as never,
        },
      });

    await mk('NV100', 'COMPLETED', '2026-10-01', '2026-10-01T16:00:00Z');
    await mk('NV101', 'COMPLETED', '2026-10-02', '2026-10-02T16:00:00Z');
    await mk('NV200', 'SCHEDULED', '2026-10-03', '2026-10-03T16:00:00Z');
    await mk('NV300', 'CANCELLED', '2026-10-04', '2026-10-04T16:00:00Z');
  });

  async function loginAs(email: string, reader: boolean): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Ops', lastName: 'Tester' });
    if (reader) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: readerRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  function getReport(token: string | null, query = '') {
    const req = request(app.getHttpServer()).get(`/api/admin/flights/completed${query}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  }

  it('returns only COMPLETED flights, newest arrival first, with operational fields and no financial data', async () => {
    const token = await loginAs('reader@report.test', true);

    const res = await getReport(token).expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.items.map((f: { flightNumber: string }) => f.flightNumber)).toEqual(['NV101', 'NV100']);
    const item = res.body.items[0];
    expect(item.status).toBe('COMPLETED');
    expect(item.route.origin.iataCode).toBe('FRA');
    expect(item.route.destination.iataCode).toBe('JFK');
    expect(item.aircraft.registration).toBe('NV-CP01');
    expect(item.bookedSeats).toBe(0);
    const raw = JSON.stringify(res.body);
    for (const forbidden of ['totalAmount', 'payment', 'revenue', 'refund', 'price']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('filters by flightNumber and operating-date range', async () => {
    const token = await loginAs('reader2@report.test', true);

    const byNumber = await getReport(token, '?flightNumber=nv100').expect(200);
    expect(byNumber.body.items.map((f: { flightNumber: string }) => f.flightNumber)).toEqual(['NV100']);

    const byRange = await getReport(token, '?from=2026-10-02&to=2026-10-02').expect(200);
    expect(byRange.body.items.map((f: { flightNumber: string }) => f.flightNumber)).toEqual(['NV101']);
  });

  it('paginates with page/limit and correct totals', async () => {
    const token = await loginAs('reader3@report.test', true);

    const page1 = await getReport(token, '?page=1&limit=1').expect(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.total).toBe(2);
    expect(page1.body.totalPages).toBe(2);

    const page2 = await getReport(token, '?page=2&limit=1').expect(200);
    expect(page2.body.items[0].flightNumber).not.toBe(page1.body.items[0].flightNumber);

    await getReport(token, '?page=0').expect(400);
    await getReport(token, '?limit=101').expect(400);
  });

  it('returns 401 unauthenticated and 403 without flights:read', async () => {
    const customer = await loginAs('customer@report.test', false);

    await getReport(null).expect(401);
    await getReport(customer).expect(403);
  });
});
