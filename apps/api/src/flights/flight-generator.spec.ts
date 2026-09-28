import { describe, it, expect } from 'vitest';
import { CabinClass, Weekday } from '@prisma/client';
import { calendarDatesInRange, computeFareDrafts, ruleOperatesOn, weekdayOfDate } from './flight-generator';

describe('calendarDatesInRange', () => {
  it('iterates inclusively over calendar dates', () => {
    expect(calendarDatesInRange('2026-10-01', '2026-10-03')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(calendarDatesInRange('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
    expect(calendarDatesInRange('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('crosses month and year boundaries', () => {
    const dates = calendarDatesInRange('2026-12-30', '2027-01-02');
    expect(dates).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
});

describe('weekdayOfDate / ruleOperatesOn', () => {
  const rule = (days: Weekday[], from = '2026-10-01', to = '2026-10-31') => ({
    operatingDays: days,
    effectiveFrom: new Date(`${from}T00:00:00Z`),
    effectiveTo: new Date(`${to}T00:00:00Z`),
  });

  it('resolves calendar weekdays deterministically', () => {
    expect(weekdayOfDate('2026-10-05')).toBe(Weekday.MON);
    expect(weekdayOfDate('2026-10-10')).toBe(Weekday.SAT);
    expect(weekdayOfDate('2026-10-11')).toBe(Weekday.SUN);
  });

  it('operates only on listed weekdays', () => {
    const mwf = rule([Weekday.MON, Weekday.WED, Weekday.FRI]);
    expect(ruleOperatesOn(mwf, '2026-10-05')).toBe(true); // Mon
    expect(ruleOperatesOn(mwf, '2026-10-06')).toBe(false); // Tue
    expect(ruleOperatesOn(mwf, '2026-10-07')).toBe(true); // Wed
    expect(ruleOperatesOn(mwf, '2026-10-10')).toBe(false); // Sat
  });

  it('respects the effective date range (inclusive)', () => {
    const r = rule([Weekday.MON], '2026-10-05', '2026-10-12');
    expect(ruleOperatesOn(r, '2026-10-05')).toBe(true);
    expect(ruleOperatesOn(r, '2026-10-12')).toBe(true);
    expect(ruleOperatesOn(r, '2026-10-19')).toBe(false); // after effectiveTo
    expect(ruleOperatesOn(rule([Weekday.MON], '2026-10-12', '2026-10-31'), '2026-10-05')).toBe(false); // before effectiveFrom
  });
});

describe('computeFareDrafts (deterministic fare strategy)', () => {
  it('computes distance-based economy with 16% tax and 4% fee', () => {
    const [economy] = computeFareDrafts(6201, 180);
    expect(economy!.cabinClass).toBe(CabinClass.ECONOMY);
    expect(economy!.basePrice).toBe(Math.round(49 + 6201 * 0.06)); // 421
    expect(economy!.taxAmount).toBe(Math.round(economy!.basePrice * 0.16));
    expect(economy!.feeAmount).toBe(Math.round(economy!.basePrice * 0.04));
    expect(economy!.availableCount).toBe(180); // all-economy A320
  });

  it('adds BUSINESS/FIRST fares only when the aircraft has those cabins', () => {
    expect(computeFareDrafts(379, 180).map((f) => f.cabinClass)).toEqual([CabinClass.ECONOMY]);
    expect(computeFareDrafts(942, 220).map((f) => f.cabinClass)).toEqual([CabinClass.ECONOMY, CabinClass.BUSINESS]);

    const wide = computeFareDrafts(6201, 364);
    expect(wide.map((f) => f.cabinClass)).toEqual([CabinClass.ECONOMY, CabinClass.BUSINESS, CabinClass.FIRST]);
    expect(wide[2]!.basePrice).toBe(Math.round(Math.round(49 + 6201 * 0.06) * 5.5));
    expect(wide.map((f) => f.availableCount)).toEqual([328, 24, 12]);
  });

  it('is fully deterministic and never random', () => {
    expect(computeFareDrafts(6201, 364)).toEqual(computeFareDrafts(6201, 364));
    expect(JSON.stringify(computeFareDrafts(942, 220))).not.toContain('random');
  });
});
