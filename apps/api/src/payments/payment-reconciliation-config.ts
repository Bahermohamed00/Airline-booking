/**
 * Default minimum age of a still-PENDING Stripe payment before the
 * reconciliation sweep re-checks its PaymentIntent (when
 * PAYMENT_RECONCILIATION_MIN_AGE_MINUTES is unset or invalid).
 *
 * 5 minutes is deliberate against the 15-minute SeatHold lifecycle: normal
 * webhook delivery takes seconds and Stripe's first retry is fast, so a
 * 5-minute-old PENDING payment is genuinely anomalous — yet reconciling then
 * still leaves ~10 minutes for finalizeSucceededIntent to confirm the booking
 * while its seat holds are alive. Larger values would push recovery past hold
 * expiry into the manual-reconciliation path.
 */
export const DEFAULT_RECONCILIATION_MIN_AGE_MINUTES = 5;

/** Upper bound for the reconciliation age (24h) — guards against absurd values. */
export const MAX_RECONCILIATION_MIN_AGE_MINUTES = 24 * 60;

/** Default per-sweep batch when PAYMENT_RECONCILIATION_BATCH_SIZE is unset or invalid. */
export const DEFAULT_RECONCILIATION_BATCH_SIZE = 25;

/** Upper bound for one sweep's work — a run never scans unboundedly. */
export const MAX_RECONCILIATION_BATCH_SIZE = 200;

/**
 * Parses PAYMENT_RECONCILIATION_MIN_AGE_MINUTES deterministically. Missing,
 * malformed, non-finite or non-positive values fall back to the default;
 * valid values are clamped to the upper bound.
 */
export function resolveReconciliationMinAgeMinutes(raw: unknown): number {
  if (raw === undefined || raw === null) {
    return DEFAULT_RECONCILIATION_MIN_AGE_MINUTES;
  }
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RECONCILIATION_MIN_AGE_MINUTES;
  }
  return Math.min(parsed, MAX_RECONCILIATION_MIN_AGE_MINUTES);
}

/**
 * Parses PAYMENT_RECONCILIATION_BATCH_SIZE deterministically. Missing,
 * malformed, non-finite or non-positive values fall back to the default;
 * valid values are clamped to the upper bound. The remainder of an oversized
 * backlog is picked up by the next scheduled run.
 */
export function resolveReconciliationBatchSize(raw: unknown): number {
  if (raw === undefined || raw === null) {
    return DEFAULT_RECONCILIATION_BATCH_SIZE;
  }
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RECONCILIATION_BATCH_SIZE;
  }
  return Math.min(Math.floor(parsed), MAX_RECONCILIATION_BATCH_SIZE);
}

// ---------- Refund reconciliation (Phase 3.4C) ----------

/**
 * Default minimum age of a still-PENDING refund before the refund
 * reconciliation sweep recovers it (PAYMENT_REFUND_RECONCILIATION_MIN_AGE_MINUTES
 * unset/invalid). 5 minutes gives the synchronous flow and any immediate
 * manual retry ample headroom; anything older is a crash/ambiguity artifact
 * the sweep safely converges via the same idempotent replay.
 */
export const DEFAULT_REFUND_RECONCILIATION_MIN_AGE_MINUTES = 5;

/** Default per-sweep refund batch (PAYMENT_REFUND_RECONCILIATION_BATCH_SIZE unset/invalid). */
export const DEFAULT_REFUND_RECONCILIATION_BATCH_SIZE = 25;

/** Shared bounded-positive parser for the refund sweep knobs. */
function resolveBoundedPositive(
  raw: unknown,
  fallback: number,
  max: number,
): number {
  if (raw === undefined || raw === null) {
    return fallback;
  }
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

/** Parses PAYMENT_REFUND_RECONCILIATION_MIN_AGE_MINUTES (fallback 5, clamp 24h). */
export function resolveRefundReconciliationMinAgeMinutes(raw: unknown): number {
  return resolveBoundedPositive(
    raw,
    DEFAULT_REFUND_RECONCILIATION_MIN_AGE_MINUTES,
    MAX_RECONCILIATION_MIN_AGE_MINUTES,
  );
}

/** Parses PAYMENT_REFUND_RECONCILIATION_BATCH_SIZE (fallback 25, clamp 200). */
export function resolveRefundReconciliationBatchSize(raw: unknown): number {
  return resolveBoundedPositive(
    raw,
    DEFAULT_REFUND_RECONCILIATION_BATCH_SIZE,
    MAX_RECONCILIATION_BATCH_SIZE,
  );
}

// ---------- Orphan provider-refund discovery (Phase 3.4E) ----------

/**
 * Default minimum age of a still-PENDING refund before orphan discovery
 * inspects its payment at the provider (PAYMENT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES
 * unset/invalid). 60 minutes is deliberately larger than the recovery sweep's
 * 5 minutes: normal recovery converges crash-window refunds quickly, so only
 * refunds that stayed stuck long enough to raise the "did the provider keep
 * the money?" question trigger a bounded provider-side lookup.
 */
export const DEFAULT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES = 60;

/** Default per-sweep orphan-discovery batch (PAYMENT_ORPHAN_DISCOVERY_BATCH_SIZE unset/invalid). */
export const DEFAULT_ORPHAN_DISCOVERY_BATCH_SIZE = 25;

/** Parses PAYMENT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES (fallback 60, clamp 24h). */
export function resolveOrphanDiscoveryMinAgeMinutes(raw: unknown): number {
  return resolveBoundedPositive(
    raw,
    DEFAULT_ORPHAN_DISCOVERY_MIN_AGE_MINUTES,
    MAX_RECONCILIATION_MIN_AGE_MINUTES,
  );
}

/** Parses PAYMENT_ORPHAN_DISCOVERY_BATCH_SIZE (fallback 25, clamp 200). */
export function resolveOrphanDiscoveryBatchSize(raw: unknown): number {
  return resolveBoundedPositive(
    raw,
    DEFAULT_ORPHAN_DISCOVERY_BATCH_SIZE,
    MAX_RECONCILIATION_BATCH_SIZE,
  );
}

// ---------- Refund operational alerts (Phase 3.4F) ----------

/**
 * Default age beyond which a still-PENDING refund is considered STUCK and the
 * `refunds_stuck_pending` alert condition activates
 * (PAYMENT_REFUND_ALERT_PENDING_MINUTES unset/invalid). Matches the orphan
 * discovery age: an hour without convergence is abnormal.
 */
export const DEFAULT_REFUND_ALERT_PENDING_MINUTES = 60;

/**
 * Default hourly definitive-rejection count that activates the
 * `refund_rejection_spike` alert condition
 * (PAYMENT_REFUND_ALERT_REJECTIONS_PER_HOUR unset/invalid).
 */
export const DEFAULT_REFUND_ALERT_REJECTIONS_PER_HOUR = 5;

/** Parses PAYMENT_REFUND_ALERT_PENDING_MINUTES (fallback 60, clamp 24h). */
export function resolveRefundAlertPendingMinutes(raw: unknown): number {
  return resolveBoundedPositive(
    raw,
    DEFAULT_REFUND_ALERT_PENDING_MINUTES,
    MAX_RECONCILIATION_MIN_AGE_MINUTES,
  );
}

/** Parses PAYMENT_REFUND_ALERT_REJECTIONS_PER_HOUR (fallback 5, clamp 1000). */
export function resolveRefundAlertRejectionsPerHour(raw: unknown): number {
  return resolveBoundedPositive(raw, DEFAULT_REFUND_ALERT_REJECTIONS_PER_HOUR, 1000);
}
