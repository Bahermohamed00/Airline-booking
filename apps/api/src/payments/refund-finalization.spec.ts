import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payment-provider';
import { RefundMetricsService } from './refund-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

/**
 * Refund finalization concurrency (hardening): the direct success path must
 * take the payment row lock, transition PENDING→PROCESSED via CAS, compute the
 * payment status from the aggregate of processed refunds, and emit completion
 * audit/notification effects only for the CAS winner.
 */

const financeStaff = {
  userId: 'staff-finance',
  email: 'finance@example.com',
  roles: ['Finance Staff'],
  permissions: ['payments:refund'],
};

const paymentRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  status: 'SUCCESS',
  provider: 'mock',
  providerReference: 'mockpay_key-1',
  providerStatus: null,
  token: 'tok_ok',
  idempotencyKey: 'key-0001',
  paidAt: new Date(),
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  booking: {
    bookingReference: 'NVAB12',
    status: 'CONFIRMED',
    contactEmail: 'customer@example.com',
  },
  refunds: [] as unknown[],
  ...overrides,
});

const refundRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'refund-1',
  paymentId: 'payment-1',
  bookingId: 'booking-1',
  amount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  status: 'PENDING',
  reason: 'Customer request',
  processedAt: null,
  providerReference: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Refund finalization — concurrency hardening', () => {
  let service: PaymentsService;
  let prisma: {
    payment: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
    refund: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
    __tx: {
      payment: { update: ReturnType<typeof vi.fn> };
      refund: {
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };
  let provider: { name: string; charge: ReturnType<typeof vi.fn>; refund: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };
  let notifications: {
    notifyRefundProcessed: ReturnType<typeof vi.fn>;
    notifyStaffRefundReviewRequired: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const tx = {
      payment: { update: vi.fn().mockResolvedValue({}) },
      refund: {
        create: vi.fn().mockResolvedValue(refundRow()),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    prisma = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(paymentRow()),
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          paymentRow({ status: 'REFUNDED' }),
        ),
      },
      refund: {
        findUnique: vi.fn().mockResolvedValue(
          refundRow({ booking: { id: 'booking-1', userId: 'user-1', bookingReference: 'NVAB12' } }),
        ),
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          refundRow({ status: 'PROCESSED', providerReference: 're_1', processedAt: new Date() }),
        ),
      },
      $transaction: vi.fn((arg: unknown) =>
        Array.isArray(arg)
          ? Promise.all(arg)
          : (arg as (t: typeof tx) => Promise<unknown>)(tx),
      ),
      __tx: tx,
    };
    provider = {
      name: 'mock',
      charge: vi.fn(),
      refund: vi.fn().mockResolvedValue({ providerReference: 're_1' }),
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    notifications = {
      notifyRefundProcessed: vi.fn().mockResolvedValue(null),
      notifyStaffRefundReviewRequired: vi.fn().mockResolvedValue(0),
    };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        {
          provide: BookingsService,
          useValue: { getBookingView: vi.fn().mockResolvedValue({ id: 'booking-1' }) },
        },
        { provide: PAYMENT_PROVIDER, useValue: provider },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
        { provide: RefundMetricsService, useValue: new RefundMetricsService() },
        { provide: NotificationsService, useValue: notifications },
        { provide: RealtimeEventsService, useValue: { emitPaymentStatus: vi.fn() } },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  it('CAS winner: locks the payment row before the conditional transition, aggregates to REFUNDED, and emits completion effects once', async () => {
    // Remainder check sees nothing committed; the finalization sum then
    // aggregates 400 already processed + this 105 refund to the 505 total.
    prisma.__tx.refund.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ amount: 400 }, { amount: 105 }]);

    const result = (await service.refundPayment(financeStaff, 'payment-1', {
      amount: 105,
      reason: 'Customer request',
    })) as { refund: { status: string }; payment: { status: string } };

    // Stable provider idempotency preserved.
    expect(provider.refund).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'refund-refund-1' }),
    );
    // The unconditional update is gone — the transition is a CAS.
    expect(prisma.__tx.refund.update).not.toHaveBeenCalled();
    expect(prisma.__tx.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'refund-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'PROCESSED' }),
    });
    // The payment row lock (same-value write) precedes the CAS.
    const lockOrder = prisma.__tx.payment.update.mock.invocationCallOrder[0]!;
    const casOrder = prisma.__tx.refund.updateMany.mock.invocationCallOrder[0]!;
    expect(lockOrder).toBeLessThan(casOrder);
    // Aggregate (400 + 105 >= 505) settles the payment.
    expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'REFUNDED' },
    });
    expect(result.payment.status).toBe('REFUNDED');
    expect(result.refund.status).toBe('PROCESSED');
    // Completion effects exactly once.
    const completions = audit.log.mock.calls.filter(
      (c) => c[0].action === 'REFUND_COMPLETED',
    );
    expect(completions).toHaveLength(1);
    expect(notifications.notifyRefundProcessed).toHaveBeenCalledTimes(1);
  });

  it('CAS loser (concurrent recovery already finalized): no duplicate audit/notification, response reflects the committed state', async () => {
    prisma.__tx.refund.updateMany.mockResolvedValue({ count: 0 });

    const result = (await service.refundPayment(financeStaff, 'payment-1', {
      reason: 'Customer request',
    })) as { refund: { status: string }; payment: { status: string } };

    // The provider was still called exactly once with the stable key —
    // finalization loss never replays the provider.
    expect(provider.refund).toHaveBeenCalledTimes(1);
    // No completion effects from the loser.
    const completions = audit.log.mock.calls.filter(
      (c) => c[0].action === 'REFUND_COMPLETED',
    );
    expect(completions).toHaveLength(0);
    expect(notifications.notifyRefundProcessed).not.toHaveBeenCalled();
    // Response comes from the winner's committed rows, not local assumptions.
    expect(prisma.refund.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'refund-1' },
    });
    expect(result.refund.status).toBe('PROCESSED');
    expect(result.payment.status).toBe('REFUNDED');
    // The payment status was never written with a stale aggregate.
    const statusWrites = prisma.__tx.payment.update.mock.calls.filter(
      (c) => c[0]?.data && 'status' in (c[0].data as Record<string, unknown>),
    );
    expect(statusWrites).toHaveLength(0);
  });

  it('partial aggregate stays PARTIALLY_REFUNDED', async () => {
    prisma.__tx.refund.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ amount: 100 }]);
    prisma.payment.findUniqueOrThrow.mockResolvedValue(
      paymentRow({ status: 'PARTIALLY_REFUNDED' }),
    );

    const result = (await service.refundPayment(financeStaff, 'payment-1', {
      amount: 100,
    })) as { payment: { status: string } };

    expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'PARTIALLY_REFUNDED' },
    });
    expect(result.payment.status).toBe('PARTIALLY_REFUNDED');
  });

  it('ambiguous provider outcome still bypasses finalization entirely (recovery path intact)', async () => {
    provider.refund.mockRejectedValue(new Error('stripe timeout'));

    await expect(
      service.refundPayment(financeStaff, 'payment-1', {}),
    ).rejects.toMatchObject({ status: 502 });

    expect(prisma.__tx.refund.updateMany).not.toHaveBeenCalled();
    expect(prisma.__tx.refund.update).not.toHaveBeenCalled();
    expect(notifications.notifyRefundProcessed).not.toHaveBeenCalled();
    expect(notifications.notifyStaffRefundReviewRequired).toHaveBeenCalledTimes(1);
  });
});
