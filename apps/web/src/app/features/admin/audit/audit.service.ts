import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';

export interface AuditLogItem {
  id: string;
  event: string;
  actorType: string;
  actorId: string | null;
  /** Display identity of the linked user account, when one exists (null for Guest/System/deleted users). */
  actorName: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO
  metadata: Record<string, unknown>;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  event?: string;
  actorId?: string;
  targetId?: string;
  actorType?: string;
  targetType?: string;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: 'createdAt' | 'event';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Mirror of the backend catalog (apps/api/src/audit/audit-events.ts) for the
 * filter dropdown. OWNERSHIP RULE: the backend catalog is the canonical source
 * — whenever an event is added there, update this mirror in the same PR.
 */
export const AUDIT_EVENTS = [
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'LOGIN_FAILED',
  'LOGOUT',
  'LOGOUT_ALL',
  'SESSION_REVOKED',
  'TOKEN_REUSE_DETECTED',
  'TOKEN_REFRESHED',
  'EMAIL_VERIFICATION_REQUESTED',
  'EMAIL_VERIFICATION_FAILED',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_FAILED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'PASSWORD_CHANGE_FAILED',
  'PROFILE_UPDATED',
  'MFA_SETUP_INITIATED',
  'MFA_CHALLENGE_SENT',
  'MFA_VERIFICATION_FAILED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'AUTH_RATE_LIMITED',
  'SUPER_ADMIN_INVARIANT_BLOCKED',
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'SEAT_HELD',
  'SEAT_HOLD_EXPIRED',
  'SEAT_HOLD_RELEASED',
  'CANCELLATION_REQUESTED',
  'CANCELLATION_REQUEST_APPROVED',
  'CANCELLATION_REQUEST_REJECTED',
  'OFFER_CREATED',
  'OFFER_UPDATED',
  'OFFER_DELETED',
  'OFFER_HARD_DELETED',
  'EXTRA_SERVICE_CREATED',
  'EXTRA_SERVICE_UPDATED',
  'EXTRA_SERVICE_DEACTIVATED',
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
  'SETTING_UPDATED',
  'BAGGAGE_EVENT_RECORDED',
  'CHECK_IN_COMPLETED',
  'BOARDING_PASSES_INVALIDATED',
  'AIRPORT_CREATED',
  'AIRPORT_UPDATED',
  'AIRCRAFT_CREATED',
  'AIRCRAFT_UPDATED',
  'FLIGHTS_GENERATED',
  'FLIGHT_STATUS_CHANGED',
  'FLIGHT_CREATED',
  'FLIGHT_UPDATED',
  'ROUTE_CREATED',
  'ROUTE_UPDATED',
  'SCHEDULE_RULE_CREATED',
  'SCHEDULE_RULE_UPDATED',
  'TICKET_CREATED',
  'TICKET_CLAIMED',
  'TICKET_RESOLVED',
  'TICKET_CLOSED',
  'TICKET_REOPENED',
  'TICKET_MESSAGE_SENT',
] as const;

/**
 * Display labels for the audit event catalog. Raw event names stay the API
 * contract (filter values, requests); this map is presentation-only. Unknown
 * future events fall back to the raw name.
 */
export const AUDIT_EVENT_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Account registered',
  USER_LOGGED_IN: 'Signed in',
  LOGIN_FAILED: 'Sign-in failed',
  LOGOUT: 'Signed out',
  LOGOUT_ALL: 'Signed out on all devices',
  SESSION_REVOKED: 'Session revoked',
  TOKEN_REUSE_DETECTED: 'Refresh-token reuse detected',
  TOKEN_REFRESHED: 'Session token refreshed',
  EMAIL_VERIFICATION_REQUESTED: 'Email verification requested',
  EMAIL_VERIFICATION_FAILED: 'Email verification failed',
  EMAIL_VERIFIED: 'Email verified',
  PASSWORD_RESET_REQUESTED: 'Password reset requested',
  PASSWORD_RESET_FAILED: 'Password reset failed',
  PASSWORD_RESET_COMPLETED: 'Password reset completed',
  PASSWORD_CHANGED: 'Password changed',
  PASSWORD_CHANGE_FAILED: 'Password change failed',
  PROFILE_UPDATED: 'Profile updated',
  MFA_SETUP_INITIATED: 'MFA setup started',
  MFA_CHALLENGE_SENT: 'MFA security code sent',
  MFA_VERIFICATION_FAILED: 'MFA verification failed',
  MFA_ENABLED: 'MFA enabled',
  MFA_DISABLED: 'MFA disabled',
  USER_CREATED: 'User account created',
  USER_UPDATED: 'User account updated',
  USER_DEACTIVATED: 'User account deactivated',
  AUTH_RATE_LIMITED: 'Rate limit triggered',
  SUPER_ADMIN_INVARIANT_BLOCKED: 'Super Admin removal blocked',
  BOOKING_CREATED: 'Booking created',
  BOOKING_CANCELLED: 'Booking cancelled',
  SEAT_HELD: 'Seat held',
  SEAT_HOLD_EXPIRED: 'Seat hold expired',
  SEAT_HOLD_RELEASED: 'Seat hold released',
  OFFER_CREATED: 'Offer created',
  OFFER_UPDATED: 'Offer updated',
  OFFER_DELETED: 'Offer deactivated',
  OFFER_HARD_DELETED: 'Offer permanently deleted',
  EXTRA_SERVICE_CREATED: 'Extra service created',
  EXTRA_SERVICE_UPDATED: 'Extra service updated',
  EXTRA_SERVICE_DEACTIVATED: 'Extra service deactivated',
  PAYMENT_SUCCEEDED: 'Payment succeeded',
  PAYMENT_FAILED: 'Payment failed',
  PAYMENT_INTENT_CREATED: 'Payment started',
  PAYMENT_CANCELED: 'Payment canceled',
  BOOKING_CONFIRMED: 'Booking confirmed',
  SEAT_HOLD_CONVERTED: 'Seat hold converted to booking',
  REFUND_COMPLETED: 'Refund completed',
  REFUND_RECOVERY_REQUESTED: 'Refund recovery requested',
  REFUND_ORPHAN_DISCOVERED: 'Orphan refund discovered',
  REFUND_ORPHAN_RESOLVED: 'Orphan refund resolved',
  BR14_PAYMENT_EXCEPTION: 'Booking confirmed without payment (exception)',
  SETTING_UPDATED: 'Setting updated',
  BAGGAGE_EVENT_RECORDED: 'Baggage event recorded',
  CHECK_IN_COMPLETED: 'Check-in completed',
  BOARDING_PASSES_INVALIDATED: 'Boarding passes invalidated',
  AIRPORT_CREATED: 'Airport created',
  AIRPORT_UPDATED: 'Airport updated',
  AIRCRAFT_CREATED: 'Aircraft created',
  AIRCRAFT_UPDATED: 'Aircraft updated',
  FLIGHTS_GENERATED: 'Flights generated',
  FLIGHT_STATUS_CHANGED: 'Flight status changed',
  FLIGHT_CREATED: 'Flight created',
  FLIGHT_UPDATED: 'Flight updated',
  ROUTE_CREATED: 'Route created',
  ROUTE_UPDATED: 'Route updated',
  SCHEDULE_RULE_CREATED: 'Schedule rule created',
  SCHEDULE_RULE_UPDATED: 'Schedule rule updated',
  TICKET_CREATED: 'Support ticket created',
  TICKET_CLAIMED: 'Support ticket claimed',
  TICKET_RESOLVED: 'Support ticket resolved',
  TICKET_CLOSED: 'Support ticket closed',
  TICKET_REOPENED: 'Support ticket reopened',
  TICKET_MESSAGE_SENT: 'Support reply sent',
};

