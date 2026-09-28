import { describe, it, expect } from 'vitest';
import { BOOKING_REFERENCE_PATTERN, generateBookingReference } from './booking-reference';

describe('generateBookingReference', () => {
  it('matches the unified NovaAir format (NV + 6 unambiguous chars)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateBookingReference()).toMatch(BOOKING_REFERENCE_PATTERN);
    }
  });

  it('never contains ambiguous characters (I, O, 0, 1) or Lufthansa identifiers', () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateBookingReference();
      expect(ref).not.toMatch(/[IO01]/);
      expect(ref.startsWith('LH')).toBe(false);
    }
  });

  it('produces distinct references in practice', () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateBookingReference()));
    expect(refs.size).toBe(500);
  });
});
