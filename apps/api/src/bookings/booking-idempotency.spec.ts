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
  ])('changes for a materially different request: %s', (_label, override) => {
    expect(hashCreateBookingRequest(dto(override as Record<string, unknown>))).not.toBe(hashCreateBookingRequest(dto()));
  });
});
