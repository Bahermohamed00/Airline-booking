import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';
import {
  resolveOrphanDiscoveryBatchSize,
  resolveOrphanDiscoveryMinAgeMinutes,
  resolveRefundAlertPendingMinutes,
  resolveRefundAlertRejectionsPerHour,
  resolveRefundReconciliationBatchSize,
  resolveRefundReconciliationMinAgeMinutes,
} from './payment-reconciliation-config.js';
import {
  REFUND_COUNTERS,
  REFUND_GAUGES,
  RefundMetricsService,
} from './refund-metrics.service.js';

export interface RefundReconciliationSummary {
  eligible: number;
  processed: number;
  pending: number;
  rejected: number;
  failed: number;
}

export interface OrphanDiscoverySummary {
  eligible: number;
  checked: number;
  adopted: number;
  unmatched: number;
  failed: number;
}

/**
 * Phase 3.4C — scheduled refund reconciliation. Converges stale PENDING
 * refunds (crash-window / ambiguous-provider artifacts) toward the Stripe
 * truth by delegating each one to PaymentsService.reconcileRefund — the same
 * idempotent replay recovery as the admin resume endpoint:
 *
 * - LOCAL PENDING + refund exists at Stripe → replay returns it → PROCESSED;
 * - LOCAL PENDING + refund never existed at Stripe → replay executes it
 *   exactly once (the intended refund, never a duplicate) → PROCESSED;
 * - LOCAL PENDING + definitive provider rejection → REJECTED (terminal);
 * - LOCAL PENDING + ambiguous provider outcome → stays PENDING, retried by a
 *   later sweep;
 * - PROCESSED / REJECTED rows are never eligible.
 *
 * Phase 3.4E — orphan provider-refund discovery: payments whose refund stayed
 * PENDING past the (larger) discovery age get ONE bounded read-only provider
 * refund lookup each via PaymentsService.discoverProviderRefundsForPayment.
 * Discovery never creates refunds: strong matches converge locally, unmatched
 * provider refunds are flagged as orphan records for investigation.
 *
 * Phase 3.4F — after every run the sweep refreshes the refund metrics gauges
 * and evaluates the refund alert conditions (edge-triggered internal alerts).
 *
 * Safety: provider idempotency keys are the persisted refund ids, so no
 * replay can ever create a second Stripe refund; per-refund failure isolation
 * keeps one bad refund from stopping the batch; every database transition is
 * CAS-protected, so overlapping sweeps, concurrent resumes and webhook
 * processing converge. The crons are thin wrappers — NODE_ENV=test disables
 * them (same guard as the other sweeps).
 */
@Injectable()
export class RefundReconciliationService {
  private readonly logger = new Logger(RefundReconciliationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RefundMetricsService) private readonly metrics: RefundMetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileStalePendingRefundsJob(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    await this.reconcileStalePendingRefunds();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async discoverOrphanProviderRefundsJob(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    await this.discoverOrphanProviderRefunds();
  }

  /** One bounded sweep; the remainder of an oversized backlog drains next run. */
  async reconcileStalePendingRefunds(
    now = new Date(),
  ): Promise<RefundReconciliationSummary> {
    const summary: RefundReconciliationSummary = {
      eligible: 0,
      processed: 0,
      pending: 0,
      rejected: 0,
      failed: 0,
    };
    const minAgeMinutes = resolveRefundReconciliationMinAgeMinutes(
      this.config.get('PAYMENT_REFUND_RECONCILIATION_MIN_AGE_MINUTES'),
    );
    const batchSize = resolveRefundReconciliationBatchSize(
      this.config.get('PAYMENT_REFUND_RECONCILIATION_BATCH_SIZE'),
    );
    const cutoff = new Date(now.getTime() - minAgeMinutes * 60_000);

    const stale = await this.prisma.refund.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: { id: true },
    });
    summary.eligible = stale.length;

