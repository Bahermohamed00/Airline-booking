import { Injectable, Logger } from '@nestjs/common';

/**
 * Refund operational counters (Phase 3.4F). Names carry the dimension — NO
 * labels are used at all, so high-cardinality values (booking/payment/refund
 * ids, emails, Stripe object ids) can never leak into metrics.
 */
export const REFUND_COUNTERS = {
  created: 'refunds_created_total',
  processed: 'refunds_processed_total',
  rejected: 'refunds_rejected_total',
  ambiguousOutcomes: 'refunds_ambiguous_outcomes_total',
  recoveryAttempts: 'refund_recovery_attempts_total',
  recoveryProcessed: 'refund_recovery_processed_total',
  recoveryPending: 'refund_recovery_pending_total',
  recoveryRejected: 'refund_recovery_rejected_total',
  reconciliationProcessed: 'refund_reconciliation_processed_total',
  reconciliationPending: 'refund_reconciliation_pending_total',
  reconciliationRejected: 'refund_reconciliation_rejected_total',
  reconciliationFailed: 'refund_reconciliation_failed_total',
  orphansDiscovered: 'refund_orphans_discovered_total',
  orphansAdopted: 'refund_orphans_adopted_total',
  orphanDiscoveryFailed: 'refund_orphan_discovery_failed_total',
  alertsFired: 'refund_alerts_fired_total',
} as const;

export type RefundCounterName =
  (typeof REFUND_COUNTERS)[keyof typeof REFUND_COUNTERS];

export const REFUND_GAUGES = {
  pending: 'refunds_pending',
  pendingStuck: 'refunds_pending_stuck',
  orphansUnmatched: 'refund_orphans_unmatched',
} as const;

export type RefundGaugeName =
  (typeof REFUND_GAUGES)[keyof typeof REFUND_GAUGES];

export interface RefundMetricsSnapshot {
  /** When this in-process registry started (process start / last reset). */
  since: string;
  counters: Record<RefundCounterName, number>;
  gauges: Record<RefundGaugeName, number>;
}

export const REFUND_ALERT_CODES = [
  'refunds_stuck_pending',
  'reconciliation_failing',
  'orphan_provider_refunds',
  'refund_rejection_spike',
  'recovery_backlog_growing',
] as const;

export type RefundAlertCode = (typeof REFUND_ALERT_CODES)[number];

export interface RefundAlertCondition {
  code: RefundAlertCode;
  /** Counts/thresholds only — never identifiers or provider payloads. */
  detail: string;
  /** ISO timestamp of the first firing while continuously active. */
  since: string;
}

/** Input for one alert evaluation round (executed after each sweep run). */
export interface RefundAlertInput {
  sweepHadFailures: boolean;
  /** Current UNMATCHED orphan provider refunds (level, not per-run delta). */
  unmatchedOrphanCount: number;
  pendingCount: number;
  stuckPendingCount: number;
  rejectionsLastHour: number;
  thresholds: { pendingMinutes: number; rejectionsPerHour: number };
}

/** Consecutive sweeps with failures before `reconciliation_failing` fires. */
const MAX_CONSECUTIVE_FAILED_SWEEPS = 3;
/** Pending-count samples tracked for the backlog-growth condition. */
const BACKLOG_WINDOW = 3;

/**
 * Phase 3.4F — in-process refund metrics and alert conditions.
 *
 * The project has no metrics/alerting framework, so this is deliberately
 * lightweight and honest: an in-memory registry exposed through the admin
 * operations endpoint, plus edge-triggered structured alert log lines
 * (`[REFUND_ALERT] <code> …`) — real, greppable output, no fake external
 * integration. Counters reset on process restart; multi-instance deployments
 * would need a real metrics backend (documented, intentionally not built).
 */
