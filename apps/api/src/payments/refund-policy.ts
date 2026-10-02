/**
 * BR-15: cancellation/refund amounts are calculated from the fare rules
 * captured in the booking's `fareRulesSnapshot` at creation time, the
 * configured cancellation fee, and the original payment amount.
 *
 * The snapshot shape is `{ …, refundPolicy: { refundable, cancellationFeePercent } | null }`.
 * A missing/invalid policy returns null ("not configured") — callers must not
 * fabricate a refund policy in that case.
 */
export interface RefundPolicy {
  refundable: boolean;
  /** 0–100; the share of the original payment withheld on cancellation. */
  cancellationFeePercent: number;
}

export function resolveRefundPolicy(snapshot: unknown): RefundPolicy | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const policy = (snapshot as { refundPolicy?: unknown }).refundPolicy;
  if (!policy || typeof policy !== 'object') return null;
  const { refundable, cancellationFeePercent } = policy as {
    refundable?: unknown;
    cancellationFeePercent?: unknown;
  };
  if (typeof refundable !== 'boolean') return null;
  const fee =
    typeof cancellationFeePercent === 'number' && Number.isFinite(cancellationFeePercent)
      ? Math.min(100, Math.max(0, cancellationFeePercent))
      : refundable
        ? 0
        : 100;
  return { refundable, cancellationFeePercent: fee };
}

/** Reads a `fareRules` JSON column value into a snapshot-ready policy, if configured. */
export function refundPolicyFromFareRules(fareRules: unknown): RefundPolicy | null {
  if (!fareRules || typeof fareRules !== 'object') return null;
  const { refundable, cancellationFeePercent } = fareRules as {
    refundable?: unknown;
    cancellationFeePercent?: unknown;
  };
  if (typeof refundable !== 'boolean') return null;
  const fee =
    typeof cancellationFeePercent === 'number' && Number.isFinite(cancellationFeePercent)
      ? Math.min(100, Math.max(0, cancellationFeePercent))
      : refundable
        ? 0
        : 100;
  return { refundable, cancellationFeePercent: fee };
}

/** Integer-cent math avoids binary floating-point drift on money. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
