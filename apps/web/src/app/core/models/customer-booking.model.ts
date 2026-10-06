import type {
  BookingStatus,
  CabinClass,
  FlightStatus,
  PassengerType,
  SeatHoldStatus,
} from './domain.model';

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
}
