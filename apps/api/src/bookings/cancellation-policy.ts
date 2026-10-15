import { BookingStatus } from '@prisma/client';

/**
 * Approved NovaAir cancellation & refund policy — the single business-rule
 * evaluation for customer cancellation. Pure function: given the booking's
 * current status, the fare's refundability (from the fare rules snapshot sold)
 * and the scheduled departure timestamp, it decides whether cancellation is
 * allowed and which refund percentage applies.
 *
 * Time boundaries are deterministic and hour-based (no calendar-day rounding,
 * no 72h overlap ambiguity):
 * - > 168h before departure           → 100%
 * - >= 72h and <= 168h                → 80%  (exactly 168h and 72h are 80%)
 * - >= 24h and < 72h                  → 50%  (exactly 24h is 50%; 71h59m is 50%)
 * - > 0h and < 24h                    → 0%   (23h59m is 0%)
 * - <= 0h (departure passed)          → cancellation not allowed
 *
 * Evaluation order mirrors the approved policy: already-cancelled and
 * completed bookings are rejected first, then after-departure, then the fare
 * refundability gate, then the time tiers.
 */
export type CancellationPolicyReason =
  | 'AFTER_DEPARTURE'
  | 'ALREADY_CANCELLED'
  | 'COMPLETED_BOOKING'
  | 'NON_REFUNDABLE_FARE'
  | 'LESS_THAN_24_HOURS'
  | 'REFUND_50_PERCENT'
  | 'REFUND_80_PERCENT'
  | 'REFUND_100_PERCENT';

export interface CancellationPolicyInput {
  bookingStatus: BookingStatus;
  /**
   * Whether the fare sold is refundable (from the booking's fare rules
   * snapshot). A missing/unconfigured policy is treated as NOT refundable —
   * automatic refunds are never issued for unknown fare types.
   */
  refundable: boolean;
  /** The flight's scheduled departure timestamp. */
  departureTime: Date;
  /** Injectable clock for deterministic evaluation; defaults to now. */
  now?: Date;
}

export interface CancellationPolicyDecision {
  allowed: boolean;
  reason: CancellationPolicyReason;
  /** 0 | 50 | 80 | 100 — the share of the paid amount to refund. */
  refundPercentage: number;
  /** Exact hours between now and the scheduled departure (negative after departure). */
  hoursUntilDeparture: number;
}

/** Post-flight booking statuses — a completed booking can never be cancelled. */
const COMPLETED_BOOKING_STATUSES: readonly BookingStatus[] = [
  'CHECKED_IN',
  'BOARDED',
  'NO_SHOW',
];

const HOURS_MS = 3_600_000;

export function evaluateCancellationPolicy(
  input: CancellationPolicyInput,
): CancellationPolicyDecision {
  const now = input.now ?? new Date();
  const hoursUntilDeparture =
    (input.departureTime.getTime() - now.getTime()) / HOURS_MS;
  const base = { hoursUntilDeparture };

  if (input.bookingStatus === 'CANCELLED') {
    return { ...base, allowed: false, refundPercentage: 0, reason: 'ALREADY_CANCELLED' };
  }
  if (COMPLETED_BOOKING_STATUSES.includes(input.bookingStatus)) {
    return { ...base, allowed: false, refundPercentage: 0, reason: 'COMPLETED_BOOKING' };
  }
  if (hoursUntilDeparture <= 0) {
    return { ...base, allowed: false, refundPercentage: 0, reason: 'AFTER_DEPARTURE' };
  }
  if (!input.refundable) {
    return { ...base, allowed: true, refundPercentage: 0, reason: 'NON_REFUNDABLE_FARE' };
  }
  if (hoursUntilDeparture > 168) {
    return { ...base, allowed: true, refundPercentage: 100, reason: 'REFUND_100_PERCENT' };
  }
  if (hoursUntilDeparture >= 72) {
    return { ...base, allowed: true, refundPercentage: 80, reason: 'REFUND_80_PERCENT' };
  }
  if (hoursUntilDeparture >= 24) {
    return { ...base, allowed: true, refundPercentage: 50, reason: 'REFUND_50_PERCENT' };
  }
  return { ...base, allowed: true, refundPercentage: 0, reason: 'LESS_THAN_24_HOURS' };
}

/** Customer-facing rejection messages for non-allowed decisions. */
export const CANCELLATION_REJECTION_MESSAGES: Readonly<
  Partial<Record<CancellationPolicyReason, string>>
> = {
  AFTER_DEPARTURE:
    'Cancellation is no longer possible — the scheduled departure time has passed',
  ALREADY_CANCELLED: 'Booking is already cancelled',
  COMPLETED_BOOKING: 'A completed booking cannot be cancelled',
};
