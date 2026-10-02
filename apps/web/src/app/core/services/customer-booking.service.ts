import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type {
  AdminBookingQuery,
  CreateBookingPayload,
  CustomerBooking,
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

  myBookings(): Observable<CustomerBooking[]> {
    return this.http.get<CustomerBooking[]>(`${this.config.baseUrl}/bookings`);
  }

  getById(id: string): Observable<CustomerBooking> {
    return this.http.get<CustomerBooking>(`${this.config.baseUrl}/bookings/${id}`);
  }

  cancel(id: string): Observable<CustomerBooking> {
    return this.http.post<CustomerBooking>(`${this.config.baseUrl}/bookings/${id}/cancel`, {});
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