    // Sequential by design: bounded provider call rate, simple isolation.
    for (const refund of stale) {
      try {
        const outcome = await this.payments.reconcileRefund(refund.id);
        summary[outcome] += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(
          `refund reconciliation: refund ${refund.id} failed transiently: ${String(error)}`,
        );
      }
    }
    if (summary.eligible > 0) {
      this.logger.log(
        `refund reconciliation sweep: eligible=${summary.eligible} ` +
          `processed=${summary.processed} pending=${summary.pending} ` +
          `rejected=${summary.rejected} failed=${summary.failed}`,
      );
    }
    this.metrics.increment(
      REFUND_COUNTERS.reconciliationProcessed,
      summary.processed,
    );
    this.metrics.increment(
      REFUND_COUNTERS.reconciliationPending,
      summary.pending,
    );
    this.metrics.increment(
      REFUND_COUNTERS.reconciliationRejected,
      summary.rejected,
    );
    this.metrics.increment(
      REFUND_COUNTERS.reconciliationFailed,
      summary.failed,
    );
    await this.refreshObservability(now, summary.failed > 0);
    return summary;
  }

  /**
   * One bounded orphan-discovery run (Phase 3.4E): eligible payments are those
   * with a refund still PENDING past the discovery age, created by the
   * configured provider, holding a provider reference, and actually paid.
   * Each payment gets exactly one read-only provider lookup; unmatched
   * provider refunds become orphan records — never new refunds.
   */
  async discoverOrphanProviderRefunds(
    now = new Date(),
  ): Promise<OrphanDiscoverySummary> {
    const summary: OrphanDiscoverySummary = {
      eligible: 0,
      checked: 0,
      adopted: 0,
      unmatched: 0,
      failed: 0,
    };
    const minAgeMinutes = resolveOrphanDiscoveryMinAgeMinutes(
      this.config.get('PAYMENT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES'),
    );
    const batchSize = resolveOrphanDiscoveryBatchSize(
      this.config.get('PAYMENT_ORPHAN_DISCOVERY_BATCH_SIZE'),
    );
    const cutoff = new Date(now.getTime() - minAgeMinutes * 60_000);

    const staleRefunds = await this.prisma.refund.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
        payment: {
          provider: this.paymentsProviderName(),
          providerReference: { not: null },
          status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: { paymentId: true },
    });
    // One lookup per payment even when several of its refunds are stale.
    const paymentIds = [...new Set(staleRefunds.map((r) => r.paymentId))];
    summary.eligible = paymentIds.length;

    // Sequential by design: at most one provider call per payment per run.
    for (const paymentId of paymentIds) {
      try {
        const outcome =
          await this.payments.discoverProviderRefundsForPayment(paymentId);
        if (outcome.checked) {
          summary.checked += 1;
          summary.adopted += outcome.adopted;
          summary.unmatched += outcome.unmatchedNew;
        }
      } catch (error) {
        summary.failed += 1;
        this.metrics.increment(REFUND_COUNTERS.orphanDiscoveryFailed);
        this.logger.warn(
          `orphan discovery: payment ${paymentId} lookup failed transiently: ${String(error)}`,
        );
      }
    }
    if (summary.eligible > 0) {
      this.logger.log(
        `orphan discovery sweep: eligible=${summary.eligible} ` +
          `checked=${summary.checked} adopted=${summary.adopted} ` +
          `unmatched=${summary.unmatched} failed=${summary.failed}`,
      );
    }
    await this.refreshObservability(now, summary.failed > 0);
    return summary;
  }

  /** The configured provider's name (kept behind a method for testability). */
  private paymentsProviderName(): string {
    return this.payments.configuredProviderName();
  }

  /**
   * Phase 3.4F: refresh the pending/orphan gauges from the database and
   * evaluate the refund alert conditions after every sweep run.
   */
  private async refreshObservability(
    now: Date,
    sweepHadFailures: boolean,
  ): Promise<void> {
    try {
      const pendingMinutes = resolveRefundAlertPendingMinutes(
        this.config.get('PAYMENT_REFUND_ALERT_PENDING_MINUTES'),
      );
      const stuckCutoff = new Date(now.getTime() - pendingMinutes * 60_000);
      const rejectionCutoff = new Date(now.getTime() - 60 * 60_000);
      const [pendingCount, stuckPendingCount, rejectionsLastHour, unmatched] =
        await Promise.all([
          this.prisma.refund.count({ where: { status: 'PENDING' } }),
          this.prisma.refund.count({
            where: { status: 'PENDING', createdAt: { lt: stuckCutoff } },
          }),
          // Definitive rejections land on REJECTED rows; updatedAt is the
          // rejection time (the row is created PENDING).
          this.prisma.refund.count({
            where: { status: 'REJECTED', updatedAt: { gte: rejectionCutoff } },
          }),
          this.prisma.orphanProviderRefund.count({
            where: { status: 'UNMATCHED' },
          }),
        ]);
      this.metrics.setGauge(REFUND_GAUGES.pending, pendingCount);
      this.metrics.setGauge(REFUND_GAUGES.pendingStuck, stuckPendingCount);
      this.metrics.setGauge(REFUND_GAUGES.orphansUnmatched, unmatched);
      this.metrics.evaluateRefundAlerts({
        sweepHadFailures,
        unmatchedOrphanCount: unmatched,
        pendingCount,
        stuckPendingCount,
        rejectionsLastHour,
        thresholds: {
          pendingMinutes,
          rejectionsPerHour: resolveRefundAlertRejectionsPerHour(
            this.config.get('PAYMENT_REFUND_ALERT_REJECTIONS_PER_HOUR'),
          ),
        },
      });
    } catch (error) {
      // Observability must never break the sweep itself.
      this.logger.warn(`refund observability refresh failed: ${String(error)}`);
    }
  }
}
