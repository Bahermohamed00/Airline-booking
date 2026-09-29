// Domain models for the web app. Most are Prisma/API mirrors and live in
// @airline/shared (packages/shared) — this file is a barrel so existing
// imports keep working. Types that intentionally diverge from Prisma are
// defined locally below (see the phase-2 monorepo audit).

export {
  UserStatus,
  CabinClass,
  AirportStatus,
  RouteStatus,
  AircraftStatus,
  FlightStatus,
  FlightScheduleStatus,
  SeatHoldStatus,
  BookingStatus,
  PassengerType,
  PaymentStatus,
  RefundStatus,
  BaggageType,
  BaggageStatus,
  CheckInStatus,
  NotificationChannel,
  NotificationStatus,
  LoyaltyTier,
  LoyaltyTransactionType,
} from '@airline/shared';

export type {
  User,
  Role,
  SessionInfo,
  Passenger,
  Airport,
  Route,
  Aircraft,
  Seat,
  Flight,
  FlightSegment,
  FareRule,
  Fare,
  FlightOffer,
  SeatHold,
  BookingPassenger,
  BookingSeat,
  Refund,
  Baggage,
  BaggageEvent,
  CheckIn,
  BoardingPass,
  NotificationItem,
  NotificationTemplate,
  LoyaltyAccount,
  LoyaltyTransaction,
  SystemSetting,
} from '@airline/shared';

import type {
  BookingStatus,
  Flight,
  BookingPassenger,
  BookingSeat,
  PaymentStatus,
  Refund,
} from '@airline/shared';

// NOT mirrored to Prisma: mock-era shape (see monorepo phase 2 audit).
// Prisma Booking has no direct flight relation (it chains through
// passengers → seats → segments); flightId/flight are API conveniences.
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

// NOT mirrored to Prisma: mock-era shape (see monorepo phase 2 audit).
// Kept web-only because it references the web-only ExtraService.
export interface BookingExtra {
  id: string;
  extraServiceId: string;
  extraService: ExtraService;
  quantity: number;
  price: number;
}

// NOT mirrored to Prisma: mock-era shape (see monorepo phase 2 audit).
// Prisma ExtraService has a status column and no category; the web shape
// inverts that.
export interface ExtraService {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  category: 'BAGGAGE' | 'MEAL' | 'LOUNGE' | 'PRIORITY' | 'INSURANCE';
}

// NOT mirrored to Prisma: mock-era shape (see monorepo phase 2 audit).
// Prisma Payment has no failureReason column.
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

// NOT mirrored to Prisma: mock-era shape (see monorepo phase 2 audit).
// actorName is enriched by the API, not a Prisma column.
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
