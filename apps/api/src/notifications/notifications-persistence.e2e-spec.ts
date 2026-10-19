import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';
import { MAIL_ADAPTER, type MailMessage } from '../mail/mail.adapter.js';
import { generateSeatMap } from '../aircraft/seat-map.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from '../../test/test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Patch 1.1: REAL-persistence proof for the notification hooks, against the
 * dedicated disposable *_test database with the notifications_inbox_fields
 * migration applied. Nothing here mocks the database: assertions read rows
 * via Prisma and through the live HTTP API. If the migration is missing, the
 * beforeAll schema probe fails loudly instead of letting safeNotify swallow
 * the insert errors.
 */
describe('Notification persistence (e2e)', () => {
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

    // Fail clearly when the Patch 1 migration is not applied to this database.
    const columns = await prismaTestClient.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'notifications'
        AND column_name IN ('type', 'title', 'read_at', 'dedupe_key')
    `;
    expect(
      columns.length,
      'notifications table is missing the Patch 1 inbox columns — apply ' +
        '20261013133309_notifications_inbox_fields to the test database first',
    ).toBe(4);
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
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } }),
      prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } }),
    ]);
    await prismaTestClient.route.create({
      data: {
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        distanceKm: 6201,
        durationMinutes: 505,
      },
    });
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
    });
    await prismaTestClient.seat.createMany({
      data: generateSeatMap(aircraft.capacity).map((s) => ({
        ...s,
        aircraftId: aircraft.id,
        features: {},
      })),
    });
    const departure = new Date(Date.now() + 2 * 86_400_000);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV900',
        routeId: (await prismaTestClient.route.findFirstOrThrow()).id,
        aircraftId: aircraft.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
        status: 'SCHEDULED',
      },
    });
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
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
      },
    });
  });

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

  async function createAndPay(token: string, idempotencyKey = randomUUID()) {
    const flight = await prismaTestClient.flight.findFirstOrThrow();
    const seat = await prismaTestClient.seat.findFirstOrThrow({
      orderBy: { seatNumber: 'asc' },
    });
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idempotencyKey: randomUUID(),
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        seatIds: [seat.id],
        passengers: [
          {
            firstName: 'Pass1',
            lastName: 'Tester',
            passengerType: 'ADULT',
            dateOfBirth: '1990-01-01',
          },
        ],
      })
      .expect(201);
    const payRes = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingRes.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey });
    return {
      bookingId: bookingRes.body.id as string,
      bookingReference: bookingRes.body.bookingReference as string,
      payRes,
      idempotencyKey,
    };
  }

  const rowsFor = (bookingId: string) =>
    prismaTestClient.notification.findMany({
      where: { bookingId, channel: 'IN_APP' },
      orderBy: { createdAt: 'asc' },
    });

  it('persists PAYMENT_SUCCEEDED and BOOKING_CONFIRMED rows on a successful payment', async () => {
    const token = await loginAs('notif-payer@test.dev');
    const { bookingId, bookingReference, payRes } = await createAndPay(token);
    expect(payRes.status).toBe(201);

    const rows = await rowsFor(bookingId);
    expect(rows).toHaveLength(2);

    const byType = Object.fromEntries(rows.map((r) => [r.type, r]));
    const paymentRow = byType['PAYMENT_SUCCEEDED']!;
    const bookingRow = byType['BOOKING_CONFIRMED']!;

    for (const row of rows) {
      expect(row.channel).toBe('IN_APP');
      expect(row.status).toBe('SENT');
      expect(row.sentAt).not.toBeNull();
      expect(row.readAt).toBeNull();
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.content).toContain(bookingReference);
    }
    expect(paymentRow.dedupeKey).toMatch(/^payment-succeeded:payment:.+/);
    expect(bookingRow.dedupeKey).toBe(`booking-confirmed:booking:${bookingId}`);

    const recipient = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'notif-payer@test.dev' },
    });
    expect(rows.every((r) => r.userId === recipient.id)).toBe(true);

    // The customer API reads the same persisted state.
    const list = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.total).toBe(2);
    const unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unread.body).toEqual({ count: 2 });
  });

  it('replaying the same payment (idempotency key) creates no duplicate rows', async () => {
    const token = await loginAs('notif-replay@test.dev');
    const idempotencyKey = randomUUID();
    const { bookingId, payRes } = await createAndPay(token, idempotencyKey);
    expect(payRes.status).toBe(201);

    const replay = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey })
      .expect(201);
    expect(replay.body.payment.status).toBe('SUCCESS');

    expect(await rowsFor(bookingId)).toHaveLength(2);
  });

  it('isolates rows per user: a stranger sees nothing and gets 404 marking read', async () => {
    const ownerToken = await loginAs('notif-owner@test.dev');
    const strangerToken = await loginAs('notif-stranger@test.dev');
    const { bookingId } = await createAndPay(ownerToken);
    const [row] = await rowsFor(bookingId);
    expect(row).toBeDefined();

    const strangerList = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    expect(strangerList.body.total).toBe(0);
    const strangerUnread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    expect(strangerUnread.body).toEqual({ count: 0 });
    await request(app.getHttpServer())
      .patch(`/api/notifications/${row!.id}/read`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(404);

    // Unchanged in the database.
    const after = await prismaTestClient.notification.findUniqueOrThrow({
      where: { id: row!.id },
    });
    expect(after.readAt).toBeNull();
  });

  it('mark-one and mark-all persist readAt and drive the unread count', async () => {
    const token = await loginAs('notif-reader@test.dev');
    const { bookingId } = await createAndPay(token);
    const rows = await rowsFor(bookingId);
    expect(rows).toHaveLength(2);

    const first = await request(app.getHttpServer())
      .patch(`/api/notifications/${rows[0]!.id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.readAt).not.toBeNull();

    // Idempotent: a second mark does not move readAt.
    const again = await request(app.getHttpServer())
      .patch(`/api/notifications/${rows[0]!.id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(again.body.readAt).toEqual(first.body.readAt);

    let unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unread.body).toEqual({ count: 1 });

    const all = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(all.body).toEqual({ updated: 1 });

    const persisted = await rowsFor(bookingId);
    expect(persisted.every((r) => r.readAt !== null)).toBe(true);
    unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unread.body).toEqual({ count: 0 });
  });
});

/**
 * Fail-soft proof against the real wiring: NotificationsService throws for
 * every hook; the payment must still commit and answer 201.
 */
describe('Notification failure isolation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .overrideProvider(NotificationsService)
      .useValue({
        notifyBookingConfirmed: vi.fn().mockRejectedValue(new Error('forced insert failure')),
        notifyPaymentSucceeded: vi.fn().mockRejectedValue(new Error('forced insert failure')),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
  });

  it('payment commits and responds 201 even when every notification insert throws', async () => {
    await registerVerifiedUser(app, {
      email: 'notif-failsoft@test.dev',
      password: PASSWORD,
      firstName: 'Pay',
      lastName: 'Customer',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'notif-failsoft@test.dev', password: PASSWORD });
    const token = login.body.accessToken as string;

    // Minimal bookable graph (same shape as the main suite, one flight).
    const fra = await prismaTestClient.airport.create({
      data: {
        iataCode: 'FRA',
        name: 'Frankfurt Airport',
        city: 'Frankfurt',
        country: 'Germany',
        timezone: 'Europe/Berlin',
      },
    });
    const jfk = await prismaTestClient.airport.create({
      data: {
        iataCode: 'JFK',
        name: 'JFK International',
        city: 'New York',
        country: 'United States',
        timezone: 'America/New_York',
      },
    });
    const route = await prismaTestClient.route.create({
      data: {
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        distanceKm: 6201,
        durationMinutes: 505,
      },
    });
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
    });
    await prismaTestClient.seat.createMany({
      data: generateSeatMap(aircraft.capacity).map((s) => ({
        ...s,
        aircraftId: aircraft.id,
        features: {},
      })),
    });
    const departure = new Date(Date.now() + 2 * 86_400_000);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV900',
        routeId: route.id,
        aircraftId: aircraft.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
        status: 'SCHEDULED',
      },
    });
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
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
      },
    });
    const seat = await prismaTestClient.seat.findFirstOrThrow({
      orderBy: { seatNumber: 'asc' },
    });

    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idempotencyKey: randomUUID(),
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        seatIds: [seat.id],
        passengers: [
          {
            firstName: 'Pass1',
            lastName: 'Tester',
            passengerType: 'ADULT',
            dateOfBirth: '1990-01-01',
          },
        ],
      })
      .expect(201);

    const payRes = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingRes.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey: randomUUID() })
      .expect(201);
    expect(payRes.body.payment.status).toBe('SUCCESS');

    const payment = await prismaTestClient.payment.findFirstOrThrow({
      where: { bookingId: bookingRes.body.id },
    });
    expect(payment.status).toBe('SUCCESS');
    const booking = await prismaTestClient.booking.findUniqueOrThrow({
      where: { id: bookingRes.body.id },
    });
    expect(booking.status).toBe('CONFIRMED');
    expect(
      await prismaTestClient.notification.count({ where: { bookingId: booking.id } }),
    ).toBe(0);
  });
});

/**
 * Patch 3: email delivery + lifecycle events against the real database, with
 * a deterministic fake MAIL_ADAPTER outbox (never a real provider). Covers:
 * queued→sent email on booking confirmation, PAYMENT_FAILED, cancellation
 * approve/reject, REFUND_PROCESSED. Retry behavior is covered in the next
 * describe; the shared bookable-graph seed lives at the end of the file.
 */
describe('Email delivery and lifecycle events (e2e)', () => {
  let app: INestApplication<App>;
  let delivery: NotificationDeliveryService;
  const outbox: MailMessage[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .overrideProvider(MAIL_ADAPTER)
      .useValue({
        send: vi.fn(async (message: MailMessage) => {
          outbox.push(message);
        }),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    delivery = moduleFixture.get(NotificationDeliveryService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    outbox.length = 0;
    await resetDatabase(prismaTestClient);
    await seedBookableGraph({ refundable: true, cancellationFeePercent: 10 });
  });

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

  async function loginStaff(email: string, permissions: string[]): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Staff',
      lastName: 'Member',
    });
    const role = await prismaTestClient.role.create({ data: { name: `Role ${email}` } });
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
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
    await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: role.id } });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  async function createPaidBooking(token: string, seatIndex = 0) {
    const flight = await prismaTestClient.flight.findFirstOrThrow();
    const seats = await prismaTestClient.seat.findMany({
      orderBy: { seatNumber: 'asc' },
    });
    const seat = seats[seatIndex]!;
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idempotencyKey: randomUUID(),
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        seatIds: [seat.id],
        passengers: [
          {
            firstName: 'Pass1',
            lastName: 'Tester',
            passengerType: 'ADULT',
            dateOfBirth: '1990-01-01',
          },
        ],
      })
      .expect(201);
    const bookingId = bookingRes.body.id as string;
    const payRes = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey: randomUUID() });
    return {
      bookingId,
      bookingReference: bookingRes.body.bookingReference as string,
      payRes,
    };
  }

  const emailsForBooking = (bookingId: string, type: string) =>
    prismaTestClient.notification.findMany({
      where: { bookingId, channel: 'EMAIL', type },
    });

  it('queues a booking-confirmation email and the bounded sweep delivers it to the booking contact', async () => {
    const token = await loginAs('mail-payer@test.dev');
    const { bookingId, bookingReference, payRes } = await createPaidBooking(token);
    expect(payRes.status).toBe(201);

    const queued = await emailsForBooking(bookingId, 'BOOKING_CONFIRMED');
    expect(queued).toHaveLength(1);
    expect(['PENDING', 'RETRYING', 'SENT']).toContain(queued[0]!.status);

    const result = await delivery.sweepPendingEmails();
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const sent = await emailsForBooking(bookingId, 'BOOKING_CONFIRMED');
    expect(sent[0]!.status).toBe('SENT');
    expect(sent[0]!.sentAt).not.toBeNull();
    expect(sent[0]!.error).toBeNull();

    const mail = outbox.find((m) => m.text.includes(bookingReference));
    expect(mail).toBeDefined();
    expect(mail!.to).toBe('mail-payer@test.dev');
    expect(mail!.subject).toBe('Booking confirmed');
  });

  it('a declined payment queues PAYMENT_FAILED (in-app + email); the idempotent replay adds nothing', async () => {
    const token = await loginAs('mail-fail@test.dev');
    const idempotencyKey = randomUUID();
    const flight = await prismaTestClient.flight.findFirstOrThrow();
    const seat = await prismaTestClient.seat.findFirstOrThrow({
      orderBy: { seatNumber: 'asc' },
    });
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idempotencyKey: randomUUID(),
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        seatIds: [seat.id],
        passengers: [
          {
            firstName: 'Pass1',
            lastName: 'Tester',
            passengerType: 'ADULT',
            dateOfBirth: '1990-01-01',
          },
        ],
      })
      .expect(201);
    const bookingId = bookingRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_fail_card', idempotencyKey })
      .expect(402);
    await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_fail_card', idempotencyKey })
      .expect(402);

    const rows = await prismaTestClient.notification.findMany({
      where: { bookingId, type: 'PAYMENT_FAILED' },
    });
    expect(rows).toHaveLength(2); // one IN_APP + one EMAIL, deduped on replay
    await delivery.sweepPendingEmails();

    const email = rows.find((r) => r.channel === 'EMAIL')!;
    const after = await prismaTestClient.notification.findUniqueOrThrow({
      where: { id: email.id },
    });
    expect(after.status).toBe('SENT');
    expect(outbox.some((m) => m.subject === 'Payment failed')).toBe(true);
  });

  it('cancellation reject and approve(+auto-refund) notify the customer only on committed outcomes', async () => {
    const customerToken = await loginAs('mail-cancel@test.dev');
    const staffToken = await loginStaff('mail-staff@test.dev', [
      'bookings:manage',
      'payments:refund',
    ]);

    const rejectedBooking = await createPaidBooking(customerToken);
    const rejectReq = await request(app.getHttpServer())
      .post(`/api/bookings/${rejectedBooking.bookingId}/cancellation-request`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Plans changed' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/cancellation-requests/${rejectReq.body.id}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ rejectionReason: 'Fare rules do not allow cancellation' })
      .expect(200);

    const approvedBooking = await createPaidBooking(customerToken, 1);
    const approveReq = await request(app.getHttpServer())
      .post(`/api/bookings/${approvedBooking.bookingId}/cancellation-request`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'No longer travelling' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/cancellation-requests/${approveReq.body.id}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const lifecycleTypes = (
      await prismaTestClient.notification.findMany({
        where: { channel: 'IN_APP' },
        select: { type: true },
      })
    )
      .map((n) => n.type)
      .filter((t) => t !== 'BOOKING_CONFIRMED' && t !== 'PAYMENT_SUCCEEDED');
    expect(lifecycleTypes).toContain('CANCELLATION_REJECTED');
    expect(lifecycleTypes).toContain('CANCELLATION_APPROVED');
    expect(lifecycleTypes).toContain('REFUND_PROCESSED');

    const inbox = await request(app.getHttpServer())
      .get('/api/notifications?limit=50')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const inboxTypes = (inbox.body.data as { type: string }[]).map((n) => n.type);
    expect(inboxTypes).toContain('CANCELLATION_REJECTED');
    expect(inboxTypes).toContain('CANCELLATION_APPROVED');
    expect(inboxTypes).toContain('REFUND_PROCESSED');

    await delivery.sweepPendingEmails();
    const subjects = outbox.map((m) => m.subject);
    expect(subjects).toContain('Cancellation request rejected');
    expect(subjects).toContain('Cancellation approved');
    expect(subjects).toContain('Refund processed');
  });
});

/** Same flows with a failing adapter: backoff → terminal FAILED → never retried; inbox unaffected. */
describe('Email retry behavior (e2e)', () => {
  let app: INestApplication<App>;
  let delivery: NotificationDeliveryService;
  let sendMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    sendMock = vi.fn().mockRejectedValue(new Error('SMTP connection timeout'));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .overrideProvider(MAIL_ADAPTER)
      .useValue({ send: sendMock })
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    delivery = moduleFixture.get(NotificationDeliveryService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    sendMock.mockClear();
    await resetDatabase(prismaTestClient);
    await seedBookableGraph(null);
  });

  it('failed sends back off, exhaust to terminal FAILED, and are never retried — the inbox row stays intact', async () => {
    await registerVerifiedUser(app, {
      email: 'mail-retry@test.dev',
      password: PASSWORD,
      firstName: 'Pay',
      lastName: 'Customer',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'mail-retry@test.dev', password: PASSWORD });
    const token = login.body.accessToken as string;

    const flight = await prismaTestClient.flight.findFirstOrThrow();
    const seat = await prismaTestClient.seat.findFirstOrThrow({
      orderBy: { seatNumber: 'asc' },
    });
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idempotencyKey: randomUUID(),
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        seatIds: [seat.id],
        passengers: [
          {
            firstName: 'Pass1',
            lastName: 'Tester',
            passengerType: 'ADULT',
            dateOfBirth: '1990-01-01',
          },
        ],
      })
      .expect(201);
    const bookingId = bookingRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey: randomUUID() })
      .expect(201);

    const emailRow = await prismaTestClient.notification.findFirstOrThrow({
      where: { bookingId, channel: 'EMAIL', type: 'BOOKING_CONFIRMED' },
    });

    await delivery.sweepPendingEmails();
    let row = await prismaTestClient.notification.findUniqueOrThrow({
      where: { id: emailRow.id },
    });
    expect(row.status).toBe('RETRYING');
    expect(row.attempts).toBeGreaterThanOrEqual(1);
    expect(row.error).toContain('SMTP connection timeout');
    expect(row.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());

    // Backoff gate: not yet eligible → no new send.
    const callsAfterFirst = sendMock.mock.calls.length;
    await delivery.sweepPendingEmails();
    expect(sendMock.mock.calls.length).toBe(callsAfterFirst);

    // Fast-forward to the final allowed attempt: terminal FAILED.
    await prismaTestClient.notification.update({
      where: { id: emailRow.id },
      data: {
        attempts: 4,
        status: 'RETRYING',
        nextRetryAt: new Date(Date.now() - 1000),
      },
    });
    await delivery.sweepPendingEmails();
    row = await prismaTestClient.notification.findUniqueOrThrow({
      where: { id: emailRow.id },
    });
    expect(row.status).toBe('FAILED');
    expect(row.nextRetryAt).toBeNull();

    // Terminal rows are never selected again.
    const callsAfterTerminal = sendMock.mock.calls.length;
    await delivery.sweepPendingEmails();
    expect(sendMock.mock.calls.length).toBe(callsAfterTerminal);

    // The in-app notification survived every email failure.
    const inbox = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(inbox.body.total).toBeGreaterThanOrEqual(1);
    const unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unread.body.count).toBeGreaterThanOrEqual(1);
  });
});

/** Shared bookable graph (airports, route, aircraft+seats, flight+segment, fare). */
async function seedBookableGraph(fareRules: unknown): Promise<void> {
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
    prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'FRA' } }),
    prismaTestClient.airport.findUniqueOrThrow({ where: { iataCode: 'JFK' } }),
  ]);
  await prismaTestClient.route.create({
    data: {
      originAirportId: fra.id,
      destinationAirportId: jfk.id,
      distanceKm: 6201,
      durationMinutes: 505,
    },
  });
  const aircraft = await prismaTestClient.aircraft.create({
    data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
  });
  await prismaTestClient.seat.createMany({
    data: generateSeatMap(aircraft.capacity).map((s) => ({
      ...s,
      aircraftId: aircraft.id,
      features: {},
    })),
  });
  const departure = new Date(Date.now() + 2 * 86_400_000);
  const flight = await prismaTestClient.flight.create({
    data: {
      flightNumber: 'NV900',
      routeId: (await prismaTestClient.route.findFirstOrThrow()).id,
      aircraftId: aircraft.id,
      departureTime: departure,
      arrivalTime: new Date(departure.getTime() + 505 * 60000),
      status: 'SCHEDULED',
    },
  });
  await prismaTestClient.flightSegment.create({
    data: {
      flightId: flight.id,
      segmentNumber: 1,
      originAirportId: fra.id,
      destinationAirportId: jfk.id,
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
}

/**
 * Patch 4 hardening proofs (service-level, real disposable database):
 * 1. Multi-worker claiming: two delivery-service instances racing the same
 *    batch must send each row exactly once (SKIP LOCKED).
 * 2. Accepted-then-lost provider outcome: an adapter that "accepts" then
 *    throws must never mark the row SENT/FAILED — it backs off and retries
 *    (at-least-once; the residual duplicate is asserted, not hidden).
 * 3. Finance alert routing: only ACTIVE users with payments:refund or a
 *    Super Admin role are notified — suspended and unrelated staff get
 *    nothing.
 */
describe('Delivery hardening (e2e)', () => {
  const configStub = { get: (_key: string, fallback: string) => fallback };
  let recipientId: string;

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
    const recipient = await prismaTestClient.user.create({
      data: {
        email: 'recipient@test.dev',
        passwordHash: 'x',
        firstName: 'Reci',
        lastName: 'Pient',
        status: 'ACTIVE',
      },
    });
    recipientId = recipient.id;
  });

  const seedEmailRow = async (subject: string, content: string) =>
    prismaTestClient.notification.create({
      data: {
        userId: recipientId,
        channel: 'EMAIL',
        status: 'PENDING',
        type: 'BOOKING_CONFIRMED',
        title: subject,
        content,
        dedupeKey: `test:${content}`,
      },
    });

  it('two racing workers send each claimed row exactly once', async () => {
    const outbox: MailMessage[] = [];
    const slowMail = {
      send: vi.fn(async (m: MailMessage) => {
        await new Promise((r) => setTimeout(r, 150));
        outbox.push(m);
      }),
    };
    for (let i = 0; i < 4; i++) {
      await seedEmailRow('Booking confirmed', `row-${i}`);
    }
    const workerA = new NotificationDeliveryService(
      prismaTestClient as never,
      slowMail as never,
      configStub as never,
    );
    const workerB = new NotificationDeliveryService(
      prismaTestClient as never,
      slowMail as never,
      configStub as never,
    );

    const [resultA, resultB] = await Promise.all([
      workerA.sweepPendingEmails(),
      workerB.sweepPendingEmails(),
    ]);

    expect(resultA.sent + resultB.sent).toBe(4);
    expect(outbox).toHaveLength(4);
    expect(new Set(outbox.map((m) => m.text)).size).toBe(4);
    const rows = await prismaTestClient.notification.findMany({
      where: { channel: 'EMAIL' },
    });
    expect(rows.every((r) => r.status === 'SENT' && r.attempts === 1)).toBe(true);
  });

  it('an accepted-then-lost provider outcome is never marked SENT — it backs off and retries (at-least-once)', async () => {
    const outbox: MailMessage[] = [];
    const flakyMail = {
      send: vi.fn(async (m: MailMessage) => {
        outbox.push(m); // provider accepted the message...
        throw new Error('timeout waiting for provider response'); // ...then the response was lost
      }),
    };
    await seedEmailRow('Booking confirmed', 'ambiguous-row');
    const svc = new NotificationDeliveryService(
      prismaTestClient as never,
      flakyMail as never,
      configStub as never,
    );

    await svc.sweepPendingEmails();
    let row = await prismaTestClient.notification.findFirstOrThrow({
      where: { dedupeKey: 'test:ambiguous-row' },
    });
    // Never SENT (acceptance unconfirmed), never definitively FAILED.
    expect(row.status).toBe('RETRYING');
    expect(row.sentAt).toBeNull();
    expect(row.error).toContain('timeout waiting for provider response');
    expect(row.attempts).toBe(1);

    // After the backoff the row is retried — the provider sees it a second
    // time. This duplicate is the documented residual risk of a provider
    // without idempotent submission.
    await prismaTestClient.notification.update({
      where: { id: row.id },
      data: { nextRetryAt: new Date(Date.now() - 1000) },
    });
    await svc.sweepPendingEmails();

    expect(outbox).toHaveLength(2);
    expect(outbox[0]!.text).toBe(outbox[1]!.text);
    row = await prismaTestClient.notification.findFirstOrThrow({
      where: { dedupeKey: 'test:ambiguous-row' },
    });
    expect(row.status).toBe('RETRYING');
    expect(row.attempts).toBe(2);
    expect(row.sentAt).toBeNull();
  });

  it('finance alerts reach only ACTIVE refund-authorized staff and Super Admins', async () => {
    const makeRole = async (name: string, opts: { super?: boolean; perms?: [string, string][] }) => {
      const role = await prismaTestClient.role.create({
        data: { name, isSuperAdmin: opts.super ?? false },
      });
      for (const [resource, action] of opts.perms ?? []) {
        const permission = await prismaTestClient.permission.upsert({
          where: { resource_action: { resource, action } },
          update: {},
          create: { resource, action },
        });
        await prismaTestClient.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
      return role;
    };
    const makeUser = async (email: string, status: 'ACTIVE' | 'SUSPENDED', roleId: string) => {
      const user = await prismaTestClient.user.create({
        data: {
          email,
          passwordHash: 'x',
          firstName: 'Staff',
          lastName: email,
          status,
        },
      });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId } });
      return user;
    };

    const financeRole = await makeRole('Finance', { perms: [['payments', 'refund']] });
    const supportRole = await makeRole('Support', { perms: [['bookings', 'manage']] });
    const superRole = await makeRole('Root', { super: true });

    const financeActive = await makeUser('fin-active@test.dev', 'ACTIVE', financeRole.id);
    const superAdmin = await makeUser('root@test.dev', 'ACTIVE', superRole.id);
    await makeUser('fin-suspended@test.dev', 'SUSPENDED', financeRole.id);
    await makeUser('support@test.dev', 'ACTIVE', supportRole.id);

    const notifications = new NotificationsService(prismaTestClient as never);
    const notified = await notifications.notifyStaffRefundReviewRequired({
      refundId: randomUUID(),
      bookingReference: 'NVZZ99',
    });

    expect(notified).toBe(2);
    const rows = await prismaTestClient.notification.findMany({
      where: { type: 'REFUND_REVIEW_REQUIRED', channel: 'IN_APP' },
      select: { userId: true },
    });
    expect(new Set(rows.map((r) => r.userId))).toEqual(
      new Set([financeActive.id, superAdmin.id]),
    );

    // Replayed refund events must not duplicate alerts: same refund id → no
    // new rows, and recipients are not double-counted.
    const refundId = randomUUID();
    await notifications.notifyStaffRefundReviewRequired({
      refundId,
      bookingReference: 'NVZZ99',
    });
    const replay = await notifications.notifyStaffRefundReviewRequired({
      refundId,
      bookingReference: 'NVZZ99',
    });
    expect(replay).toBe(0);
    expect(
      await prismaTestClient.notification.count({
        where: { type: 'REFUND_REVIEW_REQUIRED', dedupeKey: { startsWith: `refund-review:refund:${refundId}` } },
      }),
    ).toBe(4); // 2 recipients × (IN_APP + EMAIL), unchanged by the replay
  });
});

/**
 * Admin notifications API (read-only ops list): authorization matrix and
 * response contract against the real disposable database. Covers 401/403,
 * notifications:read access, Super Admin bypass, pagination/filter
 * validation, stable ordering, exact response fields, and empty results.
 */
describe('Admin notifications API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
  });

  async function loginWithRole(
    email: string,
    opts: { permissions?: [string, string][]; superAdmin?: boolean } = {},
  ): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Staff',
      lastName: 'Member',
    });
    const role = await prismaTestClient.role.create({
      data: { name: `Role ${email}`, isSuperAdmin: opts.superAdmin ?? false },
    });
    for (const p of opts.permissions ?? []) {
      const [resource, action] = p;
      const permission = await prismaTestClient.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      await prismaTestClient.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
    await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: role.id } });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const seedRow = (overrides: Record<string, unknown> = {}) =>
    prismaTestClient.notification.create({
      data: {
        channel: 'EMAIL',
        status: 'PENDING',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking confirmed',
        content: 'Your booking NVAB12 is confirmed.',
        createdAt: new Date('2026-10-13T10:00:00Z'),
        ...overrides,
      },
    });

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/api/admin/notifications').expect(401);
  });

  it('rejects a customer (no staff role) with 403', async () => {
    const token = await loginWithRole('admin-list-customer@test.dev');
    await request(app.getHttpServer())
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('rejects staff holding unrelated permissions with 403', async () => {
    const token = await loginWithRole('admin-list-support-noaccess@test.dev', {
      permissions: [['bookings', 'manage']],
    });
    await request(app.getHttpServer())
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('serves staff holding notifications:read with the paginated contract, newest-first', async () => {
    const token = await loginWithRole('admin-list-reader@test.dev', {
      permissions: [['notifications', 'read']],
    });
    await seedRow({ id: randomUUID(), title: 'older', createdAt: new Date('2026-10-12T10:00:00Z') });
    await seedRow({ id: randomUUID(), title: 'newer', createdAt: new Date('2026-10-13T10:00:00Z') });

    const res = await request(app.getHttpServer())
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.total).toBe(2);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe('newer');
    expect(res.body.data[1].title).toBe('older');
    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      [
        'attempts', 'bookingId', 'channel', 'content', 'createdAt', 'error',
        'id', 'readAt', 'sentAt', 'status', 'title', 'type', 'userId',
      ].sort(),
    );
  });

  it('honours channel/status/read filters and pagination bounds', async () => {
    const token = await loginWithRole('admin-list-filters@test.dev', {
      permissions: [['notifications', 'read']],
    });
    await seedRow({ id: randomUUID(), channel: 'EMAIL', status: 'FAILED', readAt: null });
    await seedRow({
      id: randomUUID(),
      channel: 'IN_APP',
      status: 'SENT',
      readAt: new Date('2026-10-13T11:00:00Z'),
      sentAt: new Date('2026-10-13T10:00:00Z'),
    });

    const failedEmail = await request(app.getHttpServer())
      .get('/api/admin/notifications?channel=EMAIL&status=FAILED&read=unread')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(failedEmail.body.total).toBe(1);
    expect(failedEmail.body.data[0].status).toBe('FAILED');

    const readInApp = await request(app.getHttpServer())
      .get('/api/admin/notifications?channel=IN_APP&read=read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(readInApp.body.total).toBe(1);

    const page = await request(app.getHttpServer())
      .get('/api/admin/notifications?limit=1&page=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(page.body.limit).toBe(1);
    expect(page.body.total).toBe(2);
    expect(page.body.totalPages).toBe(2);
  });

  it('rejects invalid pagination and filter values with 400', async () => {
    const token = await loginWithRole('admin-list-validation@test.dev', {
      permissions: [['notifications', 'read']],
    });
    await request(app.getHttpServer())
      .get('/api/admin/notifications?limit=101')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/admin/notifications?page=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/admin/notifications?channel=PIGEON')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/admin/notifications?status=MAYBE')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('allows Super Admin via the existing bypass', async () => {
    const token = await loginWithRole('admin-list-super@test.dev', { superAdmin: true });
    const res = await request(app.getHttpServer())
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
