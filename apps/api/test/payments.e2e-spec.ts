import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Phase 6F: payments → confirmation → seat-hold conversion → refunds → admin
 * cancellation → BR-14 payment exception, all against a real PostgreSQL DB.
 *
 * Two flights per test:
 * - `flight` (NV-T100): fare WITH fareRules { refundable: true, cancellationFeePercent: 10 }
 * - `noRulesFlight` (NV-T220): fare WITHOUT fareRules (policy not configured)
 */
describe('Payments (e2e)', () => {
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
        {
          iataCode: 'FRA',
          name: 'Frankfurt Airport',
          city: 'Frankfurt',
          country: 'Germany',
          timezone: 'Europe/Berlin',
        },
        {
          iataCode: 'JFK',
          name: 'JFK International',
          city: 'New York',
          country: 'United States',
          timezone: 'America/New_York',
        },
      ],
    });
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'FRA' },
      }),
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'JFK' },
      }),
    ]);
    await prismaTestClient.route.create({
      data: {
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        distanceKm: 6201,
        durationMinutes: 505,
      },
    });

    const small = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
    });
    const large = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T220', model: 'Test Jet 220', capacity: 220 },
    });
    for (const ac of [small, large]) {
      await prismaTestClient.seat.createMany({
        data: generateSeatMap(ac.capacity).map((s) => ({
          ...s,
          aircraftId: ac.id,
          features: {},
        })),
      });
    }

    await makeFlight(small.id, fra.id, jfk.id, {
      refundable: true,
      cancellationFeePercent: 10,
    });
    await makeFlight(large.id, fra.id, jfk.id, null);
  });

  async function makeFlight(
    aircraftId: string,
    fraId: string,
    jfkId: string,
    fareRules: unknown,
  ) {
    const departure = new Date(Date.now() + 2 * 86_400_000);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV900',
        routeId: (await prismaTestClient.route.findFirstOrThrow()).id,
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
        originAirportId: fraId,
        destinationAirportId: jfkId,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
      },
    });
    await prismaTestClient.fare.create({
      data: {
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        basePrice: 421,
        taxAmount: 67,
        feeAmount: 17,
        currency: 'EUR',
        availableCount: 200,
        ...(fareRules ? { fareRules: fareRules as never } : {}),
      },
    });
    return flight;
  }

  async function fixtures() {
    const [flight, noRulesFlight, seatsSmall, seatsLarge] = await Promise.all([
      prismaTestClient.flight.findFirstOrThrow({
        where: { aircraft: { registration: 'NV-T100' } },
      }),
      prismaTestClient.flight.findFirstOrThrow({
        where: { aircraft: { registration: 'NV-T220' } },
      }),
      prismaTestClient.seat.findMany({
        where: { aircraft: { registration: 'NV-T100' } },
        orderBy: { seatNumber: 'asc' },
      }),
      prismaTestClient.seat.findMany({
        where: { aircraft: { registration: 'NV-T220' } },
        orderBy: { seatNumber: 'asc' },
      }),
    ]);
    return { flight, noRulesFlight, seatsSmall, seatsLarge };
  }

  async function loginAs(email: string): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Pay',
      lastName: 'Customer',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  async function loginStaff(
    email: string,
    permissions: string[],
  ): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Staff',
      lastName: 'Member',
    });
    const role = await prismaTestClient.role.create({
      data: { name: `Role ${email}` },
    });
    for (const p of permissions) {
      const [resource, action] = p.split(':') as [string, string];
      const permission = await prismaTestClient.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      await prismaTestClient.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email },
    });
    await prismaTestClient.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  /** Creates a PENDING booking through the real API; returns { id, reference, total }. */
  async function createPendingBooking(
    token: string,
    flightId: string,
    seatIds: string[],
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        flightId,
        cabinClass: 'ECONOMY',
        seatIds,
        passengers: seatIds.map((_, i) => ({
          firstName: `Pass${i + 1}`,
          lastName: 'Tester',
          passengerType: 'ADULT',
          dateOfBirth: '1990-01-01',
        })),
      })
      .expect(201);
    return {
      id: res.body.id as string,
      reference: res.body.bookingReference as string,
      total: res.body.totalAmount as number,
    };
  }

  function pay(token: string | null, bookingId: string, body: unknown) {
    const req = request(app.getHttpServer()).post(
      `/api/bookings/${bookingId}/payment`,
    );
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body as Record<string, unknown>);
  }

  const payBody = (overrides: Record<string, unknown> = {}) => ({
    token: 'tok_visa_test',
    idempotencyKey: randomUUID(),
    ...overrides,
  });

  const auditRows = (action: string, targetId?: string) =>
    prismaTestClient.auditLog.findMany({
      where: { action, ...(targetId ? { targetId } : {}) },
      orderBy: { createdAt: 'asc' },
    });

  // ---------- Customer payment ----------

  it('rejects unauthenticated payment with 401', async () => {
    await pay(null, randomUUID(), payBody()).expect(401);
  });

  it('pays a PENDING booking: payment recorded, booking CONFIRMED, holds CONVERTED, booking seats created, audit written', async () => {
    const token = await loginAs('payer@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(
      token,
      flight.id,
      seatsSmall.slice(0, 2).map((s) => s.id),
    );
    expect(booking.total).toBe(1010); // (421+67+17) × 2

    const res = await pay(token, booking.id, payBody()).expect(201);
    expect(res.body.payment).toMatchObject({
      status: 'SUCCESS',
      amount: 1010,
      currency: 'EUR',
      provider: 'mock',
      providerReference: expect.stringMatching(/^mockpay_/),
      bookingId: booking.id,
    });
    expect(res.body.payment.paidAt).toBeTruthy();
    expect(res.body.payment).not.toHaveProperty('token');
    expect(res.body.booking.status).toBe('CONFIRMED');
    expect(res.body.booking.totalAmount).toBe(1010); // totals preserved

    const stored = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.status).toBe('CONFIRMED');

    const holds = await prismaTestClient.seatHold.findMany({
      where: { bookingId: booking.id },
    });
    expect(holds).toHaveLength(2);
    expect(holds.every((h) => h.status === 'CONVERTED')).toBe(true);

    const bookingSeats = await prismaTestClient.bookingSeat.findMany({
      where: { bookingPassenger: { bookingId: booking.id } },
    });
    expect(bookingSeats).toHaveLength(2);
    expect(new Set(bookingSeats.map((bs) => bs.seatId)).size).toBe(2);

    const actions = (await auditRows('PAYMENT_SUCCEEDED'))
      .concat(await auditRows('BOOKING_CONFIRMED'))
      .concat(await auditRows('SEAT_HOLD_CONVERTED'));
    expect(actions.map((a) => a.action).sort()).toEqual([
      'BOOKING_CONFIRMED',
      'PAYMENT_SUCCEEDED',
      'SEAT_HOLD_CONVERTED',
    ]);
    const paymentEvent = await auditRows('PAYMENT_SUCCEEDED');
    expect(paymentEvent[0]!.targetType).toBe('Payment');
    expect(
      (paymentEvent[0]!.metadata as Record<string, unknown>)[
        'providerReference'
      ],
    ).toBe(res.body.payment.providerReference);
    // Never log sensitive data.
    expect(JSON.stringify(actions.map((a) => a.metadata))).not.toContain(
      'tok_visa_test',
    );
  });

  it('failed payment: 402, booking stays PENDING, FAILED payment persisted, holds stay ACTIVE, no booking seats (BR-05)', async () => {
    const token = await loginAs('declined@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);

    const res = await pay(
      token,
      booking.id,
      payBody({ token: 'tok_fail_card' }),
    ).expect(402);
    expect(res.body.message).toMatch(/declined/i);

    const stored = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.status).toBe('PENDING');
    const payments = await prismaTestClient.payment.findMany({
      where: { bookingId: booking.id },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0]!.status).toBe('FAILED');
    expect(payments[0]!.providerReference).toBeNull();
    const holds = await prismaTestClient.seatHold.findMany({
      where: { bookingId: booking.id },
    });
    expect(holds[0]!.status).toBe('ACTIVE');
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(0);
    expect(await auditRows('PAYMENT_FAILED')).toHaveLength(1);
  });

  it('rejects a raw card number instead of a token with 400 (tokenization enforced)', async () => {
    const token = await loginAs('rawcard@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await pay(token, booking.id, payBody({ token: '4111111111111111' })).expect(
      400,
    );
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(0);
  });

  it('rejects paying an already confirmed booking with 409', async () => {
    const token = await loginAs('twice@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await pay(token, booking.id, payBody()).expect(201);
    await pay(token, booking.id, payBody()).expect(409); // different key — genuinely new attempt
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id, status: 'SUCCESS' },
      }),
    ).toBe(1);
  });

  it('rejects paying another customer’s booking with 404', async () => {
    const owner = await loginAs('owner@test.dev');
    const intruder = await loginAs('intruder@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(owner, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await pay(intruder, booking.id, payBody()).expect(404);
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(0);
  });

  it('rejects payment when the seat hold has expired (self-heals to EXPIRED, no charge recorded)', async () => {
    const token = await loginAs('late@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await prismaTestClient.seatHold.updateMany({
      where: { bookingId: booking.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await pay(token, booking.id, payBody()).expect(409);
    const stored = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.status).toBe('PENDING');
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(0);
  });

  // ---------- Idempotency ----------

  it('replays the same idempotency key: same payment returned, no duplicate payment or confirmation', async () => {
    const token = await loginAs('replay@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);
    const body = payBody();

    const first = await pay(token, booking.id, body).expect(201);
    const second = await pay(token, booking.id, body).expect(201);

    expect(second.body.payment.id).toBe(first.body.payment.id);
    expect(second.body.payment.providerReference).toBe(
      first.body.payment.providerReference,
    );
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(1);
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(1);
    expect(await auditRows('PAYMENT_SUCCEEDED')).toHaveLength(1);
  });

  it('rejects reuse of the same key with a different token (conflict)', async () => {
    const token = await loginAs('conflict@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);
    const key = randomUUID();

    await pay(
      token,
      booking.id,
      payBody({ idempotencyKey: key, token: 'tok_first' }),
    ).expect(201);
    await pay(
      token,
      booking.id,
      payBody({ idempotencyKey: key, token: 'tok_second' }),
    ).expect(409);
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(1);
  });

  it('two concurrent identical payments confirm exactly once and create exactly one payment', async () => {
    const token = await loginAs('parallel@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(
      token,
      flight.id,
      seatsSmall.slice(0, 2).map((s) => s.id),
    );
    const body = payBody();

    const results = await Promise.all([
      pay(token, booking.id, body),
      pay(token, booking.id, body),
    ]);
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(results[0]!.body.payment.id).toBe(results[1]!.body.payment.id);

    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id, status: 'SUCCESS' },
      }),
    ).toBe(1);
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(2);
    const stored = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.status).toBe('CONFIRMED');
  });

  // ---------- Seat conversion ----------

  it('paid seats block later bookings on the same flight (BookingSeat uniqueness authoritative)', async () => {
    const first = await loginAs('first@test.dev');
    const second = await loginAs('second@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const seatId = seatsSmall[0]!.id;

    const booking = await createPendingBooking(first, flight.id, [seatId]);
    await pay(first, booking.id, payBody()).expect(201);

    // A new booking attempt on the converted seat conflicts.
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${second}`)
      .send({
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        seatIds: [seatId],
        passengers: [
          { firstName: 'Late', lastName: 'Comer', passengerType: 'ADULT' },
        ],
      })
      .expect(409);

    // And the seat-availability endpoint reports it as occupied.
    const availability = await request(app.getHttpServer())
      .get(`/api/flights/${flight.id}/seat-availability`)
      .expect(200);
    expect(availability.body.occupiedSeatIds).toContain(seatId);
  });

  it('customer payment lookup returns own payments and 404s other customers', async () => {
    const owner = await loginAs('lookup@test.dev');
    const other = await loginAs('lookup-other@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(owner, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await pay(owner, booking.id, payBody()).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/payments`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ status: 'SUCCESS', amount: 505 });
    expect(res.body[0]).not.toHaveProperty('token');

    await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/payments`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/payments`)
      .expect(401);
  });

  // ---------- Admin payment reads ----------

  it('admin payments: 401 unauthenticated, 403 customer, 403 staff without payments:read, 200 finance', async () => {
    const customerToken = await loginAs('plain@test.dev');
    const finance = await loginStaff('finance@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const bookingMgr = await loginStaff('bookingmgr@test.dev', [
      'bookings:read',
      'bookings:manage',
    ]);
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(customerToken, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await pay(customerToken, booking.id, payBody()).expect(201);

    await request(app.getHttpServer()).get('/api/admin/payments').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${bookingMgr}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      bookingReference: booking.reference,
      bookingStatus: 'CONFIRMED',
      contactEmail: 'plain@test.dev',
      amount: 505,
      status: 'SUCCESS',
      provider: 'mock',
    });
    expect(list.body[0]).not.toHaveProperty('token');

    const byStatus = await request(app.getHttpServer())
      .get('/api/admin/payments?status=FAILED')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(0);

    const byReference = await request(app.getHttpServer())
      .get(`/api/admin/payments?reference=${booking.reference}`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(byReference.body).toHaveLength(1);

    const detail = await request(app.getHttpServer())
      .get(`/api/admin/payments/${list.body[0].id}`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(detail.body.bookingReference).toBe(booking.reference);

    await request(app.getHttpServer())
      .get(`/api/admin/payments/${randomUUID()}`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(404);
  });

  // ---------- Refunds ----------

  async function paidBooking(
    customerEmail: string,
    useRulesFlight = true,
    seatIndex = 0,
  ) {
    const customerToken = await loginAs(customerEmail);
    const { flight, noRulesFlight, seatsSmall, seatsLarge } = await fixtures();
    const f = useRulesFlight ? flight : noRulesFlight;
    const seats = useRulesFlight ? seatsSmall : seatsLarge;
    const booking = await createPendingBooking(customerToken, f.id, [
      seats[seatIndex]!.id,
    ]);
    const paymentRes = await pay(customerToken, booking.id, payBody()).expect(
      201,
    );
    return {
      booking,
      paymentId: paymentRes.body.payment.id as string,
      customerToken,
    };
  }

  it('finance staff refunds partially then fully; statuses and remainders are enforced', async () => {
    const finance = await loginStaff('refunder@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking('refunded@test.dev');

    const partial = await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ amount: 200, reason: 'Goodwill partial' })
      .expect(201);
    expect(partial.body.refund).toMatchObject({
      amount: 200,
      status: 'PROCESSED',
      reason: 'Goodwill partial',
      bookingReference: booking.reference,
    });
    expect(partial.body.payment.status).toBe('PARTIALLY_REFUNDED');

    // Over-refunding the remainder is rejected.
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ amount: 305.01 })
      .expect(409);

    // Refunding the exact remainder flips the payment to REFUNDED.
    const full = await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({})
      .expect(201);
    expect(full.body.refund.amount).toBe(305);
    expect(full.body.payment.status).toBe('REFUNDED');

    // Nothing left to refund.
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({})
      .expect(409);

    const refunds = await prismaTestClient.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'asc' },
    });
    expect(refunds).toHaveLength(2);
    expect(refunds.every((r) => r.status === 'PROCESSED')).toBe(true);

    const refundAudits = await auditRows('REFUND_COMPLETED');
    expect(refundAudits).toHaveLength(2);
    expect(
      (refundAudits[0]!.metadata as Record<string, unknown>)['amount'],
    ).toBe(200);
    expect(
      (refundAudits[0]!.metadata as Record<string, unknown>)['reason'],
    ).toBe('Goodwill partial');
  });

  it('refund authorization: customers and staff without payments:refund get 403', async () => {
    const finance = await loginStaff('refauth-finance@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const bookingMgr = await loginStaff('refauth-bm@test.dev', [
      'bookings:manage',
    ]);
    const { paymentId, customerToken } = await paidBooking(
      'refauth-customer@test.dev',
    );

    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 10 })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ amount: 10 })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .send({ amount: 10 })
      .expect(401);

    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(
      0,
    );
    expect(finance).toBeTruthy();
  });

  it('rejects refunding a failed payment with 409 and invalid amounts with 400', async () => {
    const finance = await loginStaff('reffail@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const customerToken = await loginAs('reffail-customer@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(customerToken, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await pay(
      customerToken,
      booking.id,
      payBody({ token: 'tok_fail_card' }),
    ).expect(402);
    const failedPayment = await prismaTestClient.payment.findFirstOrThrow({
      where: { bookingId: booking.id },
    });

    await request(app.getHttpServer())
      .post(`/api/admin/payments/${failedPayment.id}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({})
      .expect(409);

    const { paymentId } = await paidBooking('refbad@test.dev', true, 1);
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ amount: -5 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${randomUUID()}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({})
      .expect(404);
  });

  it('admin refunds list shows real refund rows with payment and booking context', async () => {
    const finance = await loginStaff('reflist@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking(
      'reflist-customer@test.dev',
    );
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ amount: 100, reason: 'Partial goodwill' })
      .expect(201);

    const customerToken = await loginAs('reflist-spy@test.dev');
    const bookingMgr = await loginStaff('reflist-bm@test.dev', [
      'bookings:manage',
    ]);
    await request(app.getHttpServer())
      .get('/api/admin/refunds')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/refunds')
      .set('Authorization', `Bearer ${bookingMgr}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/admin/refunds')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      bookingReference: booking.reference,
      contactEmail: 'reflist-customer@test.dev',
      amount: 100,
      status: 'PROCESSED',
      paymentStatus: 'PARTIALLY_REFUNDED',
      paymentProviderReference: expect.stringMatching(/^mockpay_/),
    });
  });

  // ---------- Admin cancellation ----------

  it('admin cancels a PENDING booking: holds released, no refund, audit written; 409 on repeat', async () => {
    const bookingMgr = await loginStaff('cancel-bm@test.dev', [
      'bookings:read',
      'bookings:manage',
    ]);
    const customerToken = await loginAs('cancel-pending@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(customerToken, flight.id, [
      seatsSmall[0]!.id,
    ]);

    const res = await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'Customer called support' })
      .expect(200);
    expect(res.body.booking.status).toBe('CANCELLED');
    expect(res.body.refund).toBeNull();

    const holds = await prismaTestClient.seatHold.findMany({
      where: { bookingId: booking.id },
    });
    expect(holds[0]!.status).toBe('RELEASED');
    expect((await auditRows('BOOKING_CANCELLED'))[0]!.actorType).toBe('Staff');

    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({})
      .expect(409);
  });

  it('admin cancels a CONFIRMED paid booking: auto-refund per fare policy (BR-15, 10% fee), payment REFUNDED', async () => {
    const bookingMgr = await loginStaff('cancel-paid-bm@test.dev', [
      'bookings:read',
      'bookings:manage',
    ]);
    const { booking } = await paidBooking('cancel-paid@test.dev');

    const res = await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'Operational disruption' })
      .expect(200);

    // 505 × (1 − 10%) = 454.50 per the fare rules snapshot.
    expect(res.body.booking.status).toBe('CANCELLED');
    expect(res.body.refund).toMatchObject({
      amount: 454.5,
      status: 'PROCESSED',
      bookingReference: booking.reference,
    });

    const payment = await prismaTestClient.payment.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    expect(payment.status).toBe('REFUNDED');
    const actions = (
      await prismaTestClient.auditLog.findMany({
        where: { bookingId: booking.id },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(['BOOKING_CANCELLED', 'REFUND_COMPLETED']),
    );

    // Seat is freed: the availability endpoint no longer shows it occupied.
    const seatId = (
      await prismaTestClient.bookingSeat.findFirstOrThrow({
        where: { bookingPassenger: { bookingId: booking.id } },
      })
    ).seatId;
    const flightId = (
      await prismaTestClient.seatHold.findFirstOrThrow({
        where: { bookingId: booking.id },
      })
    ).flightId;
    const availability = await request(app.getHttpServer())
      .get(`/api/flights/${flightId}/seat-availability`)
      .expect(200);
    expect(availability.body.occupiedSeatIds).not.toContain(seatId);
  });

  it('admin cancel of a paid booking without configured fare policy: cancels, keeps payment, explains (no fabricated refund)', async () => {
    const bookingMgr = await loginStaff('cancel-nopolicy@test.dev', [
      'bookings:manage',
    ]);
    const { booking } = await paidBooking(
      'cancel-nopolicy-customer@test.dev',
      false,
    );

    const res = await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({})
      .expect(200);
    expect(res.body.booking.status).toBe('CANCELLED');
    expect(res.body.refund).toBeNull();
    expect(res.body.refundNote).toMatch(/not configured/i);

    // Payment information is preserved, not silently lost.
    const payment = await prismaTestClient.payment.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    expect(payment.status).toBe('SUCCESS');
    expect(
      await prismaTestClient.refund.count({ where: { paymentId: payment.id } }),
    ).toBe(0);
  });

  it('admin cancel authorization: customers get 403, staff without bookings:manage get 403', async () => {
    const bookingMgr = await loginStaff('cancel-authz@test.dev', [
      'bookings:manage',
    ]);
    const finance = await loginStaff('cancel-finance@test.dev', [
      'payments:refund',
    ]);
    const { booking, customerToken } = await paidBooking(
      'cancel-authz-customer@test.dev',
    );

    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${finance}`)
      .send({})
      .expect(403);

    const stored = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.status).toBe('CONFIRMED');
    expect(bookingMgr).toBeTruthy();
  });

  // ---------- BR-14 payment exception ----------

  it('BR-14: staff confirms a PENDING booking without payment; reason audited; NO payment row created', async () => {
    const bookingMgr = await loginStaff('br14-bm@test.dev', [
      'bookings:read',
      'bookings:manage',
    ]);
    const customerToken = await loginAs('br14-customer@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(
      customerToken,
      flight.id,
      seatsSmall.slice(0, 2).map((s) => s.id),
    );

    const res = await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'Corporate group contract — invoice billed separately' })
      .expect(200);
    expect(res.body.booking.status).toBe('CONFIRMED');

    // BR-14 must not fabricate a payment record.
    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(0);

    const holds = await prismaTestClient.seatHold.findMany({
      where: { bookingId: booking.id },
    });
    expect(holds.every((h) => h.status === 'CONVERTED')).toBe(true);
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(2);

    const br14Events = await prismaTestClient.auditLog.findMany({
      where: { action: 'BR14_PAYMENT_EXCEPTION', targetId: booking.id },
    });
    expect(br14Events).toHaveLength(1);
    expect(br14Events[0]!.actorType).toBe('Staff');
    expect((br14Events[0]!.metadata as Record<string, unknown>)['reason']).toBe(
      'Corporate group contract — invoice billed separately',
    );
    // Distinguished from the normal payment path.
    expect(
      await prismaTestClient.auditLog.count({
        where: { action: 'PAYMENT_SUCCEEDED' },
      }),
    ).toBe(0);
  });

  it('BR-14: reason is mandatory (400), customers and unauthorized staff get 403, non-pending gets 409', async () => {
    const bookingMgr = await loginStaff('br14-val-bm@test.dev', [
      'bookings:manage',
    ]);
    const finance = await loginStaff('br14-val-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const customerToken = await loginAs('br14-val-customer@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(
      customerToken,
      flight.id,
      seatsSmall.slice(0, 3).map((s) => s.id),
    );

    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'short' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'customer must never do this' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ reason: 'finance cannot confirm bookings' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'Legitimate exception per policy' })
      .expect(200);

    // No longer pending → 409.
    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'Second attempt must fail' })
      .expect(409);

    expect(
      await prismaTestClient.payment.count({
        where: { bookingId: booking.id },
      }),
    ).toBe(0);
  });

  it('BR-14: expired holds cannot be converted by the exception either', async () => {
    const bookingMgr = await loginStaff('br14-exp@test.dev', [
      'bookings:manage',
    ]);
    const customerToken = await loginAs('br14-exp-customer@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const booking = await createPendingBooking(customerToken, flight.id, [
      seatsSmall[0]!.id,
    ]);
    await prismaTestClient.seatHold.updateMany({
      where: { bookingId: booking.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post(`/api/admin/bookings/${booking.id}/confirm-exception`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({ reason: 'Attempt with expired holds' })
      .expect(409);
    const stored = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.status).toBe('PENDING');
  });

  // ---------- Dashboard revenue ----------

  it('dashboard revenue reflects real payments minus processed refunds', async () => {
    const finance = await loginStaff('dash-finance@test.dev', [
      'dashboard:read',
      'payments:read',
      'payments:refund',
    ]);
    const first = await paidBooking('dash-a@test.dev'); // 505
    const second = await paidBooking('dash-b@test.dev', true, 1); // 505 — distinct seat, same flight
    void second;
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${first.paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ amount: 105 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard?range=7d')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(res.body.revenue).toBe(905); // 505 + 505 − 105
    expect(res.body.currency).toBe('EUR');
    expect(Array.isArray(res.body.revenueTrend)).toBe(true);
    expect(res.body.revenueTrend).toHaveLength(7);
    const today = res.body.revenueTrend[6];
    expect(today.value).toBe(905);
    expect(
      res.body.revenueTrend.reduce(
        (s: number, p: { value: number }) => s + p.value,
        0,
      ),
    ).toBe(905);
  });
});
