import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import { PaymentReconciliationService } from '../src/payments/payment-reconciliation.service.js';
import { RefundReconciliationService } from '../src/payments/refund-reconciliation.service.js';
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
        idempotencyKey: randomUUID(),
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
        idempotencyKey: randomUUID(),
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

  /** Customer cancellation request (paid bookings cancel via staff review). */
  function requestCancellation(
    customerToken: string,
    bookingId: string,
    reason?: string,
  ) {
    return request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/cancellation-request`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send(reason === undefined ? {} : { reason });
  }

  function approveCancellationRequest(staffToken: string, requestId: string) {
    return request(app.getHttpServer())
      .post(`/api/admin/cancellation-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);
  }

  function rejectCancellationRequest(
    staffToken: string,
    requestId: string,
    rejectionReason?: string,
  ) {
    return request(app.getHttpServer())
      .post(`/api/admin/cancellation-requests/${requestId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(rejectionReason === undefined ? {} : { rejectionReason });
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
    expect(list.body).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      bookingReference: booking.reference,
      contactEmail: 'reflist-customer@test.dev',
      amount: 100,
      status: 'PROCESSED',
      paymentStatus: 'PARTIALLY_REFUNDED',
      paymentProviderReference: expect.stringMatching(/^mockpay_/),
      recoveryKey: expect.stringMatching(/^refund-/),
      pendingAgeMinutes: null,
      pendingRecovery: false,
    });
  });

  it('admin refunds listing: filters by status/booking reference/pending age and paginates', async () => {
    const finance = await loginStaff('refops-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking('refops@test.dev');
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ amount: 100, reason: 'Partial goodwill' })
      .expect(201);
    // A stale stuck refund (backdated beyond the sweep age) and a fresh one.
    const stale = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 50,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Crash-window artifact',
        createdAt: new Date(Date.now() - 30 * 60_000),
      },
    });
    await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 25,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Just now',
      },
    });

    const pending = await request(app.getHttpServer())
      .get('/api/admin/refunds?status=PENDING&pendingMinAgeMinutes=15')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(pending.body.total).toBe(1);
    expect(pending.body.items[0]).toMatchObject({
      id: stale.id,
      status: 'PENDING',
      pendingRecovery: true,
    });
    expect(pending.body.items[0].pendingAgeMinutes).toBeGreaterThanOrEqual(15);

    const byReference = await request(app.getHttpServer())
      .get(`/api/admin/refunds?bookingReference=${booking.reference.toLowerCase()}`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(byReference.body.total).toBe(3);

    const page = await request(app.getHttpServer())
      .get('/api/admin/refunds?page=2&limit=2')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(page.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(page.body.items).toHaveLength(1);
  });

  it('refund operations snapshot: buckets, metrics, alerts and authorization (3.4D/3.4F)', async () => {
    const finance = await loginStaff('refmetrics-fin@test.dev', [
      'payments:read',
    ]);
    const bookingMgr = await loginStaff('refmetrics-bm@test.dev', [
      'bookings:manage',
    ]);
    const { booking, paymentId } = await paidBooking('refmetrics@test.dev');
    await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 50,
        currency: 'EUR',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 2 * 60_000),
      },
    });
    await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 75,
        currency: 'EUR',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 90 * 60_000),
      },
    });

    await request(app.getHttpServer())
      .get('/api/admin/refunds/operations')
      .set('Authorization', `Bearer ${bookingMgr}`)
      .expect(403);

    // Counters are process-global across the suite: measure the delta of one
    // real service-flow refund around this test.
    const before = await request(app.getHttpServer())
      .get('/api/admin/refunds/operations')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    const refundFinance = await loginStaff('refmetrics-ref@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${refundFinance}`)
      .send({ amount: 25, reason: 'Metrics delta' })
      .expect(201);

    const ops = await request(app.getHttpServer())
      .get('/api/admin/refunds/operations')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(ops.body.pending.total).toBe(2);
    expect(ops.body.pending.buckets).toMatchObject({
      lt5m: 1,
      m5to15: 0,
      m15to60: 0,
      h1to6: 1,
      h6to24: 0,
      gt24h: 0,
    });
    // The 90-minute-old refund is beyond the 60-minute alert threshold.
    expect(ops.body.pending.stuck).toBe(1);
    expect(ops.body.orphans).toEqual({ unmatched: 0 });
    const createdDelta =
      ops.body.metrics.counters.refunds_created_total -
      before.body.metrics.counters.refunds_created_total;
    const processedDelta =
      ops.body.metrics.counters.refunds_processed_total -
      before.body.metrics.counters.refunds_processed_total;
    expect(createdDelta).toBe(1);
    expect(processedDelta).toBe(1);
    expect(ops.body.metrics.gauges).toMatchObject({
      refunds_pending: 2,
      refunds_pending_stuck: 1,
    });
    expect(ops.body.alerts.active).toEqual([]);
    // No identifiers in metric dimensions — only plain counter names.
    expect(JSON.stringify(ops.body.metrics)).not.toContain(booking.id);
  });

  it('manual recovery is audited with actor, refund and outcome (3.4D)', async () => {
    const finance = await loginStaff('refaudit-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking('refaudit@test.dev');
    const stuck = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 100,
        currency: 'EUR',
        status: 'PENDING',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(201);

    const audits = await auditRows('REFUND_RECOVERY_REQUESTED', stuck.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorType).toBe('Staff');
    expect(audits[0]!.metadata).toMatchObject({ outcome: 'processed' });
  });

  // ---------- Refund recovery (resume) ----------

  it('resumes a stuck PENDING refund: PROCESSED with the provider reference, payment recomputed, safe to repeat', async () => {
    const finance = await loginStaff('resume-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking('resume-customer@test.dev');
    const stuck = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 200,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Stuck after crash',
      },
    });

    const resumed = await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(201);
    expect(resumed.body.refund).toMatchObject({
      id: stuck.id,
      status: 'PROCESSED',
      amount: 200,
    });
    expect(resumed.body.refund.providerReference).toMatch(/^mockref_mockpay_/);
    expect(resumed.body.refund.processedAt).toBeTruthy();
    expect(resumed.body.payment.status).toBe('PARTIALLY_REFUNDED');

    const stored = await prismaTestClient.refund.findUniqueOrThrow({
      where: { id: stuck.id },
    });
    expect(stored.status).toBe('PROCESSED');
    expect(stored.providerReference).toBe(resumed.body.refund.providerReference);
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(
      1,
    );

    // Repeated recovery: no new refund row, no new provider reference.
    const again = await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(201);
    expect(again.body.refund.providerReference).toBe(stored.providerReference);
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(
      1,
    );

    const refundAudits = await auditRows('REFUND_COMPLETED');
    expect(refundAudits).toHaveLength(1);
  });

  it('settles the payment as REFUNDED when the resumed refund completes the total', async () => {
    const finance = await loginStaff('resume-full-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking('resume-full@test.dev');
    const stuck = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 505,
        currency: 'EUR',
        status: 'PENDING',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(201);
    expect(res.body.refund.status).toBe('PROCESSED');
    expect(res.body.payment.status).toBe('REFUNDED');
    expect(
      (
        await prismaTestClient.payment.findUniqueOrThrow({
          where: { id: paymentId },
        })
      ).status,
    ).toBe('REFUNDED');
  });

  it('resume guards: 401 unauthenticated, 403 customer, 403 wrong permission, 404 unknown, 409 REJECTED', async () => {
    const finance = await loginStaff('resume-authz-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const bookingMgr = await loginStaff('resume-authz-bm@test.dev', [
      'bookings:manage',
    ]);
    const { booking, paymentId, customerToken } = await paidBooking(
      'resume-authz@test.dev',
    );
    const stuck = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 100,
        currency: 'EUR',
        status: 'PENDING',
      },
    });
    const rejected = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 50,
        currency: 'EUR',
        status: 'REJECTED',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/refunds/${stuck.id}/resume`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/refunds/${randomUUID()}/resume`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/admin/refunds/${rejected.id}/resume`)
      .set('Authorization', `Bearer ${finance}`)
      .expect(409);

    // The failed attempts finalized nothing.
    expect(
      (
        await prismaTestClient.refund.findUniqueOrThrow({
          where: { id: stuck.id },
        })
      ).status,
    ).toBe('PENDING');
    expect(
      (
        await prismaTestClient.refund.findUniqueOrThrow({
          where: { id: rejected.id },
        })
      ).status,
    ).toBe('REJECTED');
  });

  it('two concurrent resumes converge: one provider refund, one audit, both callers see PROCESSED', async () => {
    const finance = await loginStaff('resume-race-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, paymentId } = await paidBooking('resume-race@test.dev');
    const stuck = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 200,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Stuck after crash',
      },
    });

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/admin/refunds/${stuck.id}/resume`)
        .set('Authorization', `Bearer ${finance}`),
      request(app.getHttpServer())
        .post(`/api/admin/refunds/${stuck.id}/resume`)
        .set('Authorization', `Bearer ${finance}`),
    ]);

    // Both callers observe the committed success — the CAS loser replays the
    // winner's state instead of finalizing (or refunding) again.
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.refund.status).toBe('PROCESSED');
    expect(b.body.refund.status).toBe('PROCESSED');
    expect(a.body.refund.providerReference).toBe(
      b.body.refund.providerReference,
    );
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(
      1,
    );
    expect(await auditRows('REFUND_COMPLETED', stuck.id)).toHaveLength(1);
  });

  // ---------- Reconciliation sweep wiring ----------

  it('reconciliation sweep is wired into the module and no-ops under the mock provider', async () => {
    // The sweep is Stripe-mode only; with PAYMENT_PROVIDER=mock it must not
    // touch the database. Stripe retrieve behavior is covered by unit tests
    // and live verification, keeping this suite deterministic.
    const reconciliation = moduleFixture.get(PaymentReconciliationService);
    const summary = await reconciliation.reconcileStalePendingPayments();
    expect(summary).toEqual({
      eligible: 0,
      succeeded: 0,
      canceled: 0,
      noted: 0,
      failed: 0,
    });
  });

  it('refund reconciliation sweep converges stale PENDING refunds and leaves fresh/terminal rows untouched', async () => {
    const { booking, paymentId } = await paidBooking('refund-sweep@test.dev');
    // Older than PAYMENT_REFUND_RECONCILIATION_MIN_AGE_MINUTES (5): eligible.
    const stale = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 200,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Crash-window artifact',
        createdAt: new Date(Date.now() - 10 * 60_000),
      },
    });
    // Just created: not yet eligible — the sweep must not rush fresh refunds.
    const fresh = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 100,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'In flight right now',
      },
    });
    // Terminal: never eligible, never resurrected.
    const rejected = await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId: booking.id,
        amount: 50,
        currency: 'EUR',
        status: 'REJECTED',
        createdAt: new Date(Date.now() - 10 * 60_000),
      },
    });

    const sweep = moduleFixture.get(RefundReconciliationService);
    const summary = await sweep.reconcileStalePendingRefunds();
    expect(summary).toEqual({
      eligible: 1,
      processed: 1,
      pending: 0,
      rejected: 0,
      failed: 0,
    });

    // LOCAL PENDING + provider replay succeeds → PROCESSED with the provider
    // reference; the payment status is recomputed from committed refunds.
    const converged = await prismaTestClient.refund.findUniqueOrThrow({
      where: { id: stale.id },
    });
    expect(converged.status).toBe('PROCESSED');
    expect(converged.providerReference).toMatch(/^mockref_mockpay_/);
    expect(converged.processedAt).toBeTruthy();
    expect(
      (
        await prismaTestClient.payment.findUniqueOrThrow({
          where: { id: paymentId },
        })
      ).status,
    ).toBe('PARTIALLY_REFUNDED');

    // Fresh PENDING and REJECTED rows are untouched.
    expect(
      (
        await prismaTestClient.refund.findUniqueOrThrow({
          where: { id: fresh.id },
        })
      ).status,
    ).toBe('PENDING');
    expect(
      (
        await prismaTestClient.refund.findUniqueOrThrow({
          where: { id: rejected.id },
        })
      ).status,
    ).toBe('REJECTED');

    // The sweep audits as the System actor via the reconciliation path.
    const audits = await auditRows('REFUND_COMPLETED', stale.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorType).toBe('System');
    expect(audits[0]!.metadata).toMatchObject({ via: 'reconciliation' });
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
    const seatId = (
      await prismaTestClient.bookingSeat.findFirstOrThrow({
        where: { bookingPassenger: { bookingId: booking.id } },
      })
    ).seatId;

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

    // Seat is freed: cancellation deletes the BookingSeat rows (the booking row
    // itself is preserved), so the availability endpoint no longer shows the
    // seat as occupied.
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(0);
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

  // ---------- Customer cancellation requests (paid bookings) ----------

  it('full flow: customer requests, admin lists, approves — mock provider refund PROCESSED, booking CANCELLED, seats freed', async () => {
    const staff = await loginStaff('cr-flow-bm@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-100@test.dev',
    );
    const { flight, seatsSmall } = await fixtures();
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 8 * 86_400_000) },
    });

    const created = await requestCancellation(
      customerToken,
      booking.id,
      'Trip cancelled',
    ).expect(201);
    expect(created.body).toMatchObject({
      bookingId: booking.id,
      status: 'PENDING',
      reason: 'Trip cancelled',
    });
    expect(created.body.requestedAt).toBeTruthy();

    // The admin worklist shows the request with booking, customer, flight,
    // payment and the live policy evaluation (100% tier at +8 days).
    const list = await request(app.getHttpServer())
      .get('/api/admin/cancellation-requests?status=PENDING')
      .set('Authorization', `Bearer ${staff}`)
      .expect(200);
    const item = list.body.find(
      (r: { id: string }) => r.id === created.body.id,
    );
    expect(item).toMatchObject({
      status: 'PENDING',
      reason: 'Trip cancelled',
      booking: {
        id: booking.id,
        status: 'CONFIRMED',
        totalAmount: 505,
        currency: 'EUR',
      },
      customer: { email: 'cancel-pol-100@test.dev' },
      flight: { flightNumber: 'NV900', originIata: 'FRA', destinationIata: 'JFK' },
      payment: { amount: 505, currency: 'EUR', status: 'SUCCESS' },
      policy: { refundPercentage: 100, refundableAmount: 505, currency: 'EUR' },
      refund: null,
    });

    const approved = await approveCancellationRequest(
      staff,
      created.body.id,
    ).expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      booking: { status: 'CANCELLED' },
      refund: { status: 'PROCESSED', amount: 505 },
    });

    const payment = await prismaTestClient.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    expect(payment.status).toBe('REFUNDED');
    const refunds = await prismaTestClient.refund.findMany({
      where: { paymentId },
    });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0]!.amount)).toBe(505);
    expect(refunds[0]!.status).toBe('PROCESSED');
    expect(refunds[0]!.providerReference).toMatch(/^mockref_mockpay_/);

    // Inventory freed: BookingSeat rows are gone and the seat is resalable.
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(0);
    const availability = await request(app.getHttpServer())
      .get(`/api/flights/${flight.id}/seat-availability`)
      .expect(200);
    expect(availability.body.occupiedSeatIds).not.toContain(seatsSmall[0]!.id);

    // The customer sees the request outcome on the booking view.
    const view = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(view.body.cancellationRequest).toMatchObject({
      id: created.body.id,
      status: 'APPROVED',
    });

    // Both sides of the review are audited.
    const actions = (await auditRows('CANCELLATION_REQUESTED'))
      .concat(await auditRows('CANCELLATION_REQUEST_APPROVED'))
      .map((a) => a.action)
      .sort();
    expect(actions).toEqual([
      'CANCELLATION_REQUESTED',
      'CANCELLATION_REQUEST_APPROVED',
    ]);
  });

  it('policy 80%: approval 3–6 days before departure refunds the tier share', async () => {
    const staff = await loginStaff('cr-approve-80@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-80@test.dev',
    );
    const { flight } = await fixtures();
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 5 * 86_400_000) },
    });

    const created = await requestCancellation(customerToken, booking.id).expect(201);
    await approveCancellationRequest(staff, created.body.id).expect(200);

    const refunds = await prismaTestClient.refund.findMany({
      where: { paymentId },
    });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0]!.amount)).toBe(404);
    expect(refunds[0]!.status).toBe('PROCESSED');
    // The refund finalizes while the booking is still CONFIRMED (the
    // finalization hook cancels it afterwards), so a mid-tier refund settles
    // as PARTIALLY_REFUNDED — the withheld 20% share is not a remainder.
    expect(
      (await prismaTestClient.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
    ).toBe('PARTIALLY_REFUNDED');
    expect(
      (await prismaTestClient.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
    ).toBe('CANCELLED');
  });

  it('policy 50%: approval 24–72 hours before departure (fixture default +2 days)', async () => {
    const staff = await loginStaff('cr-approve-50@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-50@test.dev',
    );

    const created = await requestCancellation(customerToken, booking.id).expect(201);
    await approveCancellationRequest(staff, created.body.id).expect(200);

    const refunds = await prismaTestClient.refund.findMany({
      where: { paymentId },
    });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0]!.amount)).toBe(252.5);
    expect(refunds[0]!.status).toBe('PROCESSED');
  });

  it('policy 0%: approval less than 24 hours before departure cancels immediately without refund or provider activity', async () => {
    const staff = await loginStaff('cr-approve-0@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-0@test.dev',
    );
    const { flight } = await fixtures();
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 12 * 3_600_000) },
    });

    const created = await requestCancellation(customerToken, booking.id).expect(201);
    const approved = await approveCancellationRequest(staff, created.body.id).expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      booking: { status: 'CANCELLED' },
      refund: null,
    });

    expect(
      (await prismaTestClient.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
    ).toBe('CANCELLED');
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(0);
    expect(
      (await prismaTestClient.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
    ).toBe('SUCCESS');
  });

  it('policy non-refundable: approval of a fare without a refund policy cancels with no refund', async () => {
    const staff = await loginStaff('cr-approve-nr@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-nr@test.dev',
      false, // noRulesFlight — fare has no fareRules configured
    );

    const created = await requestCancellation(customerToken, booking.id).expect(201);
    await approveCancellationRequest(staff, created.body.id).expect(200);

    expect(
      (await prismaTestClient.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
    ).toBe('CANCELLED');
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(0);
    expect(
      (await prismaTestClient.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
    ).toBe('SUCCESS');
  });

  it('policy after departure: the cancellation request is rejected and nothing changes', async () => {
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-late@test.dev',
    );
    const { flight } = await fixtures();
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() - 3_600_000) },
    });

    await requestCancellation(customerToken, booking.id).expect(409);

    expect(
      (await prismaTestClient.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
    ).toBe('CONFIRMED');
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(0);
    expect(
      await prismaTestClient.bookingSeat.count({
        where: { bookingPassenger: { bookingId: booking.id } },
      }),
    ).toBe(1);
  });

  it('request guards: direct paid cancel 409 CANCELLATION_REQUEST_REQUIRED, duplicate request 409 CANCELLATION_REQUEST_PENDING, one refund', async () => {
    const staff = await loginStaff('cr-twice-bm@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-pol-twice@test.dev',
    );

    // Direct cancellation of a paid booking now requires staff review.
    const direct = await request(app.getHttpServer())
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(409);
    expect(direct.body).toMatchObject({ code: 'CANCELLATION_REQUEST_REQUIRED' });

    const first = await requestCancellation(customerToken, booking.id).expect(201);
    const duplicate = await requestCancellation(customerToken, booking.id).expect(409);
    expect(duplicate.body).toMatchObject({ code: 'CANCELLATION_REQUEST_PENDING' });

    await approveCancellationRequest(staff, first.body.id).expect(200);
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(1);

    // After the cancellation both endpoints reject.
    await requestCancellation(customerToken, booking.id).expect(409);
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(409);
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(1);
  });

  it('rejected request: booking stays CONFIRMED, no refund, customer sees the rejection; double review 409', async () => {
    const staff = await loginStaff('cr-reject-bm@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cr-reject@test.dev',
    );

    const created = await requestCancellation(customerToken, booking.id).expect(201);

    // The customer sees the pending request on the booking view.
    const during = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(during.body.cancellationRequest).toMatchObject({
      id: created.body.id,
      status: 'PENDING',
    });

    const rejected = await rejectCancellationRequest(
      staff,
      created.body.id,
      'Outside the policy window',
    ).expect(200);
    expect(rejected.body).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Outside the policy window',
      booking: { status: 'CONFIRMED' },
      refund: null,
    });

    expect(
      (await prismaTestClient.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
    ).toBe('CONFIRMED');
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(0);

    // A rejected request cannot be reviewed again either way.
    await rejectCancellationRequest(staff, created.body.id).expect(409);
    await approveCancellationRequest(staff, created.body.id).expect(409);

    const after = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(after.body.cancellationRequest).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Outside the policy window',
    });
  });

  it('request authorization and scoping: 401 unauthenticated, 404 for another customer, 409 for an unpaid booking, 403 without bookings:manage', async () => {
    const staff = await loginStaff('cr-authz-bm@test.dev', ['bookings:manage']);
    const finance = await loginStaff('cr-authz-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const { booking, customerToken } = await paidBooking('cr-authz@test.dev');

    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.id}/cancellation-request`)
      .send({})
      .expect(401);
    const other = await loginAs('cr-authz-other@test.dev');
    await requestCancellation(other, booking.id).expect(404);

    const created = await requestCancellation(customerToken, booking.id).expect(201);
    await request(app.getHttpServer())
      .get('/api/admin/cancellation-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/cancellation-requests')
      .set('Authorization', `Bearer ${finance}`)
      .expect(403);
    await approveCancellationRequest(finance, created.body.id).expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/cancellation-requests')
      .expect(401);

    // Unpaid bookings cancel directly — no request needed.
    const { flight, seatsSmall } = await fixtures();
    const pending = await createPendingBooking(customerToken, flight.id, [
      seatsSmall[1]!.id,
    ]);
    const unpaid = await requestCancellation(customerToken, pending.id).expect(409);
    expect(unpaid.body.message).toMatch(/cancel the booking directly/);
    void staff;
  });

  // ---------- Cancellation preview ----------

  it('preview: server-calculated 100% refund values for the booking owner', async () => {
    const { booking, customerToken } = await paidBooking('preview-100@test.dev');
    const { flight } = await fixtures();
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 8 * 86_400_000) },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/cancellation-preview`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(res.body).toMatchObject({
      allowed: true,
      reason: 'REFUND_100_PERCENT',
      refundPercentage: 100,
      refundAmount: 505,
      paidAmount: 505,
      retainedAmount: 0,
      currency: 'EUR',
    });
    expect(res.body.departureTime).toBeTruthy();
  });

  it('preview: 401 unauthenticated, 404 for another customer, and never creates refund activity', async () => {
    const { booking, paymentId } = await paidBooking('preview-owner@test.dev');
    const other = await loginAs('preview-other@test.dev');

    await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/cancellation-preview`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/cancellation-preview`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(0);
  });

  it('preview: a PENDING booking previews as allowed with zero amounts', async () => {
    const token = await loginAs('preview-pending@test.dev');
    const { flight, seatsSmall } = await fixtures();
    const created = await createPendingBooking(token, flight.id, [
      seatsSmall[0]!.id,
    ]);

    const res = await request(app.getHttpServer())
      .get(`/api/bookings/${created.id}/cancellation-preview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({
      allowed: true,
      paidAmount: 0,
      refundAmount: 0,
      retainedAmount: 0,
    });
  });

  it('the final approval recalculates independently of a stale preview', async () => {
    const staff = await loginStaff('cr-stale-bm@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'preview-stale@test.dev',
    );
    const { flight } = await fixtures();
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 5 * 86_400_000) },
    });

    const preview = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}/cancellation-preview`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(preview.body.refundPercentage).toBe(80);

    // Context changes after the preview: departure moves beyond 7 days.
    await prismaTestClient.flight.update({
      where: { id: flight.id },
      data: { departureTime: new Date(Date.now() + 8 * 86_400_000) },
    });

    const created = await requestCancellation(customerToken, booking.id).expect(201);
    await approveCancellationRequest(staff, created.body.id).expect(200);
    // The server's final decision wins: 100%, not the previewed 80%.
    const refunds = await prismaTestClient.refund.findMany({
      where: { paymentId },
    });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0]!.amount)).toBe(505);
  });

  it('two concurrent approvals converge: one success, one conflict, exactly one refund', async () => {
    const staff = await loginStaff('cr-race-bm@test.dev', ['bookings:manage']);
    const { booking, paymentId, customerToken } = await paidBooking(
      'cancel-race@test.dev',
    );
    const created = await requestCancellation(customerToken, booking.id).expect(201);

    const results = await Promise.all([
      approveCancellationRequest(staff, created.body.id),
      approveCancellationRequest(staff, created.body.id),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prismaTestClient.refund.count({ where: { paymentId } })).toBe(
      1,
    );
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
