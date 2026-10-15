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
  const canonical: Record<string, unknown> = {
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
  // BR-16: the offer is part of the logical request, but the key is added
  // only when present so legacy no-offer requests keep their exact hashes.
  if (dto.offerId) {
    canonical['offerId'] = dto.offerId;
  }
  // Extras are part of the logical request too — a retry that changes the
  // extras selection must conflict, not silently replay the old booking.
  // Sorted so line order alone never changes the fingerprint.
  if (dto.extras && dto.extras.length > 0) {
    canonical['extras'] = dto.extras
      .map((e) => ({ serviceId: e.serviceId, quantity: e.quantity, passengerIndex: e.passengerIndex ?? null }))
      .sort((a, b) => a.serviceId.localeCompare(b.serviceId) || (a.passengerIndex ?? -1) - (b.passengerIndex ?? -1));
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