@Injectable()
export class RefundMetricsService {
  private readonly logger = new Logger(RefundMetricsService.name);
  private readonly startedAt = new Date();
  private readonly counters = new Map<RefundCounterName, number>();
  private readonly gauges = new Map<RefundGaugeName, number>();
  private readonly activeAlerts = new Map<RefundAlertCode, RefundAlertCondition>();
  private consecutiveFailedSweeps = 0;
  private readonly pendingHistory: number[] = [];

  increment(name: RefundCounterName, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  setGauge(name: RefundGaugeName, value: number): void {
    this.gauges.set(name, value);
  }

  snapshot(): RefundMetricsSnapshot {
    const counters = {} as Record<RefundCounterName, number>;
    for (const name of Object.values(REFUND_COUNTERS)) {
      counters[name] = this.counters.get(name) ?? 0;
    }
    const gauges = {} as Record<RefundGaugeName, number>;
    for (const name of Object.values(REFUND_GAUGES)) {
      gauges[name] = this.gauges.get(name) ?? 0;
    }
    return { since: this.startedAt.toISOString(), counters, gauges };
  }

  activeAlertConditions(): RefundAlertCondition[] {
    return [...this.activeAlerts.values()];
  }

  /** Test hook: restore the pristine state. */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.activeAlerts.clear();
    this.consecutiveFailedSweeps = 0;
    this.pendingHistory.length = 0;
  }

  /**
   * Evaluates the five refund alert conditions (edge-triggered): a condition
   * logs `[REFUND_ALERT]` exactly once when it activates and clears when it no
   * longer holds. Returns the codes fired in this round.
   */
  evaluateRefundAlerts(input: RefundAlertInput): RefundAlertCode[] {
    this.consecutiveFailedSweeps = input.sweepHadFailures
      ? this.consecutiveFailedSweeps + 1
      : 0;
    this.pendingHistory.push(input.pendingCount);
    if (this.pendingHistory.length > BACKLOG_WINDOW) {
      this.pendingHistory.shift();
    }

    const h = this.pendingHistory;
    const backlogGrowing =
      h.length === BACKLOG_WINDOW && h[0]! < h[1]! && h[1]! < h[2]!;

    const conditions: Array<{ code: RefundAlertCode; active: boolean; detail: string }> = [
      {
        code: 'refunds_stuck_pending',
        active: input.stuckPendingCount > 0,
        detail: `${input.stuckPendingCount} refund(s) PENDING beyond ${input.thresholds.pendingMinutes} minutes`,
      },
      {
        code: 'reconciliation_failing',
        active: this.consecutiveFailedSweeps >= MAX_CONSECUTIVE_FAILED_SWEEPS,
        detail: `${this.consecutiveFailedSweeps} consecutive sweep run(s) with failures`,
      },
      {
        code: 'orphan_provider_refunds',
        active: input.unmatchedOrphanCount > 0,
        detail: `${input.unmatchedOrphanCount} unmatched provider refund(s) awaiting investigation`,
      },
      {
        code: 'refund_rejection_spike',
        active: input.rejectionsLastHour > input.thresholds.rejectionsPerHour,
        detail: `${input.rejectionsLastHour} refund rejection(s) within one hour (threshold ${input.thresholds.rejectionsPerHour})`,
      },
      {
        code: 'recovery_backlog_growing',
        active: backlogGrowing,
        detail: `PENDING refund count grew over ${BACKLOG_WINDOW} consecutive sweeps (${h.join(' → ')})`,
      },
    ];

    const fired: RefundAlertCode[] = [];
    for (const { code, active, detail } of conditions) {
      const existing = this.activeAlerts.get(code);
      if (active && !existing) {
        const condition = { code, detail, since: new Date().toISOString() };
        this.activeAlerts.set(code, condition);
        this.increment(REFUND_COUNTERS.alertsFired);
        this.logger.error(`[REFUND_ALERT] ${code}: ${detail}`);
        fired.push(code);
      } else if (active && existing) {
        existing.detail = detail;
      } else if (!active && existing) {
        this.activeAlerts.delete(code);
        this.logger.log(`[REFUND_ALERT] ${code}: resolved`);
      }
    }
    return fired;
  }
}
