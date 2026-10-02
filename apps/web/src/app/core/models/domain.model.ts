// Domain models mirroring the Prisma schema (snake_case DB fields are
// presented here in camelCase as exposed through the API layer).

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION';
export type CabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
export type AirportStatus = 'ACTIVE' | 'INACTIVE';
export type RouteStatus = 'ACTIVE' | 'INACTIVE';
export type AircraftStatus = 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
export type FlightStatus = 'SCHEDULED' | 'ACTIVE' | 'DELAYED' | 'CANCELLED' | 'COMPLETED';
export type SeatHoldStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'RELEASED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' | 'BOARDED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
export type PassengerType = 'ADULT' | 'CHILD' | 'INFANT';
export type BaggageType = 'CARRY_ON' | 'CHECKED' | 'SPECIAL';
export type BaggageStatus = 'CHECKED_IN' | 'LOADED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'LOST' | 'DELAYED';
export type CheckInStatus = 'COMPLETED' | 'CANCELLED';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';
export type LoyaltyTier = 'MEMBER' | 'SILVER' | 'GOLD' | 'HON_CIRCLE';
export type LoyaltyTransactionType = 'EARN' | 'BURN' | 'ADJUSTMENT' | 'EXPIRY';
export type FlightScheduleStatus = 'ONTIME' | 'DELAYED' | 'CANCELLED';

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
  /** Configured seat count from the /aircraft view; absent for aircraft nested in flight views. */
  seatCount?: number;
  /** Only present when seats were explicitly loaded (mock data or GET /aircraft/:id/seats). */
  seats?: Seat[];
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
  /** Origin-local operating date (yyyy-mm-dd) when provided by the flights API. */
  operatingDate?: string | null;
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
  /** Rich rule set when the API provides one; null = rules unknown (never fabricated). */
  rules: FareRule | null;
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

export interface BookingExtra {
  id: string;
  extraServiceId: string;
  extraService: ExtraService;
  quantity: number;
  price: number;
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  bookedAt: string;
  contactEmail: string;
  contactPhone?: string | null;
  flightId: string;
  flight: Flight;
  passengers: BookingPassenger[];
  seats: BookingSeat[];
  extras: BookingExtra[];
  payments: Payment[];
  refunds: Refund[];
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerReference?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
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

export interface ExtraService {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  category: 'BAGGAGE' | 'MEAL' | 'LOUNGE' | 'PRIORITY' | 'INSURANCE';
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

export interface AuditLog {
  id: string;
  actorId?: string | null;
  actorType: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
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
