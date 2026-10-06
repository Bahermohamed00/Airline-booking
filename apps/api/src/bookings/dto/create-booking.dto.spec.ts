import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBookingDto, MAX_BOOKING_PASSENGERS } from './create-booking.dto';

const validBody = () => ({
  idempotencyKey: randomUUID(),
  flightId: randomUUID(),
  cabinClass: 'ECONOMY',
  seatIds: [randomUUID()],
  passengers: [{ firstName: 'Lena', lastName: 'Hoffmann', passengerType: 'ADULT', dateOfBirth: '1992-04-18' }],
});

const errorsFor = async (body: unknown) => validate(plainToInstance(CreateBookingDto, body));

describe('CreateBookingDto', () => {
  it('accepts a valid minimal request', async () => {
    expect(await errorsFor(validBody())).toHaveLength(0);
  });

  it('accepts exactly MAX_BOOKING_PASSENGERS passengers and seats', async () => {
    const body = {
      ...validBody(),
      seatIds: Array.from({ length: MAX_BOOKING_PASSENGERS }, () => randomUUID()),
      passengers: Array.from({ length: MAX_BOOKING_PASSENGERS }, (_, i) => ({ firstName: `P${i}`, lastName: 'Tester' })),
    };
    expect(await errorsFor(body)).toHaveLength(0);
  });

  it('requires the idempotency key', async () => {
    const { idempotencyKey: _omit, ...body } = validBody();
    const errors = await errorsFor(body);
    expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['blank string', '   '],
    ['not a UUID', 'booking-attempt-1'],
    ['oversized key', 'a'.repeat(300)],
    ['UUID v1 (not v4)', '6fa459ea-ee8a-11ca-9c2a-0800200c9a66'],
  ])('rejects a malformed idempotency key: %s', async (_label, key) => {
    const errors = await errorsFor({ ...validBody(), idempotencyKey: key });
    expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
  });

  it('rejects an oversized passengers array before any database work', async () => {
    const body = {
      ...validBody(),
      passengers: Array.from({ length: MAX_BOOKING_PASSENGERS + 1 }, (_, i) => ({ firstName: `P${i}`, lastName: 'Tester' })),
      seatIds: Array.from({ length: MAX_BOOKING_PASSENGERS + 1 }, () => randomUUID()),
    };
    const errors = await errorsFor(body);
    expect(errors.some((e) => e.property === 'passengers')).toBe(true);
  });

  it('rejects an oversized seatIds array before any database work', async () => {
    const body = {
      ...validBody(),
      seatIds: Array.from({ length: MAX_BOOKING_PASSENGERS + 1 }, () => randomUUID()),
    };
    const errors = await errorsFor(body);
    expect(errors.some((e) => e.property === 'seatIds')).toBe(true);
  });
});
