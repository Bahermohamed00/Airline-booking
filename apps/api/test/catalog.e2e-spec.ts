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
 * Phase 2 catalog API: Airports → Routes → Aircraft → Seats backed by Prisma/
 * PostgreSQL. Public reads, permission-guarded mutations, DTO validation,
 * 400/404/409 mapping and seat-map generation on aircraft creation.
 */
describe('Catalog API (e2e)', () => {
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

    for (const resource of ['airports', 'routes', 'aircraft']) {
      await prismaTestClient.permission.upsert({
        where: { resource_action: { resource, action: 'manage' } },
        update: {},
        create: { resource, action: 'manage' },
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
        { iataCode: 'FRA', icaoCode: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin', latitude: 50.0379, longitude: 8.5622 },
        { iataCode: 'JFK', icaoCode: 'KJFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      ],
    });
  });

  async function loginAs(email: string, superAdmin: boolean): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Catalog', lastName: 'Actor' });
    if (superAdmin) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: superAdminRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const fra = () => prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } });
  const jfk = () => prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } });

  // ---------- Public reads ----------

  it('GET /api/airports is public and returns airports ordered by IATA code', async () => {
    const res = await request(app.getHttpServer()).get('/api/airports').expect(200);
    expect(res.body.map((a: { iataCode: string }) => a.iataCode)).toEqual(['FRA', 'JFK']);
    const frankfurt = res.body[0];
    expect(frankfurt).toMatchObject({ iataCode: 'FRA', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' });
    expect(typeof frankfurt.latitude).toBe('number');
    expect(frankfurt.latitude).toBeCloseTo(50.0379);
  });

  it('GET /api/airports/:id returns one airport, 404 for unknown id, 400 for malformed id', async () => {
    const airport = await fra();
    const res = await request(app.getHttpServer()).get(`/api/airports/${airport.id}`).expect(200);
    expect(res.body.iataCode).toBe('FRA');

    await request(app.getHttpServer()).get(`/api/airports/${randomUUID()}`).expect(404);
    await request(app.getHttpServer()).get('/api/airports/not-a-uuid').expect(400);
  });

  it('GET /api/routes and GET /api/aircraft are public and return empty lists before data exists', async () => {
    const routes = await request(app.getHttpServer()).get('/api/routes').expect(200);
    expect(routes.body).toEqual([]);
    const aircraft = await request(app.getHttpServer()).get('/api/aircraft').expect(200);
    expect(aircraft.body).toEqual([]);
  });

  it('GET /api/aircraft/:id/seats returns 404 for a nonexistent aircraft', async () => {
    await request(app.getHttpServer()).get(`/api/aircraft/${randomUUID()}/seats`).expect(404);
  });

  // ---------- Airports mutations ----------

  it('POST /api/airports requires authentication (401) and permission (403)', async () => {
    const body = { iataCode: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', timezone: 'Europe/Berlin' };
    await request(app.getHttpServer()).post('/api/airports').send(body).expect(401);

    const token = await loginAs('customer@catalog.test', false);
    await request(app.getHttpServer()).post('/api/airports').set('Authorization', `Bearer ${token}`).send(body).expect(403);
  });

  it('POST /api/airports creates and persists an airport; duplicate IATA → 409', async () => {
    const token = await loginAs('admin@catalog.test', true);
    const body = { iataCode: 'muc', name: 'Munich Airport', city: 'Munich', country: 'Germany', timezone: 'Europe/Berlin' };

    const res = await request(app.getHttpServer()).post('/api/airports').set('Authorization', `Bearer ${token}`).send(body).expect(201);
    expect(res.body.iataCode).toBe('MUC'); // uppercased by transform

    const stored = await prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'MUC' } });
    expect(stored.name).toBe('Munich Airport');

    await request(app.getHttpServer()).post('/api/airports').set('Authorization', `Bearer ${token}`).send(body).expect(409);
    await request(app.getHttpServer()).post('/api/airports').set('Authorization', `Bearer ${token}`).send({ ...body, iataCode: 'FRA' }).expect(409);
  });

  it('POST /api/airports rejects invalid bodies with 400', async () => {
    const token = await loginAs('admin2@catalog.test', true);
    const base = { iataCode: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', timezone: 'Europe/Berlin' };
    const post = (body: unknown) =>
      request(app.getHttpServer()).post('/api/airports').set('Authorization', `Bearer ${token}`).send(body as Record<string, unknown>);

    await post({ ...base, iataCode: 'MU' }).expect(400); // too short
    await post({ ...base, icaoCode: 'eddmX' }).expect(400); // not 4 letters
    await post({ ...base, latitude: 91 }).expect(400); // out of range
    await post({ ...base, unexpected: 'field' }).expect(400); // forbidNonWhitelisted
  });

  it('PATCH /api/airports/:id updates fields and status; 404 unknown, 409 on IATA clash', async () => {
    const token = await loginAs('admin3@catalog.test', true);
    const airport = await fra();

    const res = await request(app.getHttpServer())
      .patch(`/api/airports/${airport.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Frankfurt am Main', status: 'INACTIVE' })
      .expect(200);
    expect(res.body).toMatchObject({ city: 'Frankfurt am Main', status: 'INACTIVE' });

    await request(app.getHttpServer()).patch(`/api/airports/${airport.id}`).set('Authorization', `Bearer ${token}`).send({ iataCode: 'JFK' }).expect(409);
    await request(app.getHttpServer()).patch(`/api/airports/${randomUUID()}`).set('Authorization', `Bearer ${token}`).send({ city: 'X' }).expect(404);
  });

  // ---------- Routes mutations ----------

  it('POST /api/routes creates a route with nested airports; duplicate pair → 409', async () => {
    const token = await loginAs('admin4@catalog.test', true);
    const [origin, destination] = [await fra(), await jfk()];

    const res = await request(app.getHttpServer())
      .post('/api/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ originAirportId: origin.id, destinationAirportId: destination.id, distanceKm: 6201, durationMinutes: 505 })
      .expect(201);
    expect(res.body).toMatchObject({ distanceKm: 6201, durationMinutes: 505, status: 'ACTIVE' });
    expect(res.body.originAirport.iataCode).toBe('FRA');
    expect(res.body.destinationAirport.iataCode).toBe('JFK');

    const list = await request(app.getHttpServer()).get('/api/routes').expect(200);
    expect(list.body).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/api/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ originAirportId: origin.id, destinationAirportId: destination.id })
      .expect(409);
  });

  it('POST /api/routes rejects origin = destination, unknown airports and invalid numbers', async () => {
    const token = await loginAs('admin5@catalog.test', true);
    const origin = await fra();
    const post = (body: unknown) =>
      request(app.getHttpServer()).post('/api/routes').set('Authorization', `Bearer ${token}`).send(body as Record<string, unknown>);

    await post({ originAirportId: origin.id, destinationAirportId: origin.id }).expect(400);
    await post({ originAirportId: origin.id, destinationAirportId: randomUUID() }).expect(400);
    await post({ originAirportId: origin.id, destinationAirportId: (await jfk()).id, distanceKm: 0 }).expect(400);
    await post({ originAirportId: origin.id, destinationAirportId: (await jfk()).id, durationMinutes: -5 }).expect(400);
  });

  it('GET/PATCH /api/routes/:id — 404 unknown, 409 moving onto another pair', async () => {
    const token = await loginAs('admin6@catalog.test', true);
    const [origin, destination] = [await fra(), await jfk()];
    const muc = await prismaTestClient.airport.create({
      data: { iataCode: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', timezone: 'Europe/Berlin' },
    });
    const mk = async (a: string, b: string) =>
      prismaTestClient.route.create({ data: { originAirportId: a, destinationAirportId: b } });
    const first = await mk(origin.id, destination.id);
    const second = await mk(origin.id, muc.id);

    const res = await request(app.getHttpServer()).get(`/api/routes/${first.id}`).expect(200);
    expect(res.body.originAirport.iataCode).toBe('FRA');
    await request(app.getHttpServer()).get(`/api/routes/${randomUUID()}`).expect(404);

    const updated = await request(app.getHttpServer())
      .patch(`/api/routes/${first.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ distanceKm: 6201, status: 'INACTIVE' })
      .expect(200);
    expect(updated.body).toMatchObject({ distanceKm: 6201, status: 'INACTIVE' });

    await request(app.getHttpServer())
      .patch(`/api/routes/${second.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ destinationAirportId: destination.id })
      .expect(409);
  });

  // ---------- Aircraft mutations + seats ----------

  it('POST /api/aircraft creates the aircraft with its full seat map; duplicate registration → 409', async () => {
    const token = await loginAs('admin7@catalog.test', true);

    const res = await request(app.getHttpServer())
      .post('/api/aircraft')
      .set('Authorization', `Bearer ${token}`)
      .send({ registration: 'nv-738z', model: 'Boeing 737-800', capacity: 180 })
      .expect(201);
    expect(res.body).toMatchObject({ registration: 'NV-738Z', seatCount: 180 });

    const seats = await prismaTestClient.seat.findMany({ where: { aircraftId: res.body.id } });
    expect(seats).toHaveLength(180);
    expect(new Set(seats.map((s) => s.seatNumber)).size).toBe(180);

    await request(app.getHttpServer())
      .post('/api/aircraft')
      .set('Authorization', `Bearer ${token}`)
      .send({ registration: 'NV-738Z', model: 'Boeing 737-800', capacity: 180 })
      .expect(409);
  });

  it('POST /api/aircraft rejects invalid capacity/registration with 400', async () => {
    const token = await loginAs('admin8@catalog.test', true);
    const post = (body: unknown) =>
      request(app.getHttpServer()).post('/api/aircraft').set('Authorization', `Bearer ${token}`).send(body as Record<string, unknown>);

    await post({ registration: 'NV-700A', model: 'Test', capacity: 5 }).expect(400);
    await post({ registration: 'NV-700A', model: 'Test', capacity: 601 }).expect(400);
    await post({ registration: 'bad reg!', model: 'Test', capacity: 180 }).expect(400);
    await post({ registration: 'NV-700A', capacity: 180 }).expect(400); // missing model
  });

  it('GET /api/aircraft/:id/seats returns only that aircraft’s seats in row/column order', async () => {
    const token = await loginAs('admin9@catalog.test', true);
    const create = (registration: string) =>
      request(app.getHttpServer())
        .post('/api/aircraft')
        .set('Authorization', `Bearer ${token}`)
        .send({ registration, model: 'Airbus A320-200', capacity: 12 });

    const first = (await create('NV-T001')).body.id as string;
    const second = (await create('NV-T002')).body.id as string;

    const res = await request(app.getHttpServer()).get(`/api/aircraft/${first}/seats`).expect(200);
    expect(res.body).toHaveLength(12);
    expect(res.body.every((s: { aircraftId: string }) => s.aircraftId === first)).toBe(true);
    expect(res.body.map((s: { seatNumber: string }) => s.seatNumber)).toEqual(['1A', '1B', '1C', '1D', '1E', '1F', '2A', '2B', '2C', '2D', '2E', '2F']);

    const other = await request(app.getHttpServer()).get(`/api/aircraft/${second}/seats`).expect(200);
    expect(other.body.every((s: { aircraftId: string }) => s.aircraftId === second)).toBe(true);
  });

  it('PATCH /api/aircraft/:id updates status and registration; 404 unknown, 409 clash', async () => {
    const token = await loginAs('admin10@catalog.test', true);
    const create = (registration: string) =>
      request(app.getHttpServer())
        .post('/api/aircraft')
        .set('Authorization', `Bearer ${token}`)
        .send({ registration, model: 'Airbus A320-200', capacity: 12 });
    const first = (await create('NV-T003')).body;
    await create('NV-T004');

    const res = await request(app.getHttpServer())
      .patch(`/api/aircraft/${first.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'MAINTENANCE' })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'MAINTENANCE', seatCount: 12 });

    await request(app.getHttpServer())
      .patch(`/api/aircraft/${first.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ registration: 'NV-T004' })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/aircraft/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'RETIRED' })
      .expect(404);
  });
});
