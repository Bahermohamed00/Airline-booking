import { randomInt } from 'node:crypto';

/**
 * Unified NovaAir booking reference: "NV" + 6 characters from an unambiguous
 * alphabet (no I/O/0/1). Generated server-side only, backed by the existing
 * bookings.booking_reference unique constraint.
 */
export const BOOKING_REFERENCE_PATTERN = /^NV[A-Z0-9]{6}$/;

const PREFIX = 'NV';
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateBookingReference(): string {
  let reference = PREFIX;
  for (let i = 0; i < 6; i++) {
    reference += CHARSET[randomInt(CHARSET.length)];
  }
  return reference;
}
