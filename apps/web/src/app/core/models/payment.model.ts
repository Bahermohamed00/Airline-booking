import type { BookingStatus, PaymentStatus, RefundStatus } from './domain.model';
import type { CustomerBooking } from './customer-booking.model';

// Payments API contract (apps/api payments module). Amounts are major units
// (EUR), timestamps are ISO strings. Card data never reaches this client or
// the API — only provider tokens (`tok_…`) are transmitted.

export interface CustomerRefund {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerReference: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  refunds: CustomerRefund[];
}

export interface PayBookingPayload {
  token: string;
  idempotencyKey: string;
}

export interface PayBookingResult {
  payment: CustomerPayment;
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
