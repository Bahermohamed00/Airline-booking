import { createHash } from 'node:crypto';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

/**
 * Stable fingerprint of the logical booking request behind an idempotency key.
 * Key order is fixed so identical retries hash identically. Optional fields
 * are normalized to their effective value (e.g. passengerType defaults to
 * ADULT at persistence), so cosmetically different but logically identical
 * payloads still replay instead of conflicting.
 */
export function hashCreateBookingRequest(dto: CreateBookingDto): string {
  const canonical = {
    flightId: dto.flightId,
    cabinClass: dto.cabinClass,
    seatIds: dto.seatIds,
    passengers: dto.passengers.map((p) => ({
      passengerType: p.passengerType ?? 'ADULT',
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth ?? null,
      nationality: p.nationality ?? null,
      passportNumber: p.passportNumber ?? null,
    })),
    contactEmail: dto.contactEmail ?? null,
    contactPhone: dto.contactPhone ?? null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
