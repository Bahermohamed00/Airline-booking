import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PAYMENT_PROVIDER } from '../src/payments/payment-provider.js';
import type { ProviderRefundLookup } from '../src/payments/payment-provider.js';
import { RefundReconciliationService } from '../src/payments/refund-reconciliation.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Phase 3.4E orphan provider-refund discovery against a scripted Stripe
 * provider (the deterministic mock is stateless and can never hold orphan
 * refunds). The fake charges like the mock so bookings can be paid through
 * the real API, while `listRefundsForPayment` is scripted per test.
 */
describe('Refund operations — orphan discovery (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let providerRefunds: ProviderRefundLookup[];
  let providerLookupFails: Error | null;

  const fakeStripe = {
    name: 'stripe',
    charge: vi.fn(async (req: { idempotencyKey: string }) => ({
      outcome: 'success' as const,
      providerReference: `pi_${req.idempotencyKey}`,
    })),
    refund: vi.fn(async (req: { idempotencyKey?: string }) => ({
      providerReference: `re_${req.idempotencyKey ?? 'manual'}`,
    })),
    listRefundsForPayment: vi.fn(async (): Promise<ProviderRefundLookup[]> => {
      if (providerLookupFails) throw providerLookupFails;
      return providerRefunds;
    }),
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(fakeStripe)
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
    vi.clearAllMocks();
    providerRefunds = [];
    providerLookupFails = null;
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
        fareRules: {
          refundPolicy: { refundable: true, cancellationFeePercent: 10 },
        } as never,
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

  /** Pays a booking through the real API with the scripted stripe provider. */
  async function paidStripeBooking(customerEmail: string) {
    const customerToken = await loginAs(customerEmail);
    const flight = await prismaTestClient.flight.findFirstOrThrow();
    const seat = await prismaTestClient.seat.findFirstOrThrow({
      where: { aircraft: { registration: 'NV-T100' } },
      orderBy: { seatNumber: 'asc' },
    });
    const booking = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
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
    const paymentRes = await request(app.getHttpServer())
      .post(`/api/bookings/${booking.body.id}/payment`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ token: 'tok_visa_test', idempotencyKey: randomUUID() })
      .expect(201);
    return {
      bookingId: booking.body.id as string,
      paymentId: paymentRes.body.payment.id as string,
      paymentProviderReference: paymentRes.body.payment
        .providerReference as string,
    };
  }

  /** A stale PENDING refund (older than the 60-minute discovery age). */
  async function stalePendingRefund(bookingId: string, paymentId: string, amount: number) {
    return prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId,
        amount,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Crash-window artifact',
        createdAt: new Date(Date.now() - 90 * 60_000),
      },
    });
  }

  it('adopts a crash-window refund via its strong metadata identity — without any provider mutation', async () => {
    const { bookingId, paymentId, paymentProviderReference } =
      await paidStripeBooking('orphan-adopt@test.dev');
    const stuck = await stalePendingRefund(bookingId, paymentId, 200);
    // Stripe kept the refund the API lost: metadata names the local row.
    providerRefunds = [
      {
        providerReference: 're_crash_1',
        amountCents: 20000,
        currency: 'EUR',
        metadataRefundId: stuck.id,
      },
    ];

    const sweep = moduleFixture.get(RefundReconciliationService);
    const summary = await sweep.discoverOrphanProviderRefunds();
    expect(summary).toEqual({
      eligible: 1,
      checked: 1,
      adopted: 1,
      unmatched: 0,
      failed: 0,
    });

    expect(fakeStripe.listRefundsForPayment).toHaveBeenCalledWith(
      paymentProviderReference,
    );
    // Discovery never creates refunds at the provider.
    expect(fakeStripe.refund).not.toHaveBeenCalled();

    const converged = await prismaTestClient.refund.findUniqueOrThrow({
      where: { id: stuck.id },
    });
    expect(converged.status).toBe('PROCESSED');
    expect(converged.providerReference).toBe('re_crash_1');
    expect(
      (
        await prismaTestClient.payment.findUniqueOrThrow({
          where: { id: paymentId },
        })
      ).status,
    ).toBe('PARTIALLY_REFUNDED');
    expect(
      await prismaTestClient.orphanProviderRefund.count(),
    ).toBe(0);

    const audits = await prismaTestClient.auditLog.findMany({
      where: { action: 'REFUND_COMPLETED', targetId: stuck.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorType).toBe('System');
    expect(audits[0]!.metadata).toMatchObject({ via: 'orphan-discovery' });
  });

  it('flags an unmatched provider refund, stays idempotent on rediscovery, and resolves via the audited admin action', async () => {
    const finance = await loginStaff('orphan-flag-fin@test.dev', [
      'payments:read',
      'payments:refund',
    ]);
    const bookingMgr = await loginStaff('orphan-flag-bm@test.dev', [
      'bookings:manage',
    ]);
    const { bookingId, paymentId } = await paidStripeBooking(
      'orphan-flag@test.dev',
    );
    await stalePendingRefund(bookingId, paymentId, 200);
    // A Stripe refund NovaAir never recorded and cannot strongly match.
    providerRefunds = [
      {
        providerReference: 're_foreign_1',
        amountCents: 5000,
        currency: 'EUR',
        metadataRefundId: null,
      },
    ];

    const sweep = moduleFixture.get(RefundReconciliationService);
    const first = await sweep.discoverOrphanProviderRefunds();
    expect(first).toMatchObject({ checked: 1, adopted: 0, unmatched: 1, failed: 0 });

    const orphan = await prismaTestClient.orphanProviderRefund.findFirstOrThrow({
      where: { providerRefundReference: 're_foreign_1' },
    });
    expect(orphan).toMatchObject({
      provider: 'stripe',
      status: 'UNMATCHED',
      currency: 'EUR',
    });
    // Prisma Decimal serializes as a string on raw rows.
    expect(Number(orphan.amount)).toBe(50);
    // The local refund is untouched — discovery never guesses a match.
    expect(
      (
        await prismaTestClient.refund.findFirstOrThrow({
          where: { paymentId },
        })
      ).status,
    ).toBe('PENDING');
    expect(fakeStripe.refund).not.toHaveBeenCalled();

    // Duplicate discovery: no second row, no second audit — only lastSeenAt moves.
    const second = await sweep.discoverOrphanProviderRefunds();
    expect(second).toMatchObject({ checked: 1, adopted: 0, unmatched: 0 });
    expect(
      await prismaTestClient.orphanProviderRefund.count({
        where: { providerRefundReference: 're_foreign_1' },
      }),
    ).toBe(1);
    expect(
      await prismaTestClient.auditLog.count({
        where: { action: 'REFUND_ORPHAN_DISCOVERED' },
      }),
    ).toBe(1);

    // Admin listing + authorization.
    await request(app.getHttpServer())
      .get('/api/admin/refunds/orphans')
      .set('Authorization', `Bearer ${bookingMgr}`)
      .expect(403);
    const listed = await request(app.getHttpServer())
      .get('/api/admin/refunds/orphans?status=UNMATCHED')
      .set('Authorization', `Bearer ${finance}`)
      .expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0]).toMatchObject({
      providerRefundReference: 're_foreign_1',
      status: 'UNMATCHED',
      amount: 50,
    });

    // Manual resolution after investigation — audited with the staff identity.
    await request(app.getHttpServer())
      .post(`/api/admin/refunds/orphans/${orphan.id}/resolve`)
      .set('Authorization', `Bearer ${bookingMgr}`)
      .send({})
      .expect(403);
    const resolved = await request(app.getHttpServer())
      .post(`/api/admin/refunds/orphans/${orphan.id}/resolve`)
      .set('Authorization', `Bearer ${finance}`)
      .send({ note: 'Verified in the Stripe dashboard' })
      .expect(201);
    expect(resolved.body).toMatchObject({
      status: 'RESOLVED',
      resolutionNote: 'Verified in the Stripe dashboard',
    });
    const resolvedAudits = await prismaTestClient.auditLog.findMany({
      where: { action: 'REFUND_ORPHAN_RESOLVED', targetId: orphan.id },
    });
    expect(resolvedAudits).toHaveLength(1);
    expect(resolvedAudits[0]!.actorType).toBe('Staff');

    // Idempotent replay: a second resolve changes nothing and writes no audit.
    await request(app.getHttpServer())
      .post(`/api/admin/refunds/orphans/${orphan.id}/resolve`)
      .set('Authorization', `Bearer ${finance}`)
      .send({})
      .expect(201);
    expect(
      await prismaTestClient.auditLog.count({
        where: { action: 'REFUND_ORPHAN_RESOLVED', targetId: orphan.id },
      }),
    ).toBe(1);
  });

  it('a failed provider lookup is isolated — no state change, counted as failed', async () => {
    const { bookingId, paymentId } = await paidStripeBooking(
      'orphan-fail@test.dev',
    );
    const stuck = await stalePendingRefund(bookingId, paymentId, 200);
    providerLookupFails = new Error('stripe timeout');

    const sweep = moduleFixture.get(RefundReconciliationService);
    const summary = await sweep.discoverOrphanProviderRefunds();
    expect(summary).toMatchObject({ eligible: 1, checked: 0, failed: 1 });

    expect(
      (
        await prismaTestClient.refund.findUniqueOrThrow({
          where: { id: stuck.id },
        })
      ).status,
    ).toBe('PENDING');
    expect(await prismaTestClient.orphanProviderRefund.count()).toBe(0);
  });

  it('fresh PENDING refunds are not yet eligible for discovery (bounded, age-gated)', async () => {
    const { bookingId, paymentId } = await paidStripeBooking(
      'orphan-fresh@test.dev',
    );
    await prismaTestClient.refund.create({
      data: {
        paymentId,
        bookingId,
        amount: 200,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'In flight right now',
      },
    });

    const sweep = moduleFixture.get(RefundReconciliationService);
    const summary = await sweep.discoverOrphanProviderRefunds();
    expect(summary).toEqual({
      eligible: 0,
      checked: 0,
      adopted: 0,
      unmatched: 0,
      failed: 0,
    });
    expect(fakeStripe.listRefundsForPayment).not.toHaveBeenCalled();
  });
});
