import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RefundReconciliationService } from './refund-reconciliation.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ORPHAN_DISCOVERY_BATCH_SIZE,
  DEFAULT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES,
  DEFAULT_REFUND_ALERT_PENDING_MINUTES,
  DEFAULT_REFUND_ALERT_REJECTIONS_PER_HOUR,
  DEFAULT_REFUND_RECONCILIATION_BATCH_SIZE,
  DEFAULT_REFUND_RECONCILIATION_MIN_AGE_MINUTES,
  MAX_RECONCILIATION_BATCH_SIZE,
  MAX_RECONCILIATION_MIN_AGE_MINUTES,
  resolveOrphanDiscoveryBatchSize,
  resolveOrphanDiscoveryMinAgeMinutes,
  resolveRefundAlertPendingMinutes,
  resolveRefundAlertRejectionsPerHour,
  resolveRefundReconciliationBatchSize,
  resolveRefundReconciliationMinAgeMinutes,
} from './payment-reconciliation-config';
import {
  REFUND_COUNTERS,
  REFUND_GAUGES,
  RefundMetricsService,
} from './refund-metrics.service';

/**
 * Refund reconciliation sweep (Phase 3.4C) + orphan discovery (Phase 3.4E) +
 * refund observability (Phase 3.4F): stale-PENDING eligibility, bounded
 * batches, per-refund failure isolation, delegation into the SAME idempotent
 * replay recovery the admin resume endpoint uses, and metrics/alert updates
 * after every run. PaymentsService is mocked — the recovery/discovery
 * semantics themselves are covered by payments.service.spec.ts.
 */

const NOW = new Date('2026-10-06T12:00:00.000Z');

const staleRow = (id: string) => ({ id });

const createMockPrisma = () => ({
  refund: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  orphanProviderRefund: {
    count: vi.fn().mockResolvedValue(0),
  },
});

