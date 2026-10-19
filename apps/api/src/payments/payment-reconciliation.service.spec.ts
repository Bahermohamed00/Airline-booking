import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payment-provider';
import { RefundMetricsService } from './refund-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  DEFAULT_RECONCILIATION_BATCH_SIZE,
  DEFAULT_RECONCILIATION_MIN_AGE_MINUTES,
  MAX_RECONCILIATION_BATCH_SIZE,
  resolveReconciliationBatchSize,
  resolveReconciliationMinAgeMinutes,
} from './payment-reconciliation-config';

/**
 * Payment reconciliation sweep (Phase 3.2B): eligibility, bounded batches,
 * retrieval-only Stripe access, and dispatch into the SAME idempotent handlers
 * the webhook uses. PaymentsService runs for real; Prisma and the provider are
 * mocked in the same style as payment-webhook.service.spec.ts.
 */

const future = () => new Date(Date.now() + 10 * 60_000);

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  status: 'PENDING',
  provider: 'stripe',
  providerReference: 'pi_123',
  providerStatus: 'requires_action',
  token: null,
  idempotencyKey: 'key-0001',
  paidAt: null,
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const staleRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  providerReference: 'pi_123',
  ...overrides,
});

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  providerReference: 'pi_123',
  status: 'succeeded' as const,
  clientSecret: 'pi_123_secret_456',
  amountCents: 50500,
  currency: 'EUR',
  ...overrides,
});

const txBookingRow = (status = 'PENDING') => ({
  id: 'booking-1',
  status,
  bookingReference: 'NVAB12',
});

/** Full booking payload for confirmBookingInTransaction's findUniqueOrThrow. */
const txBookingFull = () => ({
  id: 'booking-1',
  bookingPassengers: [
    {
      id: 'bp-1',
      passenger: { id: 'p-1', firstName: 'Lena', lastName: 'Hoffmann' },
    },
  ],
  seatHolds: [
    {
      id: 'hold-1',
      flightId: 'flight-1',
      seatId: 'seat-1',
      status: 'ACTIVE',
      expiresAt: future(),
      seat: { id: 'seat-1', seatNumber: '1A' },
    },
  ],
});

