import { describe, it, expect } from 'vitest';
import { resolveSeatHoldMinutes, DEFAULT_SEAT_HOLD_MINUTES, MAX_SEAT_HOLD_MINUTES } from './seat-hold-config';

describe('resolveSeatHoldMinutes', () => {
  it('defaults to 15 minutes when the variable is unset', () => {
    expect(resolveSeatHoldMinutes(undefined)).toBe(DEFAULT_SEAT_HOLD_MINUTES);
    expect(resolveSeatHoldMinutes(null)).toBe(DEFAULT_SEAT_HOLD_MINUTES);
    expect(resolveSeatHoldMinutes('')).toBe(DEFAULT_SEAT_HOLD_MINUTES);
  });

  it.each([
    ['non-numeric string', 'not-a-number'],
    ['whitespace', '   '],
    ['NaN', NaN],
    ['zero', '0'],
    ['negative', '-5'],
    ['Infinity', Infinity],
    ['mixed garbage', '15minutes'],
  ])('falls back to the default for %s — never NaN', (_label, raw) => {
    const minutes = resolveSeatHoldMinutes(raw);
    expect(minutes).toBe(DEFAULT_SEAT_HOLD_MINUTES);
    expect(Number.isFinite(minutes)).toBe(true);
    expect(minutes).toBeGreaterThan(0);
  });

  it('accepts valid positive values (string or number)', () => {
    expect(resolveSeatHoldMinutes('30')).toBe(30);
    expect(resolveSeatHoldMinutes(20)).toBe(20);
    expect(resolveSeatHoldMinutes(' 45 ')).toBe(45);
  });

  it('clamps absurdly large values to the upper bound', () => {
    expect(resolveSeatHoldMinutes('999999')).toBe(MAX_SEAT_HOLD_MINUTES);
    expect(Number.isFinite(resolveSeatHoldMinutes('999999'))).toBe(true);
  });
});
