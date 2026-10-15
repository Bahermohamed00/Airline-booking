/**
 * Central catalog of audit event names written by the application.
 * Historical names are preserved exactly — existing audit rows must stay
 * readable, so this list may only grow.
 */
export const AUDIT_EVENTS = [
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'LOGIN_FAILED',
  'LOGOUT',
  'LOGOUT_ALL',
  'SESSION_REVOKED',
  'TOKEN_REUSE_DETECTED',
  'EMAIL_VERIFICATION_REQUESTED',
  'EMAIL_VERIFICATION_FAILED',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_FAILED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'PASSWORD_CHANGE_FAILED',
  'PROFILE_UPDATED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  // One row per throttled request (AUTH_RATE_LIMITED): deliberate for now —
  // correctness over volume. Aggregation/sampling is deferred (needs no schema
  // change, but is intentionally not implemented yet).
  'AUTH_RATE_LIMITED',
  'SUPER_ADMIN_INVARIANT_BLOCKED',
  // Booking domain (Phase 4).
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'SEAT_HELD',
  'SEAT_HOLD_EXPIRED',
  'SEAT_HOLD_RELEASED',
  // Customer cancellation-request workflow (staff-reviewed paid cancellations).
  'CANCELLATION_REQUESTED',
  'CANCELLATION_REQUEST_APPROVED',
  'CANCELLATION_REQUEST_REJECTED',
  // Offer catalog (Phase 5).
  'OFFER_CREATED',
  'OFFER_UPDATED',
  'OFFER_DELETED',
  'OFFER_HARD_DELETED',
  // Extras catalog (staff-managed, lifecycle-deactivated).
  'EXTRA_SERVICE_CREATED',
  'EXTRA_SERVICE_UPDATED',
  'EXTRA_SERVICE_DEACTIVATED',
  // Payments & paid booking lifecycle (Phase 6F).
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'PAYMENT_INTENT_CREATED',
  'PAYMENT_CANCELED',
  'BOOKING_CONFIRMED',
  'SEAT_HOLD_CONVERTED',
  'REFUND_COMPLETED',
  'REFUND_RECOVERY_REQUESTED',
  'REFUND_ORPHAN_DISCOVERED',
  'REFUND_ORPHAN_RESOLVED',
  'BR14_PAYMENT_EXCEPTION',
  // Platform configuration.
  'SETTING_UPDATED',
  // Baggage operations.
  'BAGGAGE_EVENT_RECORDED',
  // Check-in operations.
  'CHECK_IN_COMPLETED',
  'BOARDING_PASSES_INVALIDATED',
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];
