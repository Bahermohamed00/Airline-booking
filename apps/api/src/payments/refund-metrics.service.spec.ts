import { describe, it, expect, beforeEach } from 'vitest';
import {
  REFUND_COUNTERS,
  REFUND_GAUGES,
  RefundMetricsService,
  type RefundAlertInput,
} from './refund-metrics.service';

/**
 * Phase 3.4F — in-process refund metrics registry and edge-triggered alert
 * conditions. Sweep-integrated conditions (stuck pending, consecutive sweep
 * failures, orphan presence, edge triggering) are also covered in
 * refund-reconciliation.service.spec.ts.
 */

const input = (overrides: Partial<RefundAlertInput> = {}): RefundAlertInput => ({
  sweepHadFailures: false,
  unmatchedOrphanCount: 0,
  pendingCount: 0,
  stuckPendingCount: 0,
  rejectionsLastHour: 0,
  thresholds: { pendingMinutes: 60, rejectionsPerHour: 5 },
  ...overrides,
});

describe('RefundMetricsService', () => {
  let metrics: RefundMetricsService;

  beforeEach(() => {
    metrics = new RefundMetricsService();
  });

  it('starts with a zeroed snapshot covering every counter and gauge', () => {
    const snapshot = metrics.snapshot();
    for (const name of Object.values(REFUND_COUNTERS)) {
      expect(snapshot.counters[name]).toBe(0);
    }
    for (const name of Object.values(REFUND_GAUGES)) {
      expect(snapshot.gauges[name]).toBe(0);
    }
    expect(snapshot.since).toBeDefined();
  });

  it('accumulates counters and gauges', () => {
    metrics.increment(REFUND_COUNTERS.created);
    metrics.increment(REFUND_COUNTERS.created);
    metrics.increment(REFUND_COUNTERS.processed);
    metrics.setGauge(REFUND_GAUGES.pending, 7);

    const snapshot = metrics.snapshot();
    expect(snapshot.counters[REFUND_COUNTERS.created]).toBe(2);
    expect(snapshot.counters[REFUND_COUNTERS.processed]).toBe(1);
    expect(snapshot.gauges[REFUND_GAUGES.pending]).toBe(7);
  });

  it('uses plain counter names only — no labels, so no identifiers can leak', () => {
    for (const name of [
      ...Object.values(REFUND_COUNTERS),
      ...Object.values(REFUND_GAUGES),
    ]) {
      // No label syntax and no per-entity dimensions by construction.
      expect(name).not.toMatch(/[{}=]/);
      expect(name).toMatch(/^refund[s]?_[a-z_]+$/);
    }
  });

  it('fires refund_rejection_spike above the hourly threshold, resolves below it', () => {
    const fired = metrics.evaluateRefundAlerts(
      input({ rejectionsLastHour: 6 }),
    );
    expect(fired).toContain('refund_rejection_spike');
    expect(
      metrics.activeAlertConditions().find(
        (a) => a.code === 'refund_rejection_spike',
      )?.detail,
    ).toContain('6');

    // At the threshold (not above) the condition clears.
    metrics.evaluateRefundAlerts(input({ rejectionsLastHour: 5 }));
    expect(metrics.activeAlertConditions().map((a) => a.code)).not.toContain(
      'refund_rejection_spike',
    );
  });

  it('fires recovery_backlog_growing only after three strictly increasing sweeps', () => {
    metrics.evaluateRefundAlerts(input({ pendingCount: 2 }));
    metrics.evaluateRefundAlerts(input({ pendingCount: 3 }));
    expect(metrics.activeAlertConditions().map((a) => a.code)).not.toContain(
      'recovery_backlog_growing',
    );

    metrics.evaluateRefundAlerts(input({ pendingCount: 5 }));
    expect(metrics.activeAlertConditions().map((a) => a.code)).toContain(
      'recovery_backlog_growing',
    );

    // A non-increasing sample clears the condition.
    metrics.evaluateRefundAlerts(input({ pendingCount: 5 }));
    expect(metrics.activeAlertConditions().map((a) => a.code)).not.toContain(
      'recovery_backlog_growing',
    );
  });

  it('edge-triggers: one alert log/counter increment per activation', () => {
    metrics.evaluateRefundAlerts(input({ stuckPendingCount: 2 }));
    metrics.evaluateRefundAlerts(input({ stuckPendingCount: 3 }));
    expect(
      metrics.snapshot().counters[REFUND_COUNTERS.alertsFired],
    ).toBe(1);
    // Detail stays current while continuously active.
    expect(
      metrics.activeAlertConditions().find(
        (a) => a.code === 'refunds_stuck_pending',
      )?.detail,
    ).toContain('3');
  });

  it('reset restores the pristine state (test hook)', () => {
    metrics.increment(REFUND_COUNTERS.created);
    metrics.evaluateRefundAlerts(input({ stuckPendingCount: 1 }));
    metrics.reset();
    expect(metrics.snapshot().counters[REFUND_COUNTERS.created]).toBe(0);
    expect(metrics.activeAlertConditions()).toEqual([]);
  });
});
