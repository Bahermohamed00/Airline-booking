import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SeatHoldsService } from '../src/bookings/seat-holds.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Phase 4: Booking domain — transactional creation with passengers + seat
 * holds, ownership, cancellation, hold expiration, concurrency, admin reads.
 */
describe('Bookings (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let superAdminRoleId: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
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

    await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'bookings', action: 'read' } },
      update: {},
      create: { resource: 'bookings', action: 'read' },
    });
    const superAdmin = await prismaTestClient.role.upsert({
      where: { name: 'Super Admin' },
      update: { isSuperAdmin: true },
      create: { name: 'Super Admin', isSuperAdmin: true },
    });
    superAdminRoleId = superAdmin.id;

    await prismaTestClient.airport.createMany({
      data: [
        { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
        { iataCode: 'JFK', name: 'JFK International', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      ],
    });
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } }),
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } }),
    ]);
    await prismaTestClient.route.create({ data: { originAirportId: fra.id, destinationAirportId: jfk.id, distanceKm: 6201, durationMinutes: 505 } });

    const small = await prismaTestClient.aircraft.create({ data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 } });
    const large = await prismaTestClient.aircraft.create({ data: { registration: 'NV-T220', model: 'Test Jet 220', capacity: 220 } });
    for (const ac of [small, large]) {
      await prismaTestClient.seat.createMany({
        data: generateSeatMap(ac.capacity).map((s) => ({ ...s, aircraftId: ac.id, features: {} })),
      });
    }

    const route = await prismaTestClient.route.findFirstOrThrow();
    await makeFlight(route.id, small.id, 'SCHEDULED', 2 * 86_400_000);
    await makeFlight(route.id, small.id, 'CANCELLED', 2 * 86_400_000);
    await makeFlight(route.id, small.id, 'SCHEDULED', -86_400_000); // departed
    await makeFlight(route.id, large.id, 'SCHEDULED', 2 * 86_400_000);
  });

  async function makeFlight(routeId: string, aircraftId: string, status: 'SCHEDULED' | 'CANCELLED', offsetMs: number) {
    const departure = new Date(Date.now() + offsetMs);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV900',
        routeId,
        aircraftId,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
        status,
      },
    });
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: (await prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } })).id,
        destinationAirportId: (await prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } })).id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
      },
    });
    await prismaTestClient.fare.create({
      data: { flightId: flight.id, cabinClass: 'ECONOMY', basePrice: 421, taxAmount: 67, feeAmount: 17, currency: 'EUR', availableCount: 200 },
    });
    return flight;
  }

  async function loginAs(email: string, superAdmin = false): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Booking', lastName: 'Actor' });
    if (superAdmin) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: superAdminRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const fixtures = async () => {
    const [flight, cancelledFlight, departedFlight, largeFlight, seatsSmall, seatsLarge] = await Promise.all([
      prismaTestClient.flight.findFirstOrThrow({ where: { status: 'SCHEDULED', departureTime: { gt: new Date() }, aircraft: { registration: 'NV-T100' } } }),
      prismaTestClient.flight.findFirstOrThrow({ where: { status: 'CANCELLED' } }),
      prismaTestClient.flight.findFirstOrThrow({ where: { departureTime: { lt: new Date() } } }),
      prismaTestClient.flight.findFirstOrThrow({ where: { aircraft: { registration: 'NV-T220' } } }),
      prismaTestClient.seat.findMany({ where: { aircraft: { registration: 'NV-T100' } }, orderBy: { seatNumber: 'asc' } }),
      prismaTestClient.seat.findMany({ where: { aircraft: { registration: 'NV-T220' } }, orderBy: { seatNumber: 'asc' } }),
    ]);
    return { flight, cancelledFlight, departedFlight, largeFlight, seatsSmall, seatsLarge };
  };

  const bodyFor = (flightId: string, seatIds: string[], passengers = 1) => ({
    flightId,
    cabinClass: 'ECONOMY',
    seatIds,
    passengers: Array.from({ length: passengers }, (_, i) => ({
      firstName: `Pass${i + 1}`,
      lastName: 'Tester',
      passengerType: 'ADULT',
      dateOfBirth: '1990-01-01',
    })),
  });

  function createBooking(token: string | null, body: unknown) {
    const req = request(app.getHttpServer()).post('/api/bookings');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body as Record<string, unknown>);
  }

  // ---------- Creation ----------

  it('rejects unauthenticated booking creation with 401', async () => {
    await createBooking(null, {}).expect(401);
  });

  it('creates a real booking: PENDING, server reference, DB-fare totals, passenger, active hold, audit', async () => {
    const token = await loginAs('creator@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const seatIds = seatsSmall.slice(0, 2).map((s) => s.id);

    const res = await createBooking(token, bodyFor(flight.id, seatIds, 2)).expect(201);
    expect(res.body.status).toBe('PENDING'); // never auto-confirmed
    expect(res.body.bookingReference).toMatch(/^NV[A-Z0-9]{6}$/);
    expect(res.body.totalAmount).toBe(1010); // (421+67+17) × 2 — from DB fare
    expect(res.body.currency).toBe('EUR');
    expect(res.body.flight).toMatchObject({ flightNumber: 'NV900', origin: 'FRA', destination: 'JFK' });
    expect(res.body.passengers).toHaveLength(2);
    expect(res.body.seats).toHaveLength(2);
    expect(res.body.seats[0].holdStatus).toBe('ACTIVE');
    expect(new Date(res.body.seats[0].holdExpiresAt).getTime()).toBeGreaterThan(Date.now());

    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { bookingReference: res.body.bookingReference } });
    expect(booking.userId).toBe((await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'creator@test.dev' } })).id);
    expect(booking.status).toBe('PENDING');
    expect(await prismaTestClient.bookingPassenger.count({ where: { bookingId: booking.id } })).toBe(2);
    const holds = await prismaTestClient.seatHold.findMany({ where: { bookingId: booking.id, status: 'ACTIVE' } });
    expect(holds).toHaveLength(2);
    expect(holds.map((h) => h.seatId).sort()).toEqual(seatIds.sort());
    expect(await prismaTestClient.payment.count({ where: { bookingId: booking.id } })).toBe(0); // no fake payment

    const audit = await prismaTestClient.auditLog.findMany({ where: { bookingId: booking.id }, orderBy: { action: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(['BOOKING_CREATED', 'SEAT_HELD']);
  });

  it('ignores client-supplied totals/status/reference/userId (400 unknown fields)', async () => {
    const token = await loginAs('override@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const body = bodyFor(flight.id, [seatsSmall[0]!.id]);

    await createBooking(token, { ...body, totalAmount: 1 }).expect(400);
    await createBooking(token, { ...body, status: 'CONFIRMED' }).expect(400);
    await createBooking(token, { ...body, bookingReference: 'NVHACK1' }).expect(400);
    await createBooking(token, { ...body, userId: randomUUID() }).expect(400);
    await createBooking(token, { ...body, price: 0 }).expect(400);
  });

  it('rejects invalid flights: nonexistent 404, cancelled 409, departed 409, unoffered cabin 400', async () => {
    const token = await loginAs('flights@test.dev');
    const { cancelledFlight, departedFlight, flight, seatsSmall } = await fixtures();

    await createBooking(token, bodyFor(randomUUID(), [seatsSmall[0]!.id])).expect(404);
    await createBooking(token, bodyFor(cancelledFlight.id, [seatsSmall[0]!.id])).expect(409);
    await createBooking(token, bodyFor(departedFlight.id, [seatsSmall[0]!.id])).expect(409);
    await createBooking(token, { ...bodyFor(flight.id, [seatsSmall[0]!.id]), cabinClass: 'BUSINESS' }).expect(400);
  });

  it('rejects invalid seats: count mismatch 400, duplicate 400, wrong aircraft 400, wrong cabin 400, held 409', async () => {
    const token = await loginAs('seats@test.dev');
    const { flight, largeFlight, seatsSmall, seatsLarge } = await fixtures();
    const [s1, s2] = seatsSmall;

    await createBooking(token, bodyFor(flight.id, [s1!.id, s2!.id], 1)).expect(400); // 2 seats / 1 passenger
    await createBooking(token, bodyFor(flight.id, [s1!.id, s1!.id], 2)).expect(400); // duplicate
    await createBooking(token, bodyFor(flight.id, [seatsLarge.find((s) => s.cabinClass === 'ECONOMY')!.id])).expect(400); // other aircraft
    await createBooking(token, bodyFor(randomUUID(), [s1!.id])).expect(404);
    await createBooking(token, bodyFor(largeFlight.id, [seatsLarge.find((s) => s.cabinClass === 'BUSINESS')!.id])).expect(400); // BUSINESS seat, ECONOMY request

    const first = await createBooking(token, bodyFor(flight.id, [s1!.id]));
    expect(first.status).toBe(201);
    const second = await createBooking(token, bodyFor(flight.id, [s1!.id]));
    expect(second.status).toBe(409);
  });

  it('concurrency: two simultaneous holds on the same seat yield exactly one success', async () => {
    const [tokenA, tokenB] = await Promise.all([loginAs('race-a@test.dev'), loginAs('race-b@test.dev')]);
    const { flight, seatsSmall } = await fixtures();
    const seatId = seatsSmall[0]!.id;

    const attempts = [createBooking(tokenA, bodyFor(flight.id, [seatId])), createBooking(tokenB, bodyFor(flight.id, [seatId]))];
    const statuses = (await Promise.all(attempts)).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);

    expect(await prismaTestClient.seatHold.count({ where: { flightId: flight.id, seatId, status: 'ACTIVE' } })).toBe(1);
    expect(await prismaTestClient.booking.count({ where: { status: 'PENDING' } })).toBe(1);
  });

  // ---------- Ownership ----------

  it('enforces ownership: customers only see and cancel their own bookings', async () => {
    const tokenA = await loginAs('owner-a@test.dev');
    const tokenB = await loginAs('owner-b@test.dev');
    const { flight, seatsSmall } = await fixtures();

    const created = await createBooking(tokenA, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);

    const mineA = await request(app.getHttpServer()).get('/api/bookings').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(mineA.body).toHaveLength(1);
    const mineB = await request(app.getHttpServer()).get('/api/bookings').set('Authorization', `Bearer ${tokenB}`).expect(200);
    expect(mineB.body).toHaveLength(0);

    await request(app.getHttpServer()).get(`/api/bookings/${created.body.id}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
    await request(app.getHttpServer()).post(`/api/bookings/${created.body.id}/cancel`).set('Authorization', `Bearer ${tokenB}`).expect(404);
  });

  // ---------- Cancellation ----------

  it('cancels a PENDING booking, releases holds, preserves history; second cancel 409', async () => {
    const token = await loginAs('canceller@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const created = await createBooking(token, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
    const bookingId = created.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');

    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe('CANCELLED'); // preserved, not deleted
    const holds = await prismaTestClient.seatHold.findMany({ where: { bookingId } });
    expect(holds).toHaveLength(1);
    expect(holds[0]!.status).toBe('RELEASED');
    expect(await prismaTestClient.refund.count({ where: { bookingId } })).toBe(0); // no refunds

    await request(app.getHttpServer()).post(`/api/bookings/${bookingId}/cancel`).set('Authorization', `Bearer ${token}`).expect(409);

    // The released seat is bookable again.
    const other = await loginAs('rebook@test.dev');
    await createBooking(other, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
  });

  // ---------- Hold expiration ----------

  it('expires stale holds via the cleanup service: booking intact, fresh holds kept, repeatable', async () => {
    const token = await loginAs('expiry@test.dev');
    const { flight, seatsSmall } = await fixtures();
    await createBooking(token, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
    await createBooking(token, bodyFor(flight.id, [seatsSmall[1]!.id])).expect(201);

    // Force the first hold stale.
    const stale = await prismaTestClient.seatHold.findFirstOrThrow({ where: { seatId: seatsSmall[0]!.id } });
    await prismaTestClient.seatHold.update({ where: { id: stale.id }, data: { expiresAt: new Date(Date.now() - 60000) } });

    const seatHolds = moduleFixture.get(SeatHoldsService);
    expect(await seatHolds.expireStaleHolds()).toBe(1);

    const expiredHold = await prismaTestClient.seatHold.findUniqueOrThrow({ where: { id: stale.id } });
    expect(expiredHold.status).toBe('EXPIRED');
    const freshHold = await prismaTestClient.seatHold.findFirstOrThrow({ where: { seatId: seatsSmall[1]!.id } });
    expect(freshHold.status).toBe('ACTIVE');
    expect(await prismaTestClient.booking.count({ where: { status: 'PENDING' } })).toBe(2); // bookings preserved

    expect(await seatHolds.expireStaleHolds()).toBe(0); // safe to repeat

    // Expired seat can be booked again.
    const other = await loginAs('expiry-b@test.dev');
    await createBooking(other, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
  });

  // ---------- Admin reads ----------

  it('admin booking reads use the bookings:read permission (403 for customers)', async () => {
    const token = await loginAs('admin-view@test.dev', true);
    const customer = await loginAs('admin-view-customer@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const created = await createBooking(customer, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);

    await request(app.getHttpServer()).get('/api/admin/bookings').set('Authorization', `Bearer ${customer}`).expect(403);

    const list = await request(app.getHttpServer()).get('/api/admin/bookings').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    const filtered = await request(app.getHttpServer())
      .get(`/api/admin/bookings?reference=${created.body.bookingReference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].bookingReference).toBe(created.body.bookingReference);

    await request(app.getHttpServer()).get(`/api/admin/bookings/${created.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get(`/api/admin/bookings/${randomUUID()}`).set('Authorization', `Bearer ${token}`).expect(404);
  });
});
