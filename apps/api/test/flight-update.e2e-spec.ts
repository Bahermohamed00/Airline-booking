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
 * PATCH /api/flights/:id (schedule-time editing) and the cancellation guard.
 * Fixtures are Prisma-level; booking rows exist only to prove the Flight-side
 * cancellation boundary — no booking/payment logic is exercised.
 */
describe('Flight update & cancellation guard (e2e)', () => {
  let app: INestApplication<App>;
  let flightManagerRoleId: string;
  let flightId: string;
  let segmentId: string;
  let seatId: string;

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
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-UP01', model: 'Test Jet 100', capacity: 12 },
    });
    const seat = await prismaTestClient.seat.create({
      data: { aircraftId: aircraft.id, seatNumber: '1A', cabinClass: 'ECONOMY', seatRow: 1, seatColumn: 'A', features: {} },
    });
    seatId = seat.id;
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV880',
        routeId: route.id,
        aircraftId: aircraft.id,
        operatingDate: new Date('2026-10-05T00:00:00Z'),
        departureTime: new Date('2026-10-05T12:00:00Z'),
        arrivalTime: new Date('2026-10-05T14:00:00Z'),
        status: 'SCHEDULED',
      },
    });
    flightId = flight.id;
    const segment = await prismaTestClient.flightSegment.create({
      data: {
        flightId,
        segmentNumber: 1,
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        departureTime: new Date('2026-10-05T12:00:00Z'),
        arrivalTime: new Date('2026-10-05T14:00:00Z'),
      },
    });
    segmentId = segment.id;
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

  /** Minimal confirmed-booking chain referencing the flight (read-only usage by the guard). */
  async function bookActiveSeat(email: string): Promise<void> {
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
    const passenger = await prismaTestClient.passenger.create({
      data: { userId: user.id, firstName: 'Ops', lastName: 'Tester' },
    });
    const booking = await prismaTestClient.booking.create({
      data: {
        bookingReference: 'BKTEST1',
        userId: user.id,
        status: 'CONFIRMED',
        totalAmount: 100,
        currency: 'EUR',
        contactEmail: email,
      },
    });
    const bp = await prismaTestClient.bookingPassenger.create({
      data: { bookingId: booking.id, passengerId: passenger.id },
    });
    await prismaTestClient.bookingSeat.create({
      data: { bookingPassengerId: bp.id, flightSegmentId: segmentId, seatId, seatNumber: '1A' },
    });
  }

  it('edits schedule times, persists them, syncs segment times, and audits FLIGHT_UPDATED', async () => {
    const token = await loginAs('fm@update.test', true);
    const actor = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'fm@update.test' } });

    const res = await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ departureTime: '2026-10-05T13:30:00Z', arrivalTime: '2026-10-05T15:30:00Z' })
      .expect(200);
    expect(res.body.departureTime).toBe('2026-10-05T13:30:00.000Z');

    const flight = await prismaTestClient.flight.findUniqueOrThrow({ where: { id: flightId } });
    expect(flight.departureTime.toISOString()).toBe('2026-10-05T13:30:00.000Z');
    expect(flight.status).toBe('SCHEDULED'); // edits never touch the lifecycle
    const segment = await prismaTestClient.flightSegment.findUniqueOrThrow({ where: { id: segmentId } });
    expect(segment.departureTime.toISOString()).toBe('2026-10-05T13:30:00.000Z');

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'FLIGHT_UPDATED' } });
    expect(audit.actorId).toBe(actor.id);
    expect(audit.actorType).toBe('Staff');
    expect(audit.targetType).toBe('Flight');
    expect(audit.targetId).toBe(flightId);
    expect(audit.metadata).toEqual({
      flightNumber: 'NV880',
      changedFields: ['departureTime', 'arrivalTime'],
    });
  });

  it('rejects inverted times with 400 and writes no audit', async () => {
    const token = await loginAs('fm2@update.test', true);

    await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ arrivalTime: '2026-10-05T11:00:00Z' })
      .expect(400);

    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_UPDATED' } })).toBe(0);
  });

  it('rejects editing a CANCELLED flight with 409 (never resurrected)', async () => {
    const token = await loginAs('fm3@update.test', true);
    await prismaTestClient.flight.update({ where: { id: flightId }, data: { status: 'CANCELLED' } });

    await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ departureTime: '2026-10-05T13:00:00Z' })
      .expect(409);
  });

  it('requires authentication and flights:manage for edits', async () => {
    const customer = await loginAs('customer@update.test', false);

    await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}`)
      .send({ departureTime: '2026-10-05T13:00:00Z' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}`)
      .set('Authorization', `Bearer ${customer}`)
      .send({ departureTime: '2026-10-05T13:00:00Z' })
      .expect(403);
  });

  it('blocks cancellation with 409 while active bookings reference the flight', async () => {
    const token = await loginAs('fm4@update.test', true);
    await bookActiveSeat('fm4@update.test');

    await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' })
      .expect(409);

    const flight = await prismaTestClient.flight.findUniqueOrThrow({ where: { id: flightId } });
    expect(flight.status).toBe('SCHEDULED');
    expect(await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_STATUS_CHANGED' } })).toBe(0);
  });

  it('allows cancellation once no active bookings reference the flight', async () => {
    const token = await loginAs('fm5@update.test', true);

    await request(app.getHttpServer())
      .patch(`/api/flights/${flightId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    const flight = await prismaTestClient.flight.findUniqueOrThrow({ where: { id: flightId } });
    expect(flight.status).toBe('CANCELLED');
  });
});
