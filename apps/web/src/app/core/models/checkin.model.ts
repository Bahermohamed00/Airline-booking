import type { BookingStatus, CheckInStatus, PassengerType } from './domain.model';

// Check-in API contract (apps/api checkin module). All endpoints are
// JWT-required and ownership-enforced server-side; errors carry
// `err.error.code` / `err.error.message` (Nest error body).

export interface CheckInRoute {
  originIata: string;
  destinationIata: string;
  originCity: string;
  destinationCity: string;
}

export interface CheckInFlight {
  id: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  route: CheckInRoute;
}

export interface CheckInSegment {
  id: string;
  segmentNumber: number;
}

export interface CheckInPassenger {
  bookingPassengerId: string;
  firstName: string;
  lastName: string;
  passengerType: PassengerType;
  /** Null when no seat is assigned yet. */
  seatNumber: string | null;
  checkedIn: boolean;
}

/** Booking shape returned by GET /api/checkin/bookings (reference or email lookup). */
export interface CheckInBooking {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  contactEmail: string;
  flight: CheckInFlight;
  segments: CheckInSegment[];
  passengers: CheckInPassenger[];
}

export interface CheckInBoardingPass {
  id: string;
  boardingGroup: string;
  seatNumber: string;
  /** Null until the airport assigns a gate. */
  gate: string | null;
  issuedAt: string;
}

export interface CheckInRecord {
  id: string;
  bookingPassengerId: string;
  flightSegmentId: string;
  checkInTime: string;
  status: CheckInStatus;
  boardingPass: CheckInBoardingPass;
}

/** POST /api/checkin result — one record per segment checked in. */
export interface CheckInResponse {
  checkIns: CheckInRecord[];
  bookingStatus: BookingStatus;
  /** Tags issued for bags declared at check-in (empty when none declared). */
  baggage: IssuedBaggage[];
}

/** A bag tag issued at check-in; trackable via the public tracking endpoint. */
export interface IssuedBaggage {
  tagNumber: string;
  status: string;
}

export interface BoardingPassItem {
  id: string;
  bookingPassengerId: string;
  flightSegmentId: string;
  checkInTime: string;
  status: CheckInStatus;
  boardingPass: CheckInBoardingPass;
  passenger: { firstName: string; lastName: string };
  /** Bag tags issued for this passenger (empty when no checked bags). */
  baggage: IssuedBaggage[];
}

/** GET /api/checkin/boarding-pass?bookingId=… — completed check-ins only. */
export interface BoardingPassResponse {
  /** Booking uuid. */
  id: string;
  bookingReference: string;
  status: BookingStatus;
  /** Same nested shape as the lookup; null when the flight was removed. */
  flight: CheckInFlight | null;
  checkIns: BoardingPassItem[];
}

/** Server-side 409 codes from POST /api/checkin. */
export type CheckInErrorCode =
  | 'CHECKIN_NOT_ELIGIBLE'
  | 'CHECKIN_NOT_OPEN'
  | 'CHECKIN_CLOSED'
  | 'ALREADY_CHECKED_IN';
