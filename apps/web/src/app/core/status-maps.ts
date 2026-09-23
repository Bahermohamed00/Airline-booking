// Centralized status → presentation mapping. Single source of truth —
// never hardcode status colors or labels in templates.

import type {
  FlightStatus, FlightScheduleStatus, BookingStatus, PaymentStatus, RefundStatus,
  BaggageStatus, SeatHoldStatus, NotificationStatus, LoyaltyTier, UserStatus, CheckInStatus,
} from './models/domain.model';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

export const FLIGHT_STATUS_MAP: Record<FlightStatus, StatusPresentation> = {
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'info' },
  DELAYED: { label: 'Delayed', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  COMPLETED: { label: 'Completed', tone: 'success' },
};

export const SCHEDULE_STATUS_MAP: Record<FlightScheduleStatus, StatusPresentation> = {
  ONTIME: { label: 'On time', tone: 'success' },
  DELAYED: { label: 'Delayed', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export const BOOKING_STATUS_MAP: Record<BookingStatus, StatusPresentation> = {
  PENDING: { label: 'Pending payment', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  CHECKED_IN: { label: 'Checked in', tone: 'info' },
  BOARDED: { label: 'Boarded', tone: 'info' },
  NO_SHOW: { label: 'No show', tone: 'neutral' },
};

export const PAYMENT_STATUS_MAP: Record<PaymentStatus, StatusPresentation> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  AUTHORIZED: { label: 'Authorized', tone: 'info' },
  SUCCESS: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', tone: 'warning' },
};

export const REFUND_STATUS_MAP: Record<RefundStatus, StatusPresentation> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'info' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  PROCESSED: { label: 'Processed', tone: 'success' },
};

export const BAGGAGE_STATUS_MAP: Record<BaggageStatus, StatusPresentation> = {
  CHECKED_IN: { label: 'Checked in', tone: 'info' },
  LOADED: { label: 'Loaded', tone: 'info' },
  IN_TRANSIT: { label: 'In transit', tone: 'info' },
  ARRIVED: { label: 'Arrived', tone: 'success' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  LOST: { label: 'Reported lost', tone: 'danger' },
  DELAYED: { label: 'Delayed', tone: 'warning' },
};

export const SEAT_HOLD_STATUS_MAP: Record<SeatHoldStatus, StatusPresentation> = {
  ACTIVE: { label: 'Held', tone: 'warning' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
  CONVERTED: { label: 'Booked', tone: 'success' },
  RELEASED: { label: 'Released', tone: 'neutral' },
};

export const NOTIFICATION_STATUS_MAP: Record<NotificationStatus, StatusPresentation> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  SENT: { label: 'Sent', tone: 'info' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  RETRYING: { label: 'Retrying', tone: 'warning' },
};

export const USER_STATUS_MAP: Record<UserStatus, StatusPresentation> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'warning' },
  DEACTIVATED: { label: 'Deactivated', tone: 'neutral' },
  PENDING_VERIFICATION: { label: 'Pending verification', tone: 'info' },
};

export const CHECKIN_STATUS_MAP: Record<CheckInStatus, StatusPresentation> = {
  COMPLETED: { label: 'Checked in', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  MEMBER: 'Member',
  SILVER: 'Silver',
  GOLD: 'Gold',
  HON_CIRCLE: 'Hon Circle',
};

export function statusLabel(
  map: Record<string, StatusPresentation>,
  key: string,
): StatusPresentation {
  return map[key] ?? { label: key, tone: 'neutral' };
}
