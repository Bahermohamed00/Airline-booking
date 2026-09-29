// Mirror of the Prisma schema enums (prisma/schema.prisma). Prisma remains the
// source of truth; apps/api/src/common/shared-enums.spec.ts asserts parity in
// BOTH directions (values per enum, and the set of enum names).
//
// Pattern: const object + derived union type instead of `enum`, so plain string
// literals stay assignable (Angular code assigns e.g. 'ECONOMY' directly).

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DEACTIVATED: 'DEACTIVATED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const AirportStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type AirportStatus = (typeof AirportStatus)[keyof typeof AirportStatus];

export const RouteStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type RouteStatus = (typeof RouteStatus)[keyof typeof RouteStatus];

export const AircraftStatus = {
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
} as const;
export type AircraftStatus = (typeof AircraftStatus)[keyof typeof AircraftStatus];

export const CabinClass = {
  ECONOMY: 'ECONOMY',
  PREMIUM_ECONOMY: 'PREMIUM_ECONOMY',
  BUSINESS: 'BUSINESS',
  FIRST: 'FIRST',
} as const;
export type CabinClass = (typeof CabinClass)[keyof typeof CabinClass];

export const SeatHoldStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CONVERTED: 'CONVERTED',
  RELEASED: 'RELEASED',
} as const;
export type SeatHoldStatus = (typeof SeatHoldStatus)[keyof typeof SeatHoldStatus];

export const FlightStatus = {
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  DELAYED: 'DELAYED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type FlightStatus = (typeof FlightStatus)[keyof typeof FlightStatus];

export const FlightScheduleStatus = {
  ONTIME: 'ONTIME',
  DELAYED: 'DELAYED',
  CANCELLED: 'CANCELLED',
} as const;
export type FlightScheduleStatus = (typeof FlightScheduleStatus)[keyof typeof FlightScheduleStatus];

export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  CHECKED_IN: 'CHECKED_IN',
  BOARDED: 'BOARDED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PassengerType = {
  ADULT: 'ADULT',
  CHILD: 'CHILD',
  INFANT: 'INFANT',
} as const;
export type PassengerType = (typeof PassengerType)[keyof typeof PassengerType];

export const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const RefundStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PROCESSED: 'PROCESSED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const BaggageType = {
  CARRY_ON: 'CARRY_ON',
  CHECKED: 'CHECKED',
  SPECIAL: 'SPECIAL',
} as const;
export type BaggageType = (typeof BaggageType)[keyof typeof BaggageType];

export const BaggageStatus = {
  CHECKED_IN: 'CHECKED_IN',
  LOADED: 'LOADED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  DELIVERED: 'DELIVERED',
  LOST: 'LOST',
  DELAYED: 'DELAYED',
} as const;
export type BaggageStatus = (typeof BaggageStatus)[keyof typeof BaggageStatus];

export const CheckInStatus = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type CheckInStatus = (typeof CheckInStatus)[keyof typeof CheckInStatus];

export const ExtraServiceStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type ExtraServiceStatus = (typeof ExtraServiceStatus)[keyof typeof ExtraServiceStatus];

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const LoyaltyTier = {
  MEMBER: 'MEMBER',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  HON_CIRCLE: 'HON_CIRCLE',
} as const;
export type LoyaltyTier = (typeof LoyaltyTier)[keyof typeof LoyaltyTier];

export const LoyaltyTransactionType = {
  EARN: 'EARN',
  BURN: 'BURN',
  ADJUSTMENT: 'ADJUSTMENT',
  EXPIRY: 'EXPIRY',
} as const;
export type LoyaltyTransactionType = (typeof LoyaltyTransactionType)[keyof typeof LoyaltyTransactionType];

export const OfferStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];
