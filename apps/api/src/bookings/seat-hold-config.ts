/** Default seat-hold window when SEAT_HOLD_MINUTES is unset or invalid. */
export const DEFAULT_SEAT_HOLD_MINUTES = 15;

/** Upper bound for the seat-hold window (24h) — guards against absurd values. */
export const MAX_SEAT_HOLD_MINUTES = 24 * 60;

/**
 * Parses SEAT_HOLD_MINUTES deterministically. Missing, malformed, non-finite
 * or non-positive values fall back to the default; valid values are clamped
 * to the upper bound. The result is always a finite positive number — a bad
 * environment value can never produce a NaN expiry.
 */
export function resolveSeatHoldMinutes(raw: unknown): number {
  if (raw === undefined || raw === null) {
    return DEFAULT_SEAT_HOLD_MINUTES;
  }
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SEAT_HOLD_MINUTES;
  }
  return Math.min(parsed, MAX_SEAT_HOLD_MINUTES);
}
