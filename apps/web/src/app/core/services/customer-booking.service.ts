import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type {
  AdminBookingQuery,
  CancellationPreview,
  CancellationRequest,
  CreateBookingPayload,
  CustomerBooking,
  PricePreviewRequest,
  PricePreviewResponse,
} from '../models/customer-booking.model';
import type { AdminCancelBookingResult } from '../models/payment.model';

/**
 * Real customer booking API. The server owns identity (JWT), booking
 * references, status transitions, pricing and seat holds — the client only
 * sends CreateBookingPayload fields.
 */
@Injectable({ providedIn: 'root' })
export class CustomerBookingService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  create(payload: CreateBookingPayload): Observable<CustomerBooking> {
    return this.http.post<CustomerBooking>(`${this.config.baseUrl}/bookings`, payload);
  }

  /** BR-16: read-only server-side price preview (JWT required). Errors carry
   *  err.error.code — e.g. OFFER_NOT_FOUND (404), OFFER_NOT_AVAILABLE (409). */
  pricePreview(request: PricePreviewRequest): Observable<PricePreviewResponse> {
    return this.http.post<PricePreviewResponse>(
      `${this.config.baseUrl}/bookings/price-preview`,
      request,
    );
  }

  myBookings(): Observable<CustomerBooking[]> {
    return this.http.get<CustomerBooking[]>(`${this.config.baseUrl}/bookings`);
  }

  getById(id: string): Observable<CustomerBooking> {
    return this.http.get<CustomerBooking>(`${this.config.baseUrl}/bookings/${id}`);
  }

  cancel(id: string): Observable<CustomerBooking> {
    return this.http.post<CustomerBooking>(`${this.config.baseUrl}/bookings/${id}/cancel`, {});
  }

  /**
   * Customer cancellation REQUEST for a CONFIRMED (paid) booking — the booking
   * stays active until staff review it. Errors: 409 CANCELLATION_REQUEST_PENDING
   * (a request is already open); other 409s for non-cancellable states. Direct
   * cancel remains only for unpaid PENDING bookings (409 CANCELLATION_REQUEST_REQUIRED
   * is returned by /cancel for CONFIRMED ones).
   */
  requestCancellation(id: string, reason?: string): Observable<CancellationRequest> {
    return this.http.post<CancellationRequest>(
      `${this.config.baseUrl}/bookings/${id}/cancellation-request`,
      reason === undefined ? {} : { reason },
    );
  }

  /** Server-calculated cancellation preview — informational only, never an authorization. */
  cancellationPreview(id: string): Observable<CancellationPreview> {
    return this.http.get<CancellationPreview>(`${this.config.baseUrl}/bookings/${id}/cancellation-preview`);
  }

  listAdmin(query: AdminBookingQuery = {}): Observable<CustomerBooking[]> {
    const params: Record<string, string> = {};
    if (query.reference) params['reference'] = query.reference;
    if (query.status) params['status'] = query.status;
    if (query.email) params['email'] = query.email;
    return this.http.get<CustomerBooking[]>(`${this.config.baseUrl}/admin/bookings`, { params });
  }

  getAdmin(id: string): Observable<CustomerBooking> {
    return this.http.get<CustomerBooking>(`${this.config.baseUrl}/admin/bookings/${id}`);
  }

  /** Staff-side cancellation (bookings:manage). The server may auto-refund
   *  per fare policy; `refund`/`refundNote` in the result explain what happened. */
  adminCancel(id: string, reason?: string): Observable<AdminCancelBookingResult> {
    return this.http.post<AdminCancelBookingResult>(
      `${this.config.baseUrl}/admin/bookings/${id}/cancel`,
      reason === undefined ? {} : { reason },
    );
  }

  /** BR-14 payment exception (bookings:manage): confirm a PENDING booking
   *  without payment. `reason` is required by the API (min 10 characters). */
  adminConfirmException(id: string, reason: string): Observable<{ booking: CustomerBooking }> {
    return this.http.post<{ booking: CustomerBooking }>(
      `${this.config.baseUrl}/admin/bookings/${id}/confirm-exception`,
      { reason },
    );
  }
}