const createMockPrisma = () => {
  const tx = {
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    booking: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    flightSegment: { findMany: vi.fn().mockResolvedValue([{ id: 'seg-1' }]) },
    bookingSeat: { create: vi.fn().mockResolvedValue({}) },
    payment: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    payment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

describe('PaymentReconciliationService', () => {
  let service: PaymentReconciliationService;
  let payments: PaymentsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let provider: {
    name: string;
    retrievePaymentIntent: ReturnType<typeof vi.fn>;
    createPaymentIntent: ReturnType<typeof vi.fn>;
    cancelPaymentIntent: ReturnType<typeof vi.fn>;
  };
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    provider = {
      name: 'stripe',
      retrievePaymentIntent: vi.fn(),
      createPaymentIntent: vi.fn(),
      cancelPaymentIntent: vi.fn(),
    };
    config = { get: vi.fn().mockReturnValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        PaymentReconciliationService,
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn().mockResolvedValue({}) } },
        {
          provide: BookingsService,
          useValue: { getBookingView: vi.fn().mockResolvedValue({}) },
        },
        { provide: PAYMENT_PROVIDER, useValue: provider },
        { provide: ConfigService, useValue: config },
        { provide: RefundMetricsService, useValue: new RefundMetricsService() },
        {
          provide: NotificationsService,
          useValue: {
            notifyBookingConfirmed: vi.fn().mockResolvedValue(null),
            notifyPaymentSucceeded: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: RealtimeEventsService, useValue: { emitPaymentStatus: vi.fn() } },
      ],
    }).compile();
    service = module.get(PaymentReconciliationService);
    payments = module.get(PaymentsService);
  });

  /** Common setup: one stale payment whose intent the provider returns as `status`. */
  const staleSetup = (status: string, intentOverrides: Record<string, unknown> = {}) => {
    prisma.payment.findMany.mockResolvedValue([staleRow()]);
    provider.retrievePaymentIntent.mockResolvedValue(
      snapshot({ status, ...intentOverrides }),
    );
    prisma.payment.findUnique.mockResolvedValue(paymentFixture());
  };

  it('Test 1 — stale PENDING + succeeded: full chain via the existing finalization, BookingSeat exactly once', async () => {
    staleSetup('succeeded');
    prisma.__tx.booking.findUniqueOrThrow
      .mockResolvedValueOnce(txBookingRow('PENDING'))
      .mockResolvedValueOnce(txBookingFull());

    const summary = await service.reconcileStalePendingPayments();

    expect(provider.retrievePaymentIntent).toHaveBeenCalledWith('pi_123');
    // Retrieval-only: never create/cancel at the provider.
    expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    expect(provider.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ eligible: 1, succeeded: 1, failed: 0 });
    expect(prisma.__tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: { in: ['PENDING', 'FAILED'] } },
      data: expect.objectContaining({ status: 'SUCCESS' }),
    });
    expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: 'ACTIVE' },
      data: { status: 'CONVERTED' },
    });
    expect(prisma.__tx.bookingSeat.create).toHaveBeenCalledTimes(1);
  });

  it('Test 2 — stale PENDING + canceled: existing cancel behavior (PENDING → FAILED)', async () => {
    staleSetup('canceled');

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, canceled: 1, failed: 0 });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'FAILED', providerStatus: 'canceled' }),
    });
    expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('Test 3 — a post-decline requires_payment_method stays recoverable; the sweep never fabricates FAILED', async () => {
    const failedSpy = vi.spyOn(payments, 'markIntentFailed');
    staleSetup('requires_payment_method');

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, noted: 1, failed: 0 });
    expect(failedSpy).not.toHaveBeenCalled();
    // Only the fine-grained provider status is tracked; the payment stays PENDING.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'PENDING' },
      data: { providerStatus: 'requires_payment_method' },
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('Test 4 — processing: remains PENDING, no false failure', async () => {
    staleSetup('processing');

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, noted: 1, failed: 0 });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'PENDING' },
      data: { providerStatus: 'processing' },
    });
    expect(prisma.__tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('Test 5 — requires_action: remains recoverable, customer flow not cancelled', async () => {
    staleSetup('requires_action');

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, noted: 1, failed: 0 });
    expect(provider.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'PENDING' },
      data: { providerStatus: 'requires_action' },
    });
  });

  it('Test 6 — amount mismatch: no confirmation, no BookingSeat, reported as failed', async () => {
    staleSetup('succeeded', { amountCents: 49900 });

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, succeeded: 0, failed: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.__tx.bookingSeat.create).not.toHaveBeenCalled();
    expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('Test 7 — currency mismatch: no confirmation, reported as failed', async () => {
    staleSetup('succeeded', { currency: 'USD' });

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, succeeded: 0, failed: 1 });
    expect(prisma.__tx.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.__tx.bookingSeat.create).not.toHaveBeenCalled();
  });

  it('Test 8 — webhook/reconciliation race: one SUCCESS, one confirmation, one BookingSeat', async () => {
    prisma.payment.findUnique.mockResolvedValue(paymentFixture());
    // First finalizer wins the payment CAS; the concurrent one loses it.
    prisma.__tx.payment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.__tx.booking.findUniqueOrThrow
      .mockResolvedValueOnce(txBookingRow('PENDING'))
      .mockResolvedValueOnce(txBookingFull())
      .mockResolvedValueOnce(txBookingRow('CONFIRMED'));

    const first = await service.applyIntentSnapshot(staleRow(), snapshot());
    const second = await service.applyIntentSnapshot(staleRow(), snapshot());

    expect(first).toBe('succeeded');
    expect(second).toBe('succeeded'); // harmless: CAS lost, already CONFIRMED
    expect(prisma.__tx.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.bookingSeat.create).toHaveBeenCalledTimes(1);
  });

  it('Test 9 — repeated reconciliation: a second sweep finds nothing to do', async () => {
    staleSetup('succeeded');
    prisma.__tx.booking.findUniqueOrThrow
      .mockResolvedValueOnce(txBookingRow('PENDING'))
      .mockResolvedValueOnce(txBookingFull());
    await service.reconcileStalePendingPayments();

    // The payment is SUCCESS now — the eligibility query (status=PENDING)
    // excludes it, so the next sweep never retrieves it again.
    prisma.payment.findMany.mockResolvedValue([]);
    const second = await service.reconcileStalePendingPayments();

    expect(second).toMatchObject({ eligible: 0, succeeded: 0, failed: 0 });
    expect(provider.retrievePaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('Test 10 — Stripe timeout: payment stays recoverable and the sweep completes', async () => {
    prisma.payment.findMany.mockResolvedValue([staleRow()]);
    provider.retrievePaymentIntent.mockRejectedValue(new Error('stripe timeout'));

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({ eligible: 1, failed: 1 });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Test 11 — one failure does not abort the batch (A ok, B timeout, C ok)', async () => {
    prisma.payment.findMany.mockResolvedValue([
      staleRow({ id: 'payment-a', providerReference: 'pi_a' }),
      staleRow({ id: 'payment-b', providerReference: 'pi_b' }),
      staleRow({ id: 'payment-c', providerReference: 'pi_c' }),
    ]);
    provider.retrievePaymentIntent
      .mockResolvedValueOnce(snapshot({ providerReference: 'pi_a' }))
      .mockRejectedValueOnce(new Error('stripe timeout'))
      .mockResolvedValueOnce(snapshot({ providerReference: 'pi_c', status: 'canceled' }));
    prisma.payment.findUnique.mockImplementation(({ where }: { where: { providerReference?: string } }) =>
      Promise.resolve(
        paymentFixture({
          id: where.providerReference === 'pi_a' ? 'payment-a' : 'payment-c',
          providerReference: where.providerReference,
        }),
      ),
    );
    prisma.__tx.booking.findUniqueOrThrow
      .mockResolvedValueOnce(txBookingRow('PENDING'))
      .mockResolvedValueOnce(txBookingFull());

    const summary = await service.reconcileStalePendingPayments();

    expect(summary).toMatchObject({
      eligible: 3,
      succeeded: 1,
      canceled: 1,
      failed: 1,
    });
    // C was still processed after B's failure.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-c', status: 'PENDING' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('Test 12 — eligibility: only stale PENDING stripe payments with a reference, bounded batch', async () => {
    const now = new Date('2026-10-06T12:00:00Z');
    await service.reconcileStalePendingPayments(now);

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        provider: 'stripe',
        providerReference: { not: null },
        updatedAt: {
          lt: new Date(now.getTime() - DEFAULT_RECONCILIATION_MIN_AGE_MINUTES * 60_000),
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: DEFAULT_RECONCILIATION_BATCH_SIZE,
      select: { id: true, bookingId: true, providerReference: true },
    });
  });

  it('honors configured age threshold and batch size', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'PAYMENT_RECONCILIATION_MIN_AGE_MINUTES'
        ? '10'
        : key === 'PAYMENT_RECONCILIATION_BATCH_SIZE'
          ? '7'
          : undefined,
    );
    const now = new Date('2026-10-06T12:00:00Z');
    await service.reconcileStalePendingPayments(now);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) },
        }),
        take: 7,
      }),
    );
  });

  it('no-ops entirely under the mock provider (no PaymentIntents exist)', async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentReconciliationService,
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: BookingsService, useValue: { getBookingView: vi.fn() } },
        { provide: PAYMENT_PROVIDER, useValue: { name: 'mock' } },
        { provide: ConfigService, useValue: config },
        { provide: RefundMetricsService, useValue: new RefundMetricsService() },
        {
          provide: NotificationsService,
          useValue: {
            notifyBookingConfirmed: vi.fn().mockResolvedValue(null),
            notifyPaymentSucceeded: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: RealtimeEventsService, useValue: { emitPaymentStatus: vi.fn() } },
      ],
    }).compile();
    const mockMode = module.get(PaymentReconciliationService);

    const summary = await mockMode.reconcileStalePendingPayments();

    expect(summary).toEqual({ eligible: 0, succeeded: 0, canceled: 0, noted: 0, failed: 0 });
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('unknown intent statuses surface as failures — never silently mapped', async () => {
    await expect(
      service.applyIntentSnapshot(
        staleRow(),
        snapshot({ status: 'requires_capture' as never }),
      ),
    ).rejects.toThrow(/unsupported/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('payment-reconciliation-config', () => {
  it('falls back to safe defaults for missing or invalid values', () => {
    expect(resolveReconciliationMinAgeMinutes(undefined)).toBe(5);
    expect(resolveReconciliationMinAgeMinutes('abc')).toBe(5);
    expect(resolveReconciliationMinAgeMinutes('-3')).toBe(5);
    expect(resolveReconciliationBatchSize(undefined)).toBe(25);
    expect(resolveReconciliationBatchSize('0')).toBe(25);
    expect(resolveReconciliationBatchSize('x')).toBe(25);
  });

  it('clamps to documented bounds', () => {
    expect(resolveReconciliationMinAgeMinutes('999999')).toBe(24 * 60);
    expect(resolveReconciliationBatchSize('999999')).toBe(MAX_RECONCILIATION_BATCH_SIZE);
    expect(resolveReconciliationBatchSize('10')).toBe(10);
  });
});