/** Readable audit event label; unknown events pass through unchanged. */
export function auditEventLabel(event: string): string {
  return AUDIT_EVENT_LABELS[event] ?? event;
}

/** Display labels for audit target types (the record an action affected). */
const TARGET_TYPE_LABELS: Record<string, string> = {
  User: 'User account',
  Session: 'Sign-in session',
  RefreshToken: 'Session token',
  EmailVerificationToken: 'Email verification',
  PasswordResetToken: 'Password reset',
  Flight: 'Flight',
  Airport: 'Airport',
  Aircraft: 'Aircraft',
  Route: 'Route',
  ScheduleRule: 'Schedule rule',
  Booking: 'Booking',
  Payment: 'Payment',
  Refund: 'Refund',
  Offer: 'Offer',
  SeatHold: 'Seat hold',
  Role: 'Role',
  SystemSetting: 'System setting',
  Baggage: 'Baggage',
  SupportTicket: 'Support ticket',
  AuditLog: 'Audit record',
};

/** Readable target-type label; unknown types pass through unchanged. */
export function targetTypeLabel(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? targetType;
}

const MOCK_PAGE: AuditLogPage = {
  items: [
    {
      id: 'mock-1',
      event: 'USER_LOGGED_IN',
      actorType: 'User',
      actorId: 'demo-user',
      actorName: 'Demo Customer',
      actorEmail: 'customer@example.com',
      targetType: 'User',
      targetId: 'demo-user',
      ipAddress: '203.0.113.10',
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: 'mock-2',
      event: 'TOKEN_REUSE_DETECTED',
      actorType: 'User',
      actorId: 'demo-user',
      actorName: 'Demo Customer',
      actorEmail: 'customer@example.com',
      targetType: 'Session',
      targetId: 'demo-session',
      ipAddress: '203.0.113.11',
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      metadata: {},
    },
  ],
  page: 1,
  limit: 20,
  total: 2,
  totalPages: 1,
};

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  /** Paginated audit query. Mock branch returns development-only demo data. */
  listLogs(params: AuditQueryParams = {}): Observable<AuditLogPage> {
    if (!this.config.useRealApi) {
      return of(MOCK_PAGE).pipe(delay(300));
    }
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<AuditLogPage>(`${this.config.baseUrl}/audit`, { params: httpParams });
  }
}
