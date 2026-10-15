import { describe, it, expect } from 'vitest';
import { evaluateCancellationPolicy } from './cancellation-policy';

/**
 * Approved NovaAir cancellation policy — deterministic hour-based boundaries.
 * All cases pin `now` and derive departure from exact millisecond offsets.
 */

const NOW = new Date('2026-10-06T12:00:00.000Z');
const H = 3_600_000;

const decide = (
  hoursOffset: number,
  overrides: Partial<Parameters<typeof evaluateCancellationPolicy>[0]> = {},
) =>
  evaluateCancellationPolicy({
    bookingStatus: 'CONFIRMED',
    refundable: true,
    departureTime: new Date(NOW.getTime() + hoursOffset * H),
    now: NOW,
    ...overrides,
  });

describe('evaluateCancellationPolicy — time tiers', () => {
  it('A: more than 7 days (169h) → 100%', () => {
    const d = decide(169);
    expect(d).toMatchObject({ allowed: true, refundPercentage: 100, reason: 'REFUND_100_PERCENT' });
    expect(d.hoursUntilDeparture).toBe(169);
  });

  it('B: exactly 168h → 80% (boundary belongs to the 3–6 day tier)', () => {
    expect(decide(168)).toMatchObject({ allowed: true, refundPercentage: 80, reason: 'REFUND_80_PERCENT' });
  });

  it('C: mid 3–6 day range (120h) → 80%', () => {
    expect(decide(120)).toMatchObject({ allowed: true, refundPercentage: 80, reason: 'REFUND_80_PERCENT' });
  });

  it('D: exactly 72h → 80% (resolves the 3–6 days vs 24–72 hours overlap)', () => {
    expect(decide(72)).toMatchObject({ allowed: true, refundPercentage: 80, reason: 'REFUND_80_PERCENT' });
  });

  it('E: just below 72h (71h59m) → 50%', () => {
    const d = decide(71 + 59 / 60);
    expect(d).toMatchObject({ allowed: true, refundPercentage: 50, reason: 'REFUND_50_PERCENT' });
  });

  it('F: exactly 24h → 50%', () => {
    expect(decide(24)).toMatchObject({ allowed: true, refundPercentage: 50, reason: 'REFUND_50_PERCENT' });
  });

  it('G: just below 24h (23h59m) → cancellation allowed with 0% refund', () => {
    const d = decide(23 + 59 / 60);
    expect(d).toMatchObject({ allowed: true, refundPercentage: 0, reason: 'LESS_THAN_24_HOURS' });
  });

  it('H: at/after departure (0h and negative) → cancellation rejected', () => {
    expect(decide(0)).toMatchObject({ allowed: false, refundPercentage: 0, reason: 'AFTER_DEPARTURE' });
    expect(decide(-1)).toMatchObject({ allowed: false, refundPercentage: 0, reason: 'AFTER_DEPARTURE' });
  });
});

describe('evaluateCancellationPolicy — status and fare gates', () => {
  it('I: non-refundable fare → cancellation allowed with 0% regardless of time', () => {
    expect(decide(200, { refundable: false })).toMatchObject({
      allowed: true,
      refundPercentage: 0,
      reason: 'NON_REFUNDABLE_FARE',
    });
    expect(decide(48, { refundable: false })).toMatchObject({
      allowed: true,
      refundPercentage: 0,
      reason: 'NON_REFUNDABLE_FARE',
    });
  });

  it('I2: missing fare policy is treated as non-refundable (never auto-refunds unknown fares)', () => {
    expect(decide(200, { refundable: false })).toMatchObject({ refundPercentage: 0 });
  });

  it('J: already cancelled → rejected', () => {
    expect(decide(200, { bookingStatus: 'CANCELLED' })).toMatchObject({
      allowed: false,
      reason: 'ALREADY_CANCELLED',
    });
  });

  it('K: completed booking (CHECKED_IN / BOARDED / NO_SHOW) → rejected', () => {
    for (const bookingStatus of ['CHECKED_IN', 'BOARDED', 'NO_SHOW'] as const) {
      expect(decide(200, { bookingStatus })).toMatchObject({
        allowed: false,
        reason: 'COMPLETED_BOOKING',
      });
    }
  });

  it('status gates win over time: cancelled/completed/after-departure are evaluated before the fare gate', () => {
    expect(decide(-5, { refundable: false, bookingStatus: 'CANCELLED' })).toMatchObject({
      reason: 'ALREADY_CANCELLED',
    });
    expect(decide(-5, { bookingStatus: 'BOARDED' })).toMatchObject({ reason: 'COMPLETED_BOOKING' });
    expect(decide(-5, { refundable: false })).toMatchObject({ reason: 'AFTER_DEPARTURE' });
  });

  it('PENDING bookings follow the same time guards (e.g. cannot cancel after departure)', () => {
    expect(decide(-1, { bookingStatus: 'PENDING' })).toMatchObject({
      allowed: false,
      reason: 'AFTER_DEPARTURE',
    });
    expect(decide(48, { bookingStatus: 'PENDING' })).toMatchObject({ allowed: true });
  });
});
