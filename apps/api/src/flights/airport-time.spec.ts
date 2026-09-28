import { describe, it, expect } from 'vitest';
import { formatDateInZone, zoneOffsetMinutes, zonedTimeToUtc } from './airport-time';

describe('airport-time (IANA timezone math on Intl)', () => {
  it('converts the same wall clock to different instants for different zones', () => {
    const berlin = zonedTimeToUtc('2026-10-05', '08:00', 'Europe/Berlin');
    const newYork = zonedTimeToUtc('2026-10-05', '08:00', 'America/New_York');
    expect(berlin.toISOString()).toBe('2026-10-05T06:00:00.000Z'); // UTC+2 (DST)
    expect(newYork.toISOString()).toBe('2026-10-05T12:00:00.000Z'); // UTC-4 (DST)
    expect(newYork.getTime() - berlin.getTime()).toBe(6 * 60 * 60000);
  });

  it('applies DST-aware offsets for the same zone at different dates', () => {
    expect(zoneOffsetMinutes('Europe/Berlin', new Date('2026-07-01T12:00:00Z'))).toBe(120); // CEST
    expect(zoneOffsetMinutes('Europe/Berlin', new Date('2026-01-15T12:00:00Z'))).toBe(60); // CET
    expect(zoneOffsetMinutes('Asia/Dubai', new Date('2026-01-15T12:00:00Z'))).toBe(240); // no DST
  });

  it('round-trips a local departure through UTC into another zone', () => {
    const departure = zonedTimeToUtc('2026-10-05', '08:00', 'Europe/Berlin');
    const arrival = new Date(departure.getTime() + 505 * 60000); // FRA→JFK duration
    // Elapsed duration is zone-independent…
    expect((arrival.getTime() - departure.getTime()) / 60000).toBe(505);
    // …while local clock reading at destination reflects its own zone (10:25 EDT).
    expect(formatDateInZone(arrival, 'America/New_York')).toBe('2026-10-05');
    expect(zonedTimeToUtc('2026-10-05', '10:25', 'America/New_York').getTime()).toBe(arrival.getTime());
  });

  it('keeps the operating date stable around midnight zone shifts', () => {
    expect(formatDateInZone(new Date('2026-10-04T22:30:00Z'), 'Europe/Berlin')).toBe('2026-10-05'); // +2
    expect(formatDateInZone(new Date('2026-10-04T22:30:00Z'), 'America/Los_Angeles')).toBe('2026-10-04'); // -7
  });
});
