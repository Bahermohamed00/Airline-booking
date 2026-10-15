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

  it('customer cancellation with an open mock payment succeeds and leaves the payment untouched (protection is a mock-mode no-op)', async () => {
    const token = await loginAs('cancel-mockpay@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const created = await createBooking(token, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
    await prismaTestClient.payment.create({
      data: {
        bookingId: created.body.id,
        amount: 505,
        currency: 'EUR',
        status: 'PENDING',
        provider: 'mock',
        providerReference: 'mockpay_open_1',
        idempotencyKey: randomUUID(),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // The booking is cancelled; the mock payment is untouched (no PaymentIntent
    // exists to cancel under PAYMENT_PROVIDER=mock — Stripe-specific behavior
    // is covered by the unit suite).
    expect(
      (await prismaTestClient.booking.findUniqueOrThrow({ where: { id: created.body.id } })).status,
    ).toBe('CANCELLED');
    expect(
      (await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: created.body.id } })).status,
    ).toBe('PENDING');
  });

  // ---------- Hold expiration ----------

  it('expires stale holds via the cleanup service: orphaned booking auto-cancelled, fresh holds kept, repeatable', async () => {
    const token = await loginAs('expiry@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const orphaned = await createBooking(token, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
    const fresh = await createBooking(token, bodyFor(flight.id, [seatsSmall[1]!.id])).expect(201);

    // Force the first hold stale.
    const stale = await prismaTestClient.seatHold.findFirstOrThrow({ where: { seatId: seatsSmall[0]!.id } });
    await prismaTestClient.seatHold.update({ where: { id: stale.id }, data: { expiresAt: new Date(Date.now() - 60000) } });

    const seatHolds = moduleFixture.get(SeatHoldsService);
    expect(await seatHolds.expireStaleHolds()).toBe(1);

    const expiredHold = await prismaTestClient.seatHold.findUniqueOrThrow({ where: { id: stale.id } });
    expect(expiredHold.status).toBe('EXPIRED');
    const freshHold = await prismaTestClient.seatHold.findFirstOrThrow({ where: { seatId: seatsSmall[1]!.id } });
    expect(freshHold.status).toBe('ACTIVE');

    // The sweep cancels PENDING bookings left without any ACTIVE hold (they can
    // never be paid); the booking row is preserved, not deleted.
    const orphanedBooking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: orphaned.body.id } });
    expect(orphanedBooking.status).toBe('CANCELLED');
    const freshBooking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: fresh.body.id } });
    expect(freshBooking.status).toBe('PENDING');
    expect(await prismaTestClient.booking.count({ where: { status: 'PENDING' } })).toBe(1);
    const cancelAudit = await prismaTestClient.auditLog.findMany({
      where: { action: 'BOOKING_CANCELLED', bookingId: orphaned.body.id },
    });
    expect(cancelAudit).toHaveLength(1);
    expect(cancelAudit[0]!.actorType).toBe('System');

    expect(await seatHolds.expireStaleHolds()).toBe(0); // safe to repeat

    // Expired seat can be booked again.
    const other = await loginAs('expiry-b@test.dev');
    await createBooking(other, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);
  });

  // ---------- BR-16: bookable offers ----------

  const makeOffer = (overrides: Record<string, unknown> = {}) =>
    prismaTestClient.offer.create({
      data: {
        title: `Offer-${randomUUID().slice(0, 8)}`,
        description: 'Bookable test offer',
        status: 'ACTIVE',
        validFrom: new Date(Date.now() - 86_400_000),
        validUntil: new Date(Date.now() + 30 * 86_400_000),
        discountType: 'PERCENT',
        discountValue: 10,
        ...overrides,
      } as never,
    });

  function pricePreview(token: string | null, body: unknown) {
    const req = request(app.getHttpServer()).post('/api/bookings/price-preview');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body as Record<string, unknown>);
  }

  it('creates a booking with a bookable offer: 201, discounted total, persisted snapshot, offerId set', async () => {
    const token = await loginAs('offer-booker@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const offer = await makeOffer();
    const seatIds = seatsSmall.slice(0, 2).map((s) => s.id);

    const res = await createBooking(token, { ...bodyFor(flight.id, seatIds, 2), offerId: offer.id }).expect(201);

    // 10% of 421.00 = 42.10 off the base only → (421 − 42.10 + 67 + 17) × 2
    expect(res.body.totalAmount).toBe(925.8);
    expect(res.body.currency).toBe('EUR');
    expect(res.body.perPassengerTotal).toBe(462.9);
    expect(res.body.perPassengerDiscountAmount).toBe(42.1);
    expect(res.body.offer).toMatchObject({
      id: offer.id,
      discountType: 'PERCENT',
      discountValue: 10,
      discountAmountPerPassenger: 42.1,
      currency: 'EUR',
    });

    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { bookingReference: res.body.bookingReference } });
    expect(booking.offerId).toBe(offer.id);
    const snapshot = booking.fareRulesSnapshot as {
      perPassenger: { basePrice: number; discountAmount: number; taxAmount: number; feeAmount: number; total: number };
      offer: { id: string } | null;
    };
    expect(snapshot.perPassenger).toEqual({ basePrice: 421, discountAmount: 42.1, taxAmount: 67, feeAmount: 17, total: 462.9 });
    expect(snapshot.offer?.id).toBe(offer.id);
  });

  it('booking without an offer is unchanged: legacy totals, null offer, zero discount', async () => {
    const token = await loginAs('no-offer@test.dev');
    const { flight, seatsSmall } = await fixtures();

    const res = await createBooking(token, bodyFor(flight.id, [seatsSmall[0]!.id])).expect(201);

    expect(res.body.totalAmount).toBe(505); // (421+67+17) × 1
    expect(res.body.perPassengerTotal).toBe(505);
    expect(res.body.perPassengerDiscountAmount).toBe(0);
    expect(res.body.offer).toBeNull();
    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { bookingReference: res.body.bookingReference } });
    expect(booking.offerId).toBeNull();
  });

  it('rejects an unknown offerId with 404 OFFER_NOT_FOUND', async () => {
    const token = await loginAs('offer-404@test.dev');
    const { flight, seatsSmall } = await fixtures();

    const res = await createBooking(token, { ...bodyFor(flight.id, [seatsSmall[0]!.id]), offerId: randomUUID() }).expect(404);
    expect(res.body.code).toBe('OFFER_NOT_FOUND');
    expect(await prismaTestClient.booking.count()).toBe(0);
  });

  it('rejects unavailable offers with 409 OFFER_NOT_AVAILABLE: inactive, expired, wrong route, wrong cabin, marketing-only', async () => {
    const token = await loginAs('offer-409@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const route = await prismaTestClient.route.findFirstOrThrow();
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } }),
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } }),
    ]);
    const otherRoute = await prismaTestClient.route.create({
      data: { originAirportId: jfk.id, destinationAirportId: fra.id, distanceKm: 6201, durationMinutes: 505 },
    });

    const cases: Record<string, unknown>[] = [
      { status: 'INACTIVE' },
      { validUntil: new Date(Date.now() - 2 * 86_400_000) }, // expired validity window
      { routeId: otherRoute.id }, // scoped to another route
      { cabinClass: 'BUSINESS' }, // scoped to another cabin
      { discountType: null, discountValue: null }, // marketing-only, not bookable
    ];
    for (const overrides of cases) {
      const offer = await makeOffer(overrides);
      const res = await createBooking(token, {
        ...bodyFor(flight.id, [seatsSmall[cases.indexOf(overrides)]!.id]),
        offerId: offer.id,
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('OFFER_NOT_AVAILABLE');
    }
    // A route-scoped offer matching the flight's route IS accepted.
    const scoped = await makeOffer({ routeId: route.id });
    await createBooking(token, { ...bodyFor(flight.id, [seatsSmall[5]!.id]), offerId: scoped.id }).expect(201);
    expect(await prismaTestClient.booking.count()).toBe(1);
  });

  it('rejects a discount that makes the total non-payable with 409 OFFER_TOTAL_NOT_PAYABLE', async () => {
    const token = await loginAs('offer-unpayable@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const offer = await makeOffer({ discountType: 'FIXED_AMOUNT', discountValue: 505 });

    const res = await createBooking(token, { ...bodyFor(flight.id, [seatsSmall[0]!.id]), offerId: offer.id });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OFFER_TOTAL_NOT_PAYABLE');
    expect(await prismaTestClient.booking.count()).toBe(0);
  });

  it('idempotent replay with an offer: same key + same offer replays, same key + different offer 409s', async () => {
    const token = await loginAs('offer-idem@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const offerA = await makeOffer();
    const offerB = await makeOffer();
    const body = { ...bodyFor(flight.id, [seatsSmall[0]!.id]), offerId: offerA.id };

    const first = await createBooking(token, body).expect(201);
    const replay = await createBooking(token, body).expect(201);
    expect(replay.body.id).toBe(first.body.id);
    expect(await prismaTestClient.booking.count()).toBe(1);

    await createBooking(token, { ...body, offerId: offerB.id }).expect(409);
    expect(await prismaTestClient.booking.count()).toBe(1);
  });

  it('idempotent replay with an offer: same key + same offer but different seats 409s', async () => {
    const token = await loginAs('offer-idem-seats@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const offer = await makeOffer();
    const key = randomUUID();

    await createBooking(token, { ...bodyFor(flight.id, [seatsSmall[0]!.id]), idempotencyKey: key, offerId: offer.id }).expect(201);
    // Identical key and offer, but a different seat selection is a DIFFERENT
    // request — it must conflict, not silently replay.
    await createBooking(token, { ...bodyFor(flight.id, [seatsSmall[1]!.id]), idempotencyKey: key, offerId: offer.id }).expect(409);
    expect(await prismaTestClient.booking.count()).toBe(1);
  });

  it('two customers can book the same offer on different seats (no artificial single-use restriction)', async () => {
    const [tokenA, tokenB] = await Promise.all([loginAs('offer-multi-a@test.dev'), loginAs('offer-multi-b@test.dev')]);
    const { flight, seatsSmall } = await fixtures();
    const offer = await makeOffer();

    const first = await createBooking(tokenA, { ...bodyFor(flight.id, [seatsSmall[0]!.id]), offerId: offer.id }).expect(201);
    const second = await createBooking(tokenB, { ...bodyFor(flight.id, [seatsSmall[1]!.id]), offerId: offer.id }).expect(201);

    expect(first.body.totalAmount).toBe(462.9);
    expect(second.body.totalAmount).toBe(462.9);
    expect(first.body.offer).toMatchObject({ id: offer.id, discountAmountPerPassenger: 42.1 });
    expect(second.body.offer).toMatchObject({ id: offer.id, discountAmountPerPassenger: 42.1 });

    const bookings = await prismaTestClient.booking.findMany({ where: { offerId: offer.id } });
    expect(bookings).toHaveLength(2);
    expect(new Set(bookings.map((b) => b.userId)).size).toBe(2);
    expect(bookings.every((b) => Number(b.totalAmount) === 462.9)).toBe(true);
  });

  function pay(token: string | null, bookingId: string, body: unknown) {
    const req = request(app.getHttpServer()).post(`/api/bookings/${bookingId}/payment`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body as Record<string, unknown>);
  }

  it('an offer-discounted booking flows through the existing payment path unchanged (production-hardening 1)', async () => {
    const token = await loginAs('offer-pay@test.dev');
    const { flight, seatsSmall } = await fixtures();

    // PERCENT offer, 2 passengers: (421 − 42.10 + 67 + 17) × 2 = 925.80
    const percentOffer = await makeOffer();
    const discounted = await createBooking(token, {
      ...bodyFor(flight.id, seatsSmall.slice(0, 2).map((s) => s.id), 2),
      offerId: percentOffer.id,
    }).expect(201);
    expect(discounted.body.totalAmount).toBe(925.8);

    const paid = await pay(token, discounted.body.id, { token: 'tok_visa_test', idempotencyKey: randomUUID() }).expect(201);
    expect(paid.body.payment).toMatchObject({ status: 'SUCCESS', amount: 925.8, currency: 'EUR', provider: 'mock' });
    expect(paid.body.booking.status).toBe('CONFIRMED');
    expect(paid.body.booking.totalAmount).toBe(925.8);

    // The persisted Payment row charges the DISCOUNTED total, not the
    // undiscounted fare math (which would be 1010).
    const payment = await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: discounted.body.id } });
    expect(Number(payment.amount)).toBe(925.8);
    expect(Number(payment.amount)).not.toBe(1010);

    const confirmed = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: discounted.body.id } });
    expect(confirmed.status).toBe('CONFIRMED');
    expect(Number(confirmed.totalAmount)).toBe(925.8);
    expect(confirmed.offerId).toBe(percentOffer.id);

    // Seat holds convert exactly as for an undiscounted booking.
    const holds = await prismaTestClient.seatHold.findMany({ where: { bookingId: discounted.body.id } });
    expect(holds).toHaveLength(2);
    expect(holds.every((h) => h.status === 'CONVERTED')).toBe(true);
    expect(
      await prismaTestClient.bookingSeat.count({ where: { bookingPassenger: { bookingId: discounted.body.id } } }),
    ).toBe(2);

    // The historical offer snapshot survives the payment flow untouched.
    const snapshot = confirmed.fareRulesSnapshot as {
      perPassenger: { basePrice: number; discountAmount: number; total: number };
      offer: Record<string, unknown> | null;
    };
    expect(snapshot.perPassenger).toMatchObject({ basePrice: 421, discountAmount: 42.1, total: 462.9 });
    expect(snapshot.offer).toMatchObject({
      id: percentOffer.id,
      discountType: 'PERCENT',
      discountValue: 10,
      discountAmountPerPassenger: 42.1,
      currency: 'EUR',
    });

    // FIXED_AMOUNT offer, 1 passenger: 421 − 50 + 67 + 17 = 455
    const fixedOffer = await makeOffer({ discountType: 'FIXED_AMOUNT', discountValue: 50 });
    const fixedBooking = await createBooking(token, {
      ...bodyFor(flight.id, [seatsSmall[2]!.id]),
      offerId: fixedOffer.id,
    }).expect(201);
    expect(fixedBooking.body.totalAmount).toBe(455);

    const fixedPaid = await pay(token, fixedBooking.body.id, { token: 'tok_visa_test', idempotencyKey: randomUUID() }).expect(201);
    expect(fixedPaid.body.payment).toMatchObject({ status: 'SUCCESS', amount: 455 });
    expect(fixedPaid.body.booking.status).toBe('CONFIRMED');
    const fixedPayment = await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: fixedBooking.body.id } });
    expect(Number(fixedPayment.amount)).toBe(455);
    const fixedSnapshot = (
      await prismaTestClient.booking.findUniqueOrThrow({ where: { id: fixedBooking.body.id } })
    ).fareRulesSnapshot as { offer: Record<string, unknown> | null };
    expect(fixedSnapshot.offer).toMatchObject({
      id: fixedOffer.id,
      discountType: 'FIXED_AMOUNT',
      discountValue: 50,
      discountAmountPerPassenger: 50,
    });
  });

  it('mutating the offer after payment does not rewrite history: view, snapshot and payment stay as sold', async () => {
    const token = await loginAs('offer-mutate@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const offer = await makeOffer();

    const created = await createBooking(token, {
      ...bodyFor(flight.id, [seatsSmall[0]!.id]),
      offerId: offer.id,
    }).expect(201);
    expect(created.body.totalAmount).toBe(462.9);
    await pay(token, created.body.id, { token: 'tok_visa_test', idempotencyKey: randomUUID() }).expect(201);

    // Mutate the live offer aggressively after the sale: discount terms,
    // status and validity window all change.
    await prismaTestClient.offer.update({
      where: { id: offer.id },
      data: {
        discountType: 'FIXED_AMOUNT',
        discountValue: 300,
        status: 'INACTIVE',
        validFrom: new Date(Date.now() - 10 * 86_400_000),
        validUntil: new Date(Date.now() - 86_400_000),
      } as never,
    });

    const view = await request(app.getHttpServer())
      .get(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(view.body.status).toBe('CONFIRMED');
    expect(view.body.totalAmount).toBe(462.9);
    expect(view.body.currency).toBe('EUR');
    expect(view.body.perPassengerDiscountAmount).toBe(42.1);
    expect(view.body.offer).toMatchObject({
      id: offer.id,
      discountType: 'PERCENT',
      discountValue: 10,
      discountAmountPerPassenger: 42.1,
      currency: 'EUR',
    });

    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(Number(booking.totalAmount)).toBe(462.9);
    const snapshot = booking.fareRulesSnapshot as { offer: Record<string, unknown> | null };
    expect(snapshot.offer).toMatchObject({ discountType: 'PERCENT', discountValue: 10, discountAmountPerPassenger: 42.1 });
    const payment = await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(Number(payment.amount)).toBe(462.9);
  });

  it('failed payment on a discounted booking: 402, PENDING, holds ACTIVE, snapshot intact; retry with a new key succeeds at the discounted amount', async () => {
    const token = await loginAs('offer-pay-fail@test.dev');
    const { flight, seatsSmall } = await fixtures();
    // FIXED_AMOUNT offer, 1 passenger: 421 − 50 + 67 + 17 = 455
    const offer = await makeOffer({ discountType: 'FIXED_AMOUNT', discountValue: 50 });
    const created = await createBooking(token, {
      ...bodyFor(flight.id, [seatsSmall[0]!.id]),
      offerId: offer.id,
    }).expect(201);
    expect(created.body.totalAmount).toBe(455);

    const failedKey = randomUUID();
    const declined = await pay(token, created.body.id, { token: 'tok_fail_card', idempotencyKey: failedKey }).expect(402);
    expect(declined.body.message).toMatch(/declined/i);

    let booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(booking.status).toBe('PENDING');
    let payments = await prismaTestClient.payment.findMany({ where: { bookingId: booking.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]!.status).toBe('FAILED');
    expect(Number(payments[0]!.amount)).toBe(455);
    let holds = await prismaTestClient.seatHold.findMany({ where: { bookingId: booking.id } });
    expect(holds).toHaveLength(1);
    expect(holds[0]!.status).toBe('ACTIVE'); // declined money never releases the seat
    expect(
      (booking.fareRulesSnapshot as { offer: Record<string, unknown> | null }).offer,
    ).toMatchObject({ id: offer.id, discountType: 'FIXED_AMOUNT', discountValue: 50, discountAmountPerPassenger: 50 });

    // Replaying the failed key re-reports the failure; a retry needs a NEW key.
    await pay(token, created.body.id, { token: 'tok_fail_card', idempotencyKey: failedKey }).expect(402);

    const retried = await pay(token, created.body.id, { token: 'tok_visa_test', idempotencyKey: randomUUID() }).expect(201);
    expect(retried.body.payment).toMatchObject({ status: 'SUCCESS', amount: 455, currency: 'EUR' });
    expect(retried.body.booking.status).toBe('CONFIRMED');

    booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(booking.status).toBe('CONFIRMED');
    payments = await prismaTestClient.payment.findMany({ where: { bookingId: booking.id } });
    expect(payments).toHaveLength(2); // FAILED history preserved, exactly one SUCCESS
    const successful = payments.filter((p) => p.status === 'SUCCESS');
    expect(successful).toHaveLength(1);
    expect(Number(successful[0]!.amount)).toBe(455);
    holds = await prismaTestClient.seatHold.findMany({ where: { bookingId: booking.id } });
    expect(holds[0]!.status).toBe('CONVERTED');
  });

  it('customer cancellation of a paid discounted booking refunds 100% of the DISCOUNTED paid amount; second cancel 409', async () => {
    const token = await loginAs('offer-cancel@test.dev');
    const staff = await loginAs('offer-cancel-admin@test.dev', true);
    const { flight, seatsSmall } = await fixtures();
    // Make the fare refundable so the policy tiers produce a refund.
    await prismaTestClient.fare.updateMany({
      where: { flightId: flight.id },
      data: { fareRules: { refundable: true, cancellationFeePercent: 0 } },
    });
    const offer = await makeOffer();
    const created = await createBooking(token, {
      ...bodyFor(flight.id, [seatsSmall[0]!.id]),
      offerId: offer.id,
    }).expect(201);
    await pay(token, created.body.id, { token: 'tok_visa_test', idempotencyKey: randomUUID() }).expect(201);
    // Push the departure past the 100% tier (> 168h out).
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 8 * 86_400_000) },
    });

    // Paid bookings cancel through the staff-reviewed cancellation request.
    const cancellationRequest = await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancellation-request`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const approved = await request(app.getHttpServer())
      .post(`/api/admin/cancellation-requests/${cancellationRequest.body.id}/approve`)
      .set('Authorization', `Bearer ${staff}`)
      .expect(200);
    expect(approved.body.booking.status).toBe('CANCELLED');

    const payment = await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: created.body.id } });
    expect(Number(payment.amount)).toBe(462.9); // the discounted amount actually charged
    expect(payment.status).toBe('REFUNDED');
    const refunds = await prismaTestClient.refund.findMany({ where: { paymentId: payment.id } });
    expect(refunds).toHaveLength(1);
    // 100% of the discounted paid amount — NOT the undiscounted 505.
    expect(Number(refunds[0]!.amount)).toBe(462.9);
    expect(refunds[0]!.status).toBe('PROCESSED');
    expect(refunds[0]!.providerReference).toMatch(/^mockref_mockpay_/);

    // Inventory freed exactly as for an undiscounted cancellation.
    expect(
      await prismaTestClient.bookingSeat.count({ where: { bookingPassenger: { bookingId: created.body.id } } }),
    ).toBe(0);
    expect((await prismaTestClient.booking.findUniqueOrThrow({ where: { id: created.body.id } })).status).toBe('CANCELLED');

    await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(await prismaTestClient.refund.count({ where: { paymentId: payment.id } })).toBe(1);
  });

  it('cancellation refund is computed from the amount actually paid, not a later-mutated offer', async () => {
    const token = await loginAs('offer-refund-mutate@test.dev');
    const staff = await loginAs('offer-refund-mutate-admin@test.dev', true);
    const { flight, seatsSmall } = await fixtures();
    await prismaTestClient.fare.updateMany({
      where: { flightId: flight.id },
      data: { fareRules: { refundable: true, cancellationFeePercent: 0 } },
    });
    const offer = await makeOffer(); // PERCENT 10 → paid 462.9
    const created = await createBooking(token, {
      ...bodyFor(flight.id, [seatsSmall[0]!.id]),
      offerId: offer.id,
    }).expect(201);
    await pay(token, created.body.id, { token: 'tok_visa_test', idempotencyKey: randomUUID() }).expect(201);

    // Raise the discount after the sale — the refund must not follow it.
    await prismaTestClient.offer.update({ where: { id: offer.id }, data: { discountValue: 90 } });

    // Fixture default departure (+2 days) lands in the 50% tier.
    const cancellationRequest = await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancellation-request`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/cancellation-requests/${cancellationRequest.body.id}/approve`)
      .set('Authorization', `Bearer ${staff}`)
      .expect(200);

    const payment = await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: created.body.id } });
    const refunds = await prismaTestClient.refund.findMany({ where: { paymentId: payment.id } });
    expect(refunds).toHaveLength(1);
    // 50% of the ORIGINAL discounted payment (462.9) = 231.45 — derived from
    // the paid amount, not from the mutated 90% offer terms.
    expect(Number(refunds[0]!.amount)).toBe(231.45);
    expect(refunds[0]!.status).toBe('PROCESSED');
    // The refund finalizes while the booking is still CONFIRMED (the hook
    // cancels it afterwards), so a partial-tier refund settles as
    // PARTIALLY_REFUNDED rather than REFUNDED.
    expect(payment.status).toBe('PARTIALLY_REFUNDED');
  });

  it('price-preview: computes server-side totals without writing anything', async () => {
    const token = await loginAs('preview@test.dev');
    const { flight } = await fixtures();

    const res = await pricePreview(token, { flightId: flight.id, cabinClass: 'ECONOMY', passengerCount: 2 }).expect(201);

    expect(res.body).toEqual({
      currency: 'EUR',
      perPassenger: { basePrice: 421, discountAmount: 0, taxAmount: 67, feeAmount: 17, total: 505 },
      passengerCount: 2,
      totalAmount: 1010,
      offer: null,
      extras: { total: 0, lines: [] },
    });
    expect(await prismaTestClient.booking.count()).toBe(0);
    expect(await prismaTestClient.seatHold.count()).toBe(0);
  });

  it('price-preview: applies a bookable offer to the fare base only', async () => {
    const token = await loginAs('preview-offer@test.dev');
    const { flight } = await fixtures();
    const offer = await makeOffer();

    const res = await pricePreview(token, {
      flightId: flight.id,
      cabinClass: 'ECONOMY',
      passengerCount: 2,
      offerId: offer.id,
    }).expect(201);

    expect(res.body.perPassenger).toEqual({ basePrice: 421, discountAmount: 42.1, taxAmount: 67, feeAmount: 17, total: 462.9 });
    expect(res.body.totalAmount).toBe(925.8);
    expect(res.body.offer).toMatchObject({ id: offer.id, discountAmountPerPassenger: 42.1 });
    expect(await prismaTestClient.booking.count()).toBe(0);
  });

  it('price-preview: mirrors creation guards and offer errors', async () => {
    const token = await loginAs('preview-guards@test.dev');
    const { flight, cancelledFlight } = await fixtures();
    const offer = await makeOffer({ cabinClass: 'BUSINESS' });

    await pricePreview(null, { flightId: flight.id, cabinClass: 'ECONOMY', passengerCount: 1 }).expect(401);
    await pricePreview(token, { flightId: randomUUID(), cabinClass: 'ECONOMY', passengerCount: 1 }).expect(404);
    await pricePreview(token, { flightId: cancelledFlight.id, cabinClass: 'ECONOMY', passengerCount: 1 }).expect(409);
    await pricePreview(token, { flightId: flight.id, cabinClass: 'BUSINESS', passengerCount: 1 }).expect(400);
    await pricePreview(token, { flightId: flight.id, cabinClass: 'ECONOMY', passengerCount: 0 }).expect(400);

    const unavailable = await pricePreview(token, {
      flightId: flight.id,
      cabinClass: 'ECONOMY',
      passengerCount: 1,
      offerId: offer.id,
    });
    expect(unavailable.status).toBe(409);
    expect(unavailable.body.code).toBe('OFFER_NOT_AVAILABLE');

    const unknown = await pricePreview(token, {
      flightId: flight.id,
      cabinClass: 'ECONOMY',
      passengerCount: 1,
      offerId: randomUUID(),
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('OFFER_NOT_FOUND');
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
