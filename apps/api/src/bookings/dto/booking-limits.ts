/**
 * Maximum passengers (and therefore seats) per booking. Matches the standard
 * airline single-PNR limit; larger groups must book in multiple bookings.
 * Shared by booking DTOs and extras selection DTOs without an import cycle.
 */
export const MAX_BOOKING_PASSENGERS = 9;
