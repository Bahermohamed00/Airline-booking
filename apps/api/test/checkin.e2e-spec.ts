import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Check-in domain — booking lookup (reference/email, own bookings only),
 * per-passenger per-segment check-in with boarding passes, eligibility window
 * enforced server-side, and the CONFIRMED→CHECKED_IN flip.
 */
describe('Checkin (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;

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

    const aircraft = await prismaTestClient.aircraft.create({ data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 } });
    await prismaTestClient.seat.createMany({
      data: generateSeatMap(aircraft.capacity).map((s) => ({ ...s, aircraftId: aircraft.id, features: {} })),
    });

    const route = await prismaTestClient.route.findFirstOrThrow();
    await makeFlight(route.id, aircraft.id, fra.id, jfk.id, 'NV910', 12 * 3_600_000); // check-in open
    await makeFlight(route.id, aircraft.id, fra.id, jfk.id, 'NV920', 48 * 3_600_000); // not open yet
    await makeFlight(route.id, aircraft.id, fra.id, jfk.id, 'NV930', 30 * 60_000); // already closed
  });

  async function makeFlight(
    routeId: string,
    aircraftId: string,
    originId: string,
    destinationId: string,
    flightNumber: string,
    offsetMs: number,
  ) {
    const departure = new Date(Date.now() + offsetMs);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber,
        routeId,
        aircraftId,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
        status: 'SCHEDULED',
      },
    });
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: originId,
        destinationAirportId: destinationId,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
      },
    });
    await prismaTestClient.fare.create({
      data: { flightId: flight.id, cabinClass: 'ECONOMY', basePrice: 421, taxAmount: 67, feeAmount: 17, currency: 'EUR', availableCount: 200 },
    });
    return flight;
  }

  async function loginAs(email: string): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Checkin', lastName: 'Actor' });
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  async function flightByNumber(flightNumber: string) {
    return prismaTestClient.flight.findFirstOrThrow({ where: { flightNumber } });
  }

  async function economySeats() {
    return prismaTestClient.seat.findMany({
      where: { cabinClass: 'ECONOMY' },
      orderBy: { seatNumber: 'asc' },
    });
  }

  const bookingBody = (flightId: string, seatIds: string[], passengers = 1) => ({
    idempotencyKey: randomUUID(),
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

  async function createAndPayBooking(token: string, flightNumber: string, passengers = 1) {
    const flight = await flightByNumber(flightNumber);
    const seats = (await economySeats()).slice(0, passengers);
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bookingBody(flight.id, seats.map((s) => s.id), passengers))
      .expect(201);
    const paid = await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey: randomUUID() })
      .expect(201);
    expect(paid.body.booking.status).toBe('CONFIRMED');
    return created.body as { id: string; bookingReference: string };
  }

  function lookup(token: string | null, query: string) {
    const req = request(app.getHttpServer()).get(`/api/checkin/bookings${query}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  }

  // ---------- Lookup ----------

  it('requires authentication (401 without a token)', async () => {
    await lookup(null, '?reference=NVXXXXXX').expect(401);
    await request(app.getHttpServer()).post('/api/checkin').send({}).expect(401);
    await request(app.getHttpServer()).get(`/api/checkin/boarding-pass?bookingId=${randomUUID()}`).expect(401);
  });

  it('lookup by reference returns the check-in view (no payment fields, no totals)', async () => {
    const token = await loginAs('checkin-ref@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');

    const res = await lookup(token, `?reference=${booking.bookingReference.toLowerCase()}`).expect(200);

    expect(res.body).toHaveLength(1);
    const view = res.body[0];
    expect(view).toMatchObject({
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: 'CONFIRMED',
      flight: {
        flightNumber: 'NV910',
        route: { originIata: 'FRA', destinationIata: 'JFK', originCity: 'Frankfurt', destinationCity: 'New York' },
      },
      segments: [{ segmentNumber: 1 }],
      passengers: [{ firstName: 'Pass1', lastName: 'Tester', passengerType: 'ADULT', checkedIn: false }],
    });
    expect(view.passengers[0].seatNumber).toEqual(expect.any(String));
    expect(view.passengers[0].bookingPassengerId).toEqual(expect.any(String));
    expect(view).not.toHaveProperty('totalAmount');
    expect(view).not.toHaveProperty('currency');
    expect(view).not.toHaveProperty('offer');
    expect(view).not.toHaveProperty('payments');
  });

  it('lookup by the account email returns all of the user\'s bookings; mismatch → 400 EMAIL_MISMATCH', async () => {
    const token = await loginAs('checkin-email@test.dev');
    await createAndPayBooking(token, 'NV910');

    const res = await lookup(token, '?email=Checkin-Email@Test.dev').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contactEmail).toBe('checkin-email@test.dev');

    const mismatch = await lookup(token, '?email=someone-else@test.dev').expect(400);
    expect(mismatch.body.code).toBe('EMAIL_MISMATCH');
  });

  it('lookup requires exactly one of reference/email (400 for neither or both)', async () => {
    const token = await loginAs('checkin-params@test.dev');
    await lookup(token, '').expect(400);
    await lookup(token, '?reference=NV8K4P2&email=checkin-params@test.dev').expect(400);
    await lookup(token, '?email=not-an-email').expect(400);
  });

  it('reference of another customer\'s booking is 404 — never reveals existence', async () => {
    const tokenA = await loginAs('checkin-owner-a@test.dev');
    const tokenB = await loginAs('checkin-owner-b@test.dev');
    const bookingA = await createAndPayBooking(tokenA, 'NV910');

    await lookup(tokenB, `?reference=${bookingA.bookingReference}`).expect(404).expect((res) => {
      expect(res.body.code).toBe('BOOKING_NOT_FOUND');
    });

    // Boarding passes and completion are owner-scoped too.
    await request(app.getHttpServer())
      .get(`/api/checkin/boarding-pass?bookingId=${bookingA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ bookingId: bookingA.id, bookingPassengerId: randomUUID() })
      .expect(404);

    // Random reference / uuid are equally 404.
    await lookup(tokenB, '?reference=NVZZZZZZ').expect(404);
  });

  // ---------- Completion ----------

  it('completes check-in: CheckIn + BoardingPass persisted, single-passenger booking flips to CHECKED_IN; second attempt 409s', async () => {
    const token = await loginAs('checkin-complete@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });
    const bpId = bookingRow.bookingPassengers[0]!.id;

    const res = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: bpId })
      .expect(201);

    expect(res.body.bookingStatus).toBe('CHECKED_IN');
    expect(res.body.checkIns).toHaveLength(1);
    const checkIn = res.body.checkIns[0];
    expect(checkIn).toMatchObject({
      bookingPassengerId: bpId,
      flightSegmentId: bookingRow.bookingPassengers.length ? (await prismaTestClient.flightSegment.findFirstOrThrow({ where: { flight: { flightNumber: 'NV910' } } })).id : '',
      status: 'COMPLETED',
    });
    expect(checkIn.boardingPass).toMatchObject({ boardingGroup: 'C', gate: null });
    expect(checkIn.boardingPass.seatNumber).toEqual(expect.any(String));
    expect(checkIn.boardingPass.id).toEqual(expect.any(String));

    const row = await prismaTestClient.checkIn.findFirstOrThrow({ where: { bookingPassengerId: bpId } });
    expect(row.status).toBe('COMPLETED');
    const pass = await prismaTestClient.boardingPass.findUniqueOrThrow({ where: { checkInId: row.id } });
    expect(pass.qrCode).toBeNull();
    expect((await prismaTestClient.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CHECKED_IN');

    const audit = await prismaTestClient.auditLog.findMany({ where: { action: 'CHECK_IN_COMPLETED', bookingId: booking.id } });
    expect(audit).toHaveLength(1);

    const second = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: bpId })
      .expect(409);
    expect(second.body.code).toBe('ALREADY_CHECKED_IN');
    expect(await prismaTestClient.checkIn.count({ where: { bookingPassengerId: bpId } })).toBe(1);
  });

  it('multi-passenger booking: partial check-in stays CONFIRMED, completes to CHECKED_IN when the last passenger checks in', async () => {
    const token = await loginAs('checkin-partial@test.dev');
    const booking = await createAndPayBooking(token, 'NV910', 2);
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });
    const [pax1, pax2] = bookingRow.bookingPassengers;

    const first = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: pax1!.id })
      .expect(201);
    expect(first.body.bookingStatus).toBe('CONFIRMED');

    // The lookup reflects per-passenger check-in state.
    const midLookup = await lookup(token, `?reference=${booking.bookingReference}`).expect(200);
    const states = Object.fromEntries(
      midLookup.body[0].passengers.map((p: { bookingPassengerId: string; checkedIn: boolean }) => [p.bookingPassengerId, p.checkedIn]),
    );
    expect(states[pax1!.id]).toBe(true);
    expect(states[pax2!.id]).toBe(false);

    const second = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: pax2!.id })
      .expect(201);
    expect(second.body.bookingStatus).toBe('CHECKED_IN');
  });

  it('boarding-pass endpoint returns completed check-ins with passenger names and the flight summary', async () => {
    const token = await loginAs('checkin-pass@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });
    const bpId = bookingRow.bookingPassengers[0]!.id;
    await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: bpId })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/checkin/boarding-pass?bookingId=${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: 'CHECKED_IN',
      flight: { flightNumber: 'NV910', route: { originIata: 'FRA', destinationIata: 'JFK' } },
    });
    expect(res.body.checkIns).toHaveLength(1);
    expect(res.body.checkIns[0]).toMatchObject({
      bookingPassengerId: bpId,
      status: 'COMPLETED',
      passenger: { firstName: 'Pass1', lastName: 'Tester' },
      boardingPass: { boardingGroup: 'C', gate: null },
    });
  });

  it('boarding-pass list is empty for a booking with no completed check-ins', async () => {
    const token = await loginAs('checkin-pass-empty@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');

    const res = await request(app.getHttpServer())
      .get(`/api/checkin/boarding-pass?bookingId=${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.checkIns).toEqual([]);
  });

  // ---------- Eligibility ----------

  it('PENDING and CANCELLED bookings are 409 CHECKIN_NOT_ELIGIBLE', async () => {
    const token = await loginAs('checkin-status@test.dev');
    const flight = await flightByNumber('NV910');
    const seats = await economySeats();
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bookingBody(flight.id, [seats[0]!.id]))
      .expect(201);
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: created.body.id },
      include: { bookingPassengers: true },
    });
    const bpId = bookingRow.bookingPassengers[0]!.id;

    const pending = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: created.body.id, bookingPassengerId: bpId })
      .expect(409);
    expect(pending.body.code).toBe('CHECKIN_NOT_ELIGIBLE');

    await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const cancelled = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: created.body.id, bookingPassengerId: bpId })
      .expect(409);
    expect(cancelled.body.code).toBe('CHECKIN_NOT_ELIGIBLE');
  });

  it('window enforced server-side: >24h out → 409 CHECKIN_NOT_OPEN, <1h out → 409 CHECKIN_CLOSED', async () => {
    const token = await loginAs('checkin-window@test.dev');
    const notOpen = await createAndPayBooking(token, 'NV920');
    const closed = await createAndPayBooking(token, 'NV930');

    for (const [booking, code] of [
      [notOpen, 'CHECKIN_NOT_OPEN'],
      [closed, 'CHECKIN_CLOSED'],
    ] as const) {
      const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { bookingPassengers: true },
      });
      const res = await request(app.getHttpServer())
        .post('/api/checkin')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: booking.id, bookingPassengerId: bookingRow.bookingPassengers[0]!.id })
        .expect(409);
      expect(res.body.code).toBe(code);
      expect(await prismaTestClient.checkIn.count({ where: { bookingPassengerId: bookingRow.bookingPassengers[0]!.id } })).toBe(0);
    }
  });

  // ---------- Baggage issuance at check-in ----------

  it('check-in with declared bags issues CSPRNG-tagged baggage + initial events, trackable publicly; retry cannot duplicate', async () => {
    const token = await loginAs('checkin-bags@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });
    const bpId = bookingRow.bookingPassengers[0]!.id;

    const res = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: bpId, checkedBagCount: 2 })
      .expect(201);

    expect(res.body.baggage).toHaveLength(2);
    const tags = res.body.baggage.map((b: { tagNumber: string }) => b.tagNumber);
    for (const tag of tags) expect(tag).toMatch(/^NV\d{8}$/);
    expect(new Set(tags).size).toBe(2);

    // Persisted: two bags + one CHECKED_IN event each, owned by the booking passenger.
    const bags = await prismaTestClient.baggage.findMany({
      where: { bookingPassengerId: bpId },
      include: { events: true },
    });
    expect(bags).toHaveLength(2);
    for (const bag of bags) {
      expect(bag.status).toBe('CHECKED_IN');
      expect(bag.events).toHaveLength(1);
      expect(bag.events[0]).toMatchObject({ eventType: 'CHECKED_IN' });
      expect(bag.events[0]!.location).toContain('online check-in');
    }

    // The public tracking endpoint resolves the issued tag with a PII-free view.
    const tracked = await request(app.getHttpServer()).get(`/api/baggage/track/${tags[0]}`).expect(200);
    expect(tracked.body).toMatchObject({ tagNumber: tags[0], status: 'CHECKED_IN' });
    expect(tracked.body).not.toHaveProperty('id');
    // The fixture passenger for this booking is 'Pass1 Tester' — neither the
    // name nor the booking reference may leak into the public response.
    expect(JSON.stringify(tracked.body)).not.toContain('Pass1');
    expect(JSON.stringify(tracked.body)).not.toContain('Tester');
    expect(JSON.stringify(tracked.body)).not.toContain(booking.bookingReference);

    // The owner's boarding-pass view carries the tags.
    const pass = await request(app.getHttpServer())
      .get(`/api/checkin/boarding-pass?bookingId=${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(pass.body.checkIns[0].baggage.map((b: { tagNumber: string }) => b.tagNumber).sort()).toEqual(tags.sort());

    // A retried check-in 409s and never re-issues bags or events.
    await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: bpId, checkedBagCount: 2 })
      .expect(409);
    expect(await prismaTestClient.baggage.count({ where: { bookingPassengerId: bpId } })).toBe(2);
    expect(await prismaTestClient.baggageEvent.count({ where: { baggage: { bookingPassengerId: bpId } } })).toBe(2);
  });

  it('check-in without a declaration issues no baggage', async () => {
    const token = await loginAs('checkin-nobags@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });
    const bpId = bookingRow.bookingPassengers[0]!.id;

    const res = await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, bookingPassengerId: bpId })
      .expect(201);

    expect(res.body.baggage).toEqual([]);
    expect(await prismaTestClient.baggage.count({ where: { bookingPassengerId: bpId } })).toBe(0);
  });

  it('checkedBagCount is validated: 4+ or negative → 400 before any write', async () => {
    const token = await loginAs('checkin-baglimit@test.dev');
    const booking = await createAndPayBooking(token, 'NV910');
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });
    const bpId = bookingRow.bookingPassengers[0]!.id;

    for (const checkedBagCount of [4, -1]) {
      await request(app.getHttpServer())
        .post('/api/checkin')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: booking.id, bookingPassengerId: bpId, checkedBagCount })
        .expect(400);
    }
    expect(await prismaTestClient.baggage.count()).toBe(0);
    expect(await prismaTestClient.checkIn.count()).toBe(0);
  });

  it('another customer cannot declare bags for a booking they do not own', async () => {
    const owner = await loginAs('checkin-bag-owner@test.dev');
    const stranger = await loginAs('checkin-bag-stranger@test.dev');
    const booking = await createAndPayBooking(owner, 'NV910');
    const bookingRow = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { bookingPassengers: true },
    });

    await request(app.getHttpServer())
      .post('/api/checkin')
      .set('Authorization', `Bearer ${stranger}`)
      .send({ bookingId: booking.id, bookingPassengerId: bookingRow.bookingPassengers[0]!.id, checkedBagCount: 1 })
      .expect(404);
    expect(await prismaTestClient.baggage.count()).toBe(0);
  });
});
