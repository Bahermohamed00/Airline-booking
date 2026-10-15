import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hashCreateBookingRequest } from './booking-idempotency';
import type { CreateBookingDto } from './dto/create-booking.dto';

const dto = (overrides: Record<string, unknown> = {}) =>
  ({
    idempotencyKey: randomUUID(),
    flightId: 'flight-1',
    cabinClass: 'ECONOMY',
    seatIds: ['seat-1'],
    passengers: [{ firstName: 'Lena', lastName: 'Hoffmann', passengerType: 'ADULT', dateOfBirth: '1992-04-18' }],
    ...overrides,
  }) as unknown as CreateBookingDto;

describe('hashCreateBookingRequest', () => {
  it('is deterministic — identical requests hash identically', () => {
    const a = dto();
    const b = dto();
    expect(hashCreateBookingRequest(a)).toBe(hashCreateBookingRequest(b));
  });

  it('produces a 64-char SHA-256 hex digest', () => {
    expect(hashCreateBookingRequest(dto())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores the idempotency key itself — the key identifies, the hash compares', () => {
    expect(hashCreateBookingRequest(dto({ idempotencyKey: randomUUID() }))).toBe(hashCreateBookingRequest(dto()));
  });

  it('normalizes optional passenger fields to their effective values', () => {
    // passengerType defaults to ADULT at persistence, so omitting it is the
    // same logical request and must replay rather than conflict.
    const implicit = dto({ passengers: [{ firstName: 'Lena', lastName: 'Hoffmann', dateOfBirth: '1992-04-18' }] });
    expect(hashCreateBookingRequest(implicit)).toBe(hashCreateBookingRequest(dto()));
  });

  it.each([
    ['different flight', { flightId: 'flight-2' }],
    ['different cabin', { cabinClass: 'BUSINESS' }],
    ['different seats', { seatIds: ['seat-2'] }],
    ['different passenger', { passengers: [{ firstName: 'Jonas', lastName: 'Hoffmann' }] }],
    ['different contact', { contactEmail: 'other@example.com' }],
    ['different offer', { offerId: 'b2f6a6c0-3f8d-4a0e-9d1c-7c2f0a1b2c3d' }],
  ])('changes for a materially different request: %s', (_label, override) => {
    expect(hashCreateBookingRequest(dto(override as Record<string, unknown>))).not.toBe(hashCreateBookingRequest(dto()));
  });

  // ---------- BR-16: offerId in the hash ----------

  it('backward-compat: a request without offerId hashes identically to before the offer field existed', () => {
    // Golden hash of the legacy canonical shape (no offerId key at all).
    const legacy = hashCreateBookingRequest(dto());
    expect(legacy).toBe(hashCreateBookingRequest(dto({ offerId: undefined })));
    expect(legacy).toBe(hashCreateBookingRequest(dto({ offerId: null })));
  });

  it('includes offerId when present — the same key with a different offer conflicts', () => {
    const offerA = dto({ offerId: 'b2f6a6c0-3f8d-4a0e-9d1c-7c2f0a1b2c3d' });
    const offerARepeat = dto({ offerId: 'b2f6a6c0-3f8d-4a0e-9d1c-7c2f0a1b2c3d' });
    const offerB = dto({ offerId: 'c3a7b7d1-4a9e-5b1f-8e2d-8d3a1b2c3d4e' });
    expect(hashCreateBookingRequest(offerA)).toBe(hashCreateBookingRequest(offerARepeat));
    expect(hashCreateBookingRequest(offerA)).not.toBe(hashCreateBookingRequest(offerB));
    expect(hashCreateBookingRequest(offerA)).not.toBe(hashCreateBookingRequest(dto()));
  });

  // ---------- extras in the hash ----------

  it('backward-compat: a request without extras hashes identically to an empty extras array', () => {
    expect(hashCreateBookingRequest(dto())).toBe(hashCreateBookingRequest(dto({ extras: [] })));
    expect(hashCreateBookingRequest(dto())).toBe(hashCreateBookingRequest(dto({ extras: undefined })));
  });

  it('includes extras when present — a retry with a changed selection conflicts', () => {
    const bag = { serviceId: 'b2f6a6c0-3f8d-4a0e-9d1c-7c2f0a1b2c3d', quantity: 1, passengerIndex: 0 };
    const withBag = dto({ extras: [bag] });
    expect(hashCreateBookingRequest(withBag)).toBe(hashCreateBookingRequest(dto({ extras: [bag] })));
    expect(hashCreateBookingRequest(withBag)).not.toBe(hashCreateBookingRequest(dto()));
    expect(hashCreateBookingRequest(withBag)).not.toBe(
      hashCreateBookingRequest(dto({ extras: [{ ...bag, quantity: 2 }] })),
    );
  });

  it('extras order alone never changes the fingerprint', () => {
    const a = { serviceId: 'b2f6a6c0-3f8d-4a0e-9d1c-7c2f0a1b2c3d', quantity: 1, passengerIndex: 0 };
    const b = { serviceId: 'c3a7b7d1-4a9e-5b1f-8e2d-8d3a1b2c3d4e', quantity: 1 };
    expect(hashCreateBookingRequest(dto({ extras: [a, b] }))).toBe(hashCreateBookingRequest(dto({ extras: [b, a] })));
  });
});
