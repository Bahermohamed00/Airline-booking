import { describe, it, expect } from 'vitest';
import { generateSeatMap, SEAT_COLUMNS } from './seat-map';

// The seat-map generator is locked with prisma/seed.ts (same algorithm).
describe('generateSeatMap', () => {
  it('produces exactly `capacity` seats with unique seat numbers', () => {
    for (const capacity of [6, 180, 220, 319, 364, 600]) {
      const seats = generateSeatMap(capacity);
      expect(seats).toHaveLength(capacity);
      expect(new Set(seats.map((s) => s.seatNumber)).size).toBe(capacity);
    }
  });

  it('lays out 6 columns A–F per row with matching seatNumber/row/column', () => {
    const seats = generateSeatMap(12);
    expect(seats.map((s) => s.seatNumber)).toEqual(['1A', '1B', '1C', '1D', '1E', '1F', '2A', '2B', '2C', '2D', '2E', '2F']);
    for (const s of seats) {
      expect(s.seatNumber).toBe(`${s.seatRow}${s.seatColumn}`);
      expect(SEAT_COLUMNS).toContain(s.seatColumn);
    }
  });

  it('assigns cabins by capacity thresholds (FIRST ≥300, BUSINESS ≥220)', () => {
    expect(new Set(generateSeatMap(180).map((s) => s.cabinClass))).toEqual(new Set(['ECONOMY']));

    const narrow = generateSeatMap(220);
    expect(narrow.filter((s) => s.cabinClass === 'BUSINESS')).toHaveLength(36); // rows 1–6 × 6
    expect(narrow.some((s) => s.cabinClass === 'FIRST')).toBe(false);

    const wide = generateSeatMap(364);
    expect(wide.filter((s) => s.cabinClass === 'FIRST')).toHaveLength(12); // rows 1–2 × 6
    expect(wide.filter((s) => s.cabinClass === 'BUSINESS')).toHaveLength(24); // rows 3–6 × 6
  });

  it('flags rows 12 and 25 as exit rows only', () => {
    const seats = generateSeatMap(180); // 30 rows
    expect(seats.filter((s) => s.isExitRow).map((s) => s.seatRow)).toEqual([12, 12, 12, 12, 12, 12, 25, 25, 25, 25, 25, 25]);
    expect(generateSeatMap(60).every((s) => !s.isExitRow)).toBe(true); // 10 rows: no exits
  });
});
