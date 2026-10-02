import { describe, expect, it } from 'vitest';
import { AIRCRAFT, AIRPORTS, BOOKINGS, FLIGHTS, LOYALTY, ROUTES } from './mock-data';

// Phase 1 (NovaAir foundation): frontend reference/mock data must use the same
// fictional NovaAir identifiers as the normalized seed — no Lufthansa-style
// registrations, flight numbers, or loyalty identifiers.
describe('mock-data NovaAir identity (Phase 1)', () => {
  it('keeps exactly the 10 locked airports', () => {
    expect(AIRPORTS).toHaveLength(10);
  });

  it('keeps exactly 4 aircraft with NovaAir registrations and unchanged models/capacities', () => {
    expect(AIRCRAFT.map((a) => [a.registration, a.model, a.capacity])).toEqual([
      ['NV-320A', 'Airbus A320-200', 180],
      ['NV-321B', 'Airbus A321-200', 220],
      ['NV-748X', 'Boeing 747-8', 364],
      ['NV-359Y', 'Airbus A350-900', 319],
    ]);
  });

  it('keeps aircraft → seats relationships intact (full seat map per tail)', () => {
    for (const a of AIRCRAFT) {
      const seats = a.seats!;
      expect(seats).toHaveLength(a.capacity);
      expect(new Set(seats.map((s) => s.seatNumber)).size).toBe(a.capacity);
      expect(seats.every((s) => s.aircraftId === a.id)).toBe(true);
    }
  });

  it('uses only NovaAir-prefixed flight numbers', () => {
    expect(FLIGHTS.length).toBeGreaterThan(0);
    for (const f of FLIGHTS) {
      expect(f.flightNumber).toMatch(/^NV\d+$/);
    }
  });

  it('keeps flight → route and flight → aircraft relationships intact', () => {
    const routeIds = new Set(ROUTES.map((r) => r.id));
    const aircraftIds = new Set(AIRCRAFT.map((a) => a.id));
    for (const f of FLIGHTS) {
      expect(routeIds.has(f.routeId)).toBe(true);
      expect(aircraftIds.has(f.aircraftId)).toBe(true);
      expect(f.aircraft.id).toBe(f.aircraftId);
    }
  });

  it('uses a NovaAir loyalty member number', () => {
    expect(LOYALTY.memberNumber).toMatch(/^NV\d{8}$/);
  });

  it('contains no Lufthansa operational identifiers anywhere in mock data', () => {
    const all = JSON.stringify({ AIRCRAFT, AIRPORTS, BOOKINGS, FLIGHTS, LOYALTY, ROUTES });
    expect(all).not.toMatch(/D-AIRA|D-AIRB|D-ABYA|D-AIXA/);
    expect(all).not.toMatch(/\bLH\d/);
    expect(all).not.toMatch(/\bNA-\d{3}[A-Z]\b/);
    expect(all).not.toContain('Lufthansa');
  });
});