describe('RefundReconciliationService', () => {
  let service: RefundReconciliationService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let payments: {
    reconcileRefund: ReturnType<typeof vi.fn>;
    discoverProviderRefundsForPayment: ReturnType<typeof vi.fn>;
    configuredProviderName: ReturnType<typeof vi.fn>;
  };
  let config: { get: ReturnType<typeof vi.fn> };
  let metrics: RefundMetricsService;

  beforeEach(async () => {
    prisma = createMockPrisma();
    payments = {
      reconcileRefund: vi.fn(),
      discoverProviderRefundsForPayment: vi.fn(),
      configuredProviderName: vi.fn().mockReturnValue('stripe'),
    };
    config = { get: vi.fn().mockReturnValue(undefined) };
    metrics = new RefundMetricsService();
    const module = await Test.createTestingModule({
      providers: [
        RefundReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: payments },
        { provide: ConfigService, useValue: config },
        { provide: RefundMetricsService, useValue: metrics },
      ],
    }).compile();
    service = module.get(RefundReconciliationService);
  });

  it('selects only stale PENDING refunds, oldest first, bounded by the batch size', async () => {
    await service.reconcileStalePendingRefunds(NOW);

    expect(prisma.refund.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: new Date(
            NOW.getTime() - DEFAULT_REFUND_RECONCILIATION_MIN_AGE_MINUTES * 60_000,
          ),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: DEFAULT_REFUND_RECONCILIATION_BATCH_SIZE,
      select: { id: true },
    });
    // Nothing eligible → no recovery attempted.
    expect(payments.reconcileRefund).not.toHaveBeenCalled();
  });

  it('honors the configured minimum age and batch size', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'PAYMENT_REFUND_RECONCILIATION_MIN_AGE_MINUTES'
        ? '30'
        : key === 'PAYMENT_REFUND_RECONCILIATION_BATCH_SIZE'
          ? '7'
          : undefined,
    );
    prisma.refund.findMany.mockResolvedValue([staleRow('r1'), staleRow('r2')]);
    payments.reconcileRefund.mockResolvedValue('processed');

    const summary = await service.reconcileStalePendingRefunds(NOW);

    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          createdAt: { lt: new Date(NOW.getTime() - 30 * 60_000) },
        },
        take: 7,
      }),
    );
    expect(summary).toEqual({
      eligible: 2,
      processed: 2,
      pending: 0,
      rejected: 0,
      failed: 0,
    });
  });

  it('counts the convergence outcomes: processed / pending / rejected', async () => {
    prisma.refund.findMany.mockResolvedValue([
      staleRow('r-exists'),
      staleRow('r-still-ambiguous'),
      staleRow('r-definitive'),
    ]);
    payments.reconcileRefund
      .mockResolvedValueOnce('processed') // Stripe refund discovered/executed
      .mockResolvedValueOnce('pending') // still ambiguous — retried next sweep
      .mockResolvedValueOnce('rejected'); // definitive provider rejection

    const summary = await service.reconcileStalePendingRefunds(NOW);

    expect(payments.reconcileRefund).toHaveBeenNthCalledWith(1, 'r-exists');
    expect(payments.reconcileRefund).toHaveBeenNthCalledWith(
      2,
      'r-still-ambiguous',
    );
    expect(payments.reconcileRefund).toHaveBeenNthCalledWith(
      3,
      'r-definitive',
    );
    expect(summary).toEqual({
      eligible: 3,
      processed: 1,
      pending: 1,
      rejected: 1,
      failed: 0,
    });
  });

  it('isolates a failing refund without aborting the batch', async () => {
    prisma.refund.findMany.mockResolvedValue([
      staleRow('r-ok-1'),
      staleRow('r-broken'),
      staleRow('r-ok-2'),
    ]);
    payments.reconcileRefund
      .mockResolvedValueOnce('processed')
      .mockRejectedValueOnce(new Error('database connection lost'))
      .mockResolvedValueOnce('pending');

    const summary = await service.reconcileStalePendingRefunds(NOW);

    expect(payments.reconcileRefund).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      eligible: 3,
      processed: 1,
      pending: 1,
      rejected: 0,
      failed: 1,
    });
  });

  it('accumulates reconciliation outcome counters and refreshes gauges (3.4F)', async () => {
    prisma.refund.findMany.mockResolvedValue([staleRow('r1'), staleRow('r2')]);
    payments.reconcileRefund
      .mockResolvedValueOnce('processed')
      .mockResolvedValueOnce('pending');
    prisma.refund.count
      .mockResolvedValueOnce(4) // pendingCount
      .mockResolvedValueOnce(2) // stuckPendingCount
      .mockResolvedValueOnce(1); // rejectionsLastHour
    prisma.orphanProviderRefund.count.mockResolvedValue(1);

    await service.reconcileStalePendingRefunds(NOW);

    const snapshot = metrics.snapshot();
    expect(snapshot.counters[REFUND_COUNTERS.reconciliationProcessed]).toBe(1);
    expect(snapshot.counters[REFUND_COUNTERS.reconciliationPending]).toBe(1);
    expect(snapshot.gauges[REFUND_GAUGES.pending]).toBe(4);
    expect(snapshot.gauges[REFUND_GAUGES.pendingStuck]).toBe(2);
    expect(snapshot.gauges[REFUND_GAUGES.orphansUnmatched]).toBe(1);
  });

  it('fires the stuck-pending alert once while active and resolves it when cleared (3.4F)', async () => {
    prisma.refund.count
      // run 1: 1 stuck pending → alert activates
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      // run 2: still stuck → no duplicate firing
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      // run 3: cleared → resolves
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await service.reconcileStalePendingRefunds(NOW);
    let active = metrics.activeAlertConditions();
    expect(active.map((a) => a.code)).toContain('refunds_stuck_pending');
    const firedTotal = () =>
      metrics.snapshot().counters[REFUND_COUNTERS.alertsFired];

    await service.reconcileStalePendingRefunds(NOW);
    expect(firedTotal()).toBe(1); // edge-triggered: no re-fire while active

    await service.reconcileStalePendingRefunds(NOW);
    active = metrics.activeAlertConditions();
    expect(active.map((a) => a.code)).not.toContain('refunds_stuck_pending');
  });

  it('fires reconciliation_failing only after three consecutive failed sweeps (3.4F)', async () => {
    prisma.refund.findMany.mockResolvedValue([staleRow('r1')]);
    payments.reconcileRefund.mockRejectedValue(new Error('stripe timeout'));
    // Each run: pendingCount=0, stuck=0, rejections=0, orphans=0.
    prisma.refund.count.mockResolvedValue(0);

    await service.reconcileStalePendingRefunds(NOW);
    await service.reconcileStalePendingRefunds(NOW);
    expect(metrics.activeAlertConditions().map((a) => a.code)).not.toContain(
      'reconciliation_failing',
    );

    await service.reconcileStalePendingRefunds(NOW);
    expect(metrics.activeAlertConditions().map((a) => a.code)).toContain(
      'reconciliation_failing',
    );
  });

  it('fires orphan_provider_refunds while unmatched orphans exist (3.4F)', async () => {
    prisma.refund.count.mockResolvedValue(0);
    prisma.orphanProviderRefund.count.mockResolvedValue(2);

    await service.reconcileStalePendingRefunds(NOW);
    expect(metrics.activeAlertConditions().map((a) => a.code)).toContain(
      'orphan_provider_refunds',
    );
  });

  // ---------- Orphan discovery (Phase 3.4E) ----------

  it('orphan discovery: selects stale PENDING refunds of paid provider payments, one lookup per payment', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { paymentId: 'payment-1' },
      { paymentId: 'payment-1' }, // two stale refunds of the same payment
      { paymentId: 'payment-2' },
    ]);
    payments.discoverProviderRefundsForPayment.mockResolvedValue({
      checked: true,
      adopted: 0,
      unmatchedNew: 0,
    });

    const summary = await service.discoverOrphanProviderRefunds(NOW);

    expect(prisma.refund.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: new Date(
            NOW.getTime() - DEFAULT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES * 60_000,
          ),
        },
        payment: {
          provider: 'stripe',
          providerReference: { not: null },
          status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: DEFAULT_ORPHAN_DISCOVERY_BATCH_SIZE,
      select: { paymentId: true },
    });
    expect(payments.discoverProviderRefundsForPayment).toHaveBeenCalledTimes(2);
    expect(payments.discoverProviderRefundsForPayment).toHaveBeenNthCalledWith(
      1,
      'payment-1',
    );
    expect(summary).toEqual({
      eligible: 2,
      checked: 2,
      adopted: 0,
      unmatched: 0,
      failed: 0,
    });
  });

  it('orphan discovery: aggregates adoption/unmatched outcomes and isolates lookup failures', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { paymentId: 'payment-adopt' },
      { paymentId: 'payment-orphan' },
      { paymentId: 'payment-broken' },
    ]);
    payments.discoverProviderRefundsForPayment
      .mockResolvedValueOnce({ checked: true, adopted: 1, unmatchedNew: 0 })
      .mockResolvedValueOnce({ checked: true, adopted: 0, unmatchedNew: 1 })
      .mockRejectedValueOnce(new Error('stripe timeout'));

    const summary = await service.discoverOrphanProviderRefunds(NOW);

    expect(summary).toEqual({
      eligible: 3,
      checked: 2,
      adopted: 1,
      unmatched: 1,
      failed: 1,
    });
    expect(
      metrics.snapshot().counters[REFUND_COUNTERS.orphanDiscoveryFailed],
    ).toBe(1);
  });

  it('orphan discovery: honors the configured minimum age and batch size', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'PAYMENT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES'
        ? '120'
        : key === 'PAYMENT_ORPHAN_DISCOVERY_BATCH_SIZE'
          ? '3'
          : undefined,
    );

    await service.discoverOrphanProviderRefunds(NOW);

    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: new Date(NOW.getTime() - 120 * 60_000) },
        }),
        take: 3,
      }),
    );
  });

  describe('scheduled job guards', () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    afterEach(() => {
      process.env['NODE_ENV'] = originalNodeEnv;
    });

    it('never runs under NODE_ENV=test (vitest sets it)', async () => {
      process.env['NODE_ENV'] = 'test';
      await service.reconcileStalePendingRefundsJob();
      await service.discoverOrphanProviderRefundsJob();
      expect(prisma.refund.findMany).not.toHaveBeenCalled();
    });

    it('delegates to the sweeps outside test environments', async () => {
      process.env['NODE_ENV'] = 'production';
      await service.reconcileStalePendingRefundsJob();
      await service.discoverOrphanProviderRefundsJob();
      // 1 eligibility query per sweep.
      expect(prisma.refund.findMany).toHaveBeenCalledTimes(2);
    });
  });
});

