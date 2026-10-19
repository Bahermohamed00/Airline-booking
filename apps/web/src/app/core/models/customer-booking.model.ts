import type {
  BookingStatus,
  CabinClass,
  FlightStatus,
  PassengerType,
  SeatHoldStatus,
} from './domain.model';
import type { CustomerBookingExtra, ExtraQuoteLine, ExtraSelectionPayload } from './extras.model';

// Customer booking API contract (apps/api bookings module). Payload mirrors
// CreateBookingDto exactly; the server owns userId, reference, status, totals.

export interface BookingPassengerPayload {
  passengerType?: PassengerType;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
}

export interface CreateBookingPayload {
  idempotencyKey: string;
  flightId: string;
  cabinClass: CabinClass;
  seatIds: string[];
  passengers: BookingPassengerPayload[];
  contactEmail?: string;
  contactPhone?: string;
  /** BR-16: bookable offer to apply; eligibility is enforced server-side. */
  offerId?: string;
  /** Selected extras (ids/quantities/passenger indexes only — no prices). */
  extras?: ExtraSelectionPayload[];
}

/** Immutable snapshot of the offer applied to a booking (BR-16). */
export interface BookingOfferSnapshot {
  id: string;
  title: string;
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number;
  discountAmountPerPassenger: number;
  currency: string;
}

export interface PricePreviewRequest {
  flightId: string;
  cabinClass: CabinClass;
  passengerCount: number;
  offerId?: string;
  extras?: ExtraSelectionPayload[];
}

export interface PricePreviewPerPassenger {
  basePrice: number;
  discountAmount: number;
  taxAmount: number;
  feeAmount: number;
  total: number;
}

/** Server-calculated price preview (POST /api/bookings/price-preview). */
export interface PricePreviewResponse {
  currency: string;
  perPassenger: PricePreviewPerPassenger;
  passengerCount: number;
  totalAmount: number;
  offer: BookingOfferSnapshot | null;
  /** Priced extras lines (empty when none selected); included in totalAmount. */
  extras: { total: number; lines: ExtraQuoteLine[] };
}

export interface CustomerBookingFlight {
  id: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  status: FlightStatus;
  origin: string;
  destination: string;
}

export interface CustomerBookingPassenger {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passengerType: PassengerType;
}

export interface CustomerBookingSeat {
  seatId: string;
  seatNumber: string;
  holdStatus: SeatHoldStatus;
  holdExpiresAt: string;
}

/** Server-side filters for GET /api/admin/bookings (all optional, combined). */
export interface AdminBookingQuery {
  reference?: string;
  status?: BookingStatus;
  email?: string;
}

export type CancellationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Cancellation request attached to the booking view (GET /api/bookings/:id).
 * The booking itself keeps its own status — a PENDING request never means the
 * booking is cancelled.
 */
export interface BookingCancellationRequest {
  id: string;
  status: CancellationRequestStatus;
  requestedAt: string;
  rejectionReason?: string | null;
}

/** Response of POST /api/bookings/:id/cancellation-request (201). */
export interface CancellationRequest {
  id: string;
  bookingId: string;
  status: 'PENDING';
  reason: string | null;
  requestedAt: string;
}

/** Flat owner-scoped booking view returned by the bookings API. */
export interface CustomerBooking {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  contactEmail: string;
  contactPhone: string | null;
  cabinClass: CabinClass | null;
  perPassengerTotal: number | null;
  bookedAt: string;
  flight: CustomerBookingFlight | null;
  passengers: CustomerBookingPassenger[];
  seats: CustomerBookingSeat[];
  /** BR-16: immutable snapshot of the applied offer; null when none was used. */
  offer?: BookingOfferSnapshot | null;
  /** BR-16: per-passenger discount actually applied; null when no offer. */
  perPassengerDiscountAmount?: number | null;
  /** Cancellation review state; null/absent when no request was ever made. */
  cancellationRequest?: BookingCancellationRequest | null;
  /** Purchased extras with immutable price snapshots (empty when none). */
  extras?: CustomerBookingExtra[];
}

/**
 * Server-calculated cancellation preview (GET /api/bookings/:id/cancellation-preview).
 * All eligibility and money values are computed by the backend from the
 * centralized cancellation policy and the persisted paid payment — the client
 * only renders them. Informational only: the final cancellation recalculates.
 */
export interface CancellationPreview {
  allowed: boolean;
  /** Policy decision code (e.g. REFUND_80_PERCENT, NON_REFUNDABLE_FARE, AFTER_DEPARTURE). */
  reason: string;
  refundPercentage: number;
  refundAmount: number;
  paidAmount: number;
  retainedAmount: number;
  currency: string;
  departureTime: string;
  hoursUntilDeparture: number;
}
