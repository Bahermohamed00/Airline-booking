import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { CancellationRequestStatus } from '../models/customer-booking.model';
import type { BookingStatus, PaymentStatus, RefundStatus } from '../models/domain.model';

export interface AdminCancellationRequestBooking {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  bookedAt: string;
}

export interface AdminCancellationRequestCustomer {
  firstName: string;
  lastName: string;
  email: string;
}

export interface AdminCancellationRequestFlight {
  flightNumber: string;
  originIata: string;
  destinationIata: string;
  departureTime: string;
}

export interface AdminCancellationRequestPayment {
  amount: number;
  currency: string;
  status: PaymentStatus;
}

/** Server-side policy decision for the request (null when not applicable). */
export interface AdminCancellationRequestPolicy {
  refundPercentage: number;
  refundableAmount: number;
  currency: string;
}

export interface AdminCancellationRequestRefund {
  id: string;
  status: RefundStatus;
  amount: number;
}

/** Staff view of a customer cancellation request (GET /api/admin/cancellation-requests). */
export interface AdminCancellationRequest {
  id: string;
  status: CancellationRequestStatus;
  reason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  booking: AdminCancellationRequestBooking;
  customer: AdminCancellationRequestCustomer;
  flight: AdminCancellationRequestFlight;
  payment: AdminCancellationRequestPayment | null;
  policy: AdminCancellationRequestPolicy | null;
  refund: AdminCancellationRequestRefund | null;
}

/**
 * Staff-side cancellation request review API (bookings:manage). Errors carry
 * err.error.code / err.error.message; approve/reject answer 409 when the
 * request was already reviewed by someone else.
 */
@Injectable({ providedIn: 'root' })
export class CancellationRequestsService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  list(status?: CancellationRequestStatus): Observable<AdminCancellationRequest[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<AdminCancellationRequest[]>(
      `${this.config.baseUrl}/admin/cancellation-requests`,
      { params },
    );
  }

  /** Approving refunds per policy and cancels the booking once the refund completes. */
  approve(id: string): Observable<AdminCancellationRequest> {
    return this.http.post<AdminCancellationRequest>(
      `${this.config.baseUrl}/admin/cancellation-requests/${id}/approve`,
      {},
    );
  }

  reject(id: string, rejectionReason?: string): Observable<AdminCancellationRequest> {
    return this.http.post<AdminCancellationRequest>(
      `${this.config.baseUrl}/admin/cancellation-requests/${id}/reject`,
      rejectionReason === undefined ? {} : { rejectionReason },
    );
  }
}
