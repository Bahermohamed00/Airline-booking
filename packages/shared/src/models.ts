// API/backend mirror models. These describe the shapes the NestJS API exposes
// (camelCase, Decimal prices already converted to numbers, dates as ISO
// strings) and the Angular frontend consumes. Enum fields use the Prisma
// mirrors from ./enums. Interfaces that intentionally diverge from Prisma
// (Booking, ExtraService, Payment, AuditLog) stay in the web app.
import type {
  AircraftStatus,
  AirportStatus,
  BaggageStatus,
  BaggageType,
  CabinClass,
  CheckInStatus,
  FlightScheduleStatus,
  FlightStatus,
  LoyaltyTier,
  LoyaltyTransactionType,
  NotificationChannel,
  NotificationStatus,
  PassengerType,
  RefundStatus,
  RouteStatus,
  SeatHoldStatus,
  UserStatus,
} from './enums';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  status: UserStatus;
  roles: string[];
  permissions: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
  userCount?: number;
}

/** Device/session metadata as exposed by GET /api/auth/sessions. Never contains tokens. */
export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO
  lastUsedAt: string; // ISO
  current: boolean;
}

export interface Passenger {
  id: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  nationality?: string | null;
}

export interface Airport {
  id: string;
  iataCode: string;
  icaoCode?: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
  status: AirportStatus;
}

export interface Route {
  id: string;
  originAirportId: string;
  destinationAirportId: string;
  origin: Airport;
  destination: Airport;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  status: RouteStatus;
}

export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  capacity: number;
  status: AircraftStatus;
  seats: Seat[];
}

export interface Seat {
  id: string;
  aircraftId: string;
  seatNumber: string;
  cabinClass: CabinClass;
  seatRow?: number | null;
  seatColumn?: string | null;
  isExitRow: boolean;
  features?: Record<string, unknown> | null;
}

export interface Flight {
  id: string;
  flightNumber: string;
  routeId: string;
  route: Route;
  aircraftId: string;
  aircraft: Aircraft;
  departureTime: string; // ISO
  arrivalTime: string; // ISO
  status: FlightStatus;
  scheduleStatus: FlightScheduleStatus;
  segments: FlightSegment[];
  fares: Fare[];
}

export interface FlightSegment {
  id: string;
  flightId: string;
  segmentNumber: number;
  originAirportId: string;
  origin: Airport;
  destinationAirportId: string;
  destination: Airport;
  departureTime: string;
  arrivalTime: string;
}

export interface FareRule {
  refundable: boolean;
  changeAllowed: boolean;
  changeFee: number;
  cancellationFeePercent: number;
  checkedBaggagePieces: number;
  checkedBaggageWeightKg: number;
  carryOnPieces: number;
  seatSelectionFee: number;
  priorityBoarding: boolean;
  loungeAccess: boolean;
  description: string;
}

export interface Fare {
  id: string;
  flightId: string;
  cabinClass: CabinClass;
  basePrice: number;
  taxAmount: number;
  feeAmount: number;
  currency: string;
  availableCount: number;
  rules: FareRule;
}

export interface FlightOffer {
  id: string;
  title: string;
  description: string | null;
  cabinClass: CabinClass;
  discountPercentage: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  flight: {
    id: string;
    flightNumber: string;
    departureTime: string; // ISO
    arrivalTime: string; // ISO
    origin: Pick<Airport, 'iataCode' | 'name' | 'city' | 'country'>;
    destination: Pick<Airport, 'iataCode' | 'name' | 'city' | 'country'>;
  };
  fare: {
    id: string;
    cabinClass: CabinClass;
    currency: string;
    originalPrice: number;
    discountedPrice: number;
    availableCount: number;
    baggage: {
      checkedBaggagePieces: number;
      checkedBaggageWeightKg: number;
      carryOnPieces: number;
    };
  };
}

export interface SeatHold {
  id: string;
  flightId: string;
  seatId: string;
  seat: Seat;
  status: SeatHoldStatus;
  expiresAt: string; // ISO
  createdAt: string;
}

export interface BookingPassenger {
  id: string;
  passengerId: string;
  passenger: Passenger;
  passengerType: PassengerType;
}

export interface BookingSeat {
  id: string;
  bookingPassengerId: string;
  flightSegmentId: string;
  seatId: string;
  seatNumber: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

export interface Baggage {
  id: string;
  bookingPassengerId: string;
  type: BaggageType;
  weightKg?: number | null;
  pieces: number;
  tagNumber?: string | null;
  status: BaggageStatus;
  events: BaggageEvent[];
}

export interface BaggageEvent {
  id: string;
  baggageId: string;
  eventType: string;
  location?: string | null;
  occurredAt: string;
}

export interface CheckIn {
  id: string;
  bookingPassengerId: string;
  flightSegmentId: string;
  checkInTime: string;
  status: CheckInStatus;
  boardingPass?: BoardingPass | null;
}

export interface BoardingPass {
  id: string;
  checkInId: string;
  boardingGroup: string;
  seatNumber: string;
  gate?: string | null;
  issuedAt: string;
}

export interface NotificationItem {
  id: string;
  userId?: string | null;
  bookingId?: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject?: string | null;
  content: string;
  sentAt?: string | null;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  subject?: string | null;
  body: string;
  channel: NotificationChannel;
}

export interface LoyaltyAccount {
  id: string;
  userId: string;
  memberNumber: string;
  tier: LoyaltyTier;
  balance: number;
  transactions: LoyaltyTransaction[];
}

export interface LoyaltyTransaction {
  id: string;
  loyaltyAccountId: string;
  bookingId?: string | null;
  amount: number;
  type: LoyaltyTransactionType;
  description?: string | null;
  createdAt: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  isPublic: boolean;
  description?: string | null;
}