describe('refund-observability-config', () => {
  it('falls back to safe defaults for missing or invalid values', () => {
    for (const raw of [undefined, null, '', 'abc', '-3', '0', Number.NaN]) {
      expect(resolveRefundReconciliationMinAgeMinutes(raw)).toBe(
        DEFAULT_REFUND_RECONCILIATION_MIN_AGE_MINUTES,
      );
      expect(resolveRefundReconciliationBatchSize(raw)).toBe(
        DEFAULT_REFUND_RECONCILIATION_BATCH_SIZE,
      );
      expect(resolveOrphanDiscoveryMinAgeMinutes(raw)).toBe(
        DEFAULT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES,
      );
      expect(resolveOrphanDiscoveryBatchSize(raw)).toBe(
        DEFAULT_ORPHAN_DISCOVERY_BATCH_SIZE,
      );
      expect(resolveRefundAlertPendingMinutes(raw)).toBe(
        DEFAULT_REFUND_ALERT_PENDING_MINUTES,
      );
      expect(resolveRefundAlertRejectionsPerHour(raw)).toBe(
        DEFAULT_REFUND_ALERT_REJECTIONS_PER_HOUR,
      );
    }
  });

  it('clamps to documented bounds', () => {
    expect(resolveRefundReconciliationMinAgeMinutes('999999')).toBe(
      MAX_RECONCILIATION_MIN_AGE_MINUTES,
    );
    expect(resolveRefundReconciliationBatchSize('999999')).toBe(
      MAX_RECONCILIATION_BATCH_SIZE,
    );
    expect(resolveOrphanDiscoveryMinAgeMinutes('999999')).toBe(
      MAX_RECONCILIATION_MIN_AGE_MINUTES,
    );
    expect(resolveOrphanDiscoveryBatchSize('999999')).toBe(
      MAX_RECONCILIATION_BATCH_SIZE,
    );
    expect(resolveRefundReconciliationMinAgeMinutes('15')).toBe(15);
    expect(resolveRefundReconciliationBatchSize('50')).toBe(50);
  });
});
