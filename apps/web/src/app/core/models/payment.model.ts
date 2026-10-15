import type { BookingStatus, PaymentStatus, RefundStatus } from './domain.model';
import type { CustomerBooking } from './customer-booking.model';

// Payments API contract (apps/api payments module). Amounts are major units
// (EUR), timestamps are ISO strings. Card data never reaches this client or
// the API — Stripe.js collects it client-side and only the PaymentIntent
// client secret crosses the wire.

export interface CustomerRefund {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  /** Provider-side refund reference (Stripe `re_…`); null until processed. */
  providerReference?: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPayment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerReference: string | null;
  /** Fine-grained provider state (e.g. requires_action, processing). Never render raw to customers. */
  providerStatus?: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  refunds: CustomerRefund[];
}

export interface PayBookingPayload {
  idempotencyKey: string;
  /** Mock provider only (PAYMENT_PROVIDER=mock). Never sent in Stripe mode. */
  token?: string;
}

/** Stripe PaymentIntent handoff data — HTTP 200 means "intent created", NOT "paid". */
export interface PaymentIntentInfo {
  clientSecret: string | null;
  status: string;
  requiresAction: boolean;
}

export interface PayBookingResult {
  payment: CustomerPayment;
  /** Null when the attempt already settled (e.g. replay of a SUCCESS payment). */
  paymentIntent: PaymentIntentInfo | null;
  booking: CustomerBooking;
}

export interface AdminPayment extends CustomerPayment {
  bookingReference: string;
  bookingStatus: BookingStatus;
  contactEmail: string;
}

export interface AdminRefund extends CustomerRefund {
  bookingReference: string;
  paymentProviderReference: string | null;
  paymentStatus: PaymentStatus;
  contactEmail: string;
  /** Minutes the refund has been PENDING; null for non-pending rows. */
  pendingAgeMinutes: number | null;
  /** True once the refund is old enough to be worked on by the recovery sweep. */
  pendingRecovery: boolean;
  /** Stable provider idempotency identity of this logical refund (internal). */
  recoveryKey: string;
}

/** Paginated admin refund listing (Phase 3.4D). */
export interface AdminRefundListResult {
  items: AdminRefund[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Pending-aging presentation buckets (Phase 3.4D) — never database states. */
export interface RefundPendingBuckets {
  lt5m: number;
  m5to15: number;
  m15to60: number;
  h1to6: number;
  h6to24: number;
  gt24h: number;
}

/** One active refund alert condition (Phase 3.4F) — counts only, never ids. */
export interface RefundAlertCondition {
  code: string;
  detail: string;
  since: string;
}

/** Live refund operations snapshot (Phase 3.4D/3.4F). */
export interface RefundOperations {
  generatedAt: string;
  pending: {
    total: number;
    buckets: RefundPendingBuckets;
    stuckThresholdMinutes: number;
    stuck: number;
  };
  orphans: { unmatched: number };
  metrics: {
    since: string;
    counters: Record<string, number>;
    gauges: Record<string, number>;
  };
  alerts: { active: RefundAlertCondition[] };
}

export type OrphanRefundStatus = 'UNMATCHED' | 'RESOLVED';

/** A provider-side refund NovaAir could not match locally (Phase 3.4E). */
export interface OrphanProviderRefund {
  id: string;
  provider: string;
  providerRefundReference: string;
  paymentProviderReference: string;
  amount: number;
  currency: string;
  status: OrphanRefundStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface OrphanRefundListResult {
  items: OrphanProviderRefund[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Result of the admin refund recovery action (Batch 1 resume endpoint). */
export interface ResumeRefundResult {
  refund: AdminRefund;
  payment: AdminPayment;
}

export interface AdminPaymentQuery {
  status?: PaymentStatus;
  reference?: string;
  bookingId?: string;
  from?: string;
  to?: string;
}

export interface RefundPaymentPayload {
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  refund: AdminRefund;
  payment: AdminPayment;
}

export interface AdminCancelBookingResult {
  booking: CustomerBooking;
  refund: AdminRefund | null;
  refundNote: string | null;
}
