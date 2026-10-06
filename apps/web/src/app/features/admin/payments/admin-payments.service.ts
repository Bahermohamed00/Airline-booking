import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { RefundStatus } from '../../../core/models/domain.model';
import type {
  AdminPayment,
  AdminPaymentQuery,
  AdminRefund,
  RefundPaymentPayload,
  RefundPaymentResult,
} from '../../../core/models/payment.model';

export interface AdminRefundQuery {
  status?: RefundStatus;
  bookingId?: string;
}

/** Staff payments & refunds API (payments:read / payments:refund). */
@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  listPayments(query: AdminPaymentQuery = {}): Observable<AdminPayment[]> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.reference) params = params.set('reference', query.reference);
    if (query.bookingId) params = params.set('bookingId', query.bookingId);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    return this.http.get<AdminPayment[]>(`${this.config.baseUrl}/admin/payments`, { params });
  }

  getPayment(id: string): Observable<AdminPayment> {
    return this.http.get<AdminPayment>(`${this.config.baseUrl}/admin/payments/${id}`);
  }

  refund(paymentId: string, payload: RefundPaymentPayload): Observable<RefundPaymentResult> {
    return this.http.post<RefundPaymentResult>(
      `${this.config.baseUrl}/admin/payments/${paymentId}/refund`,
      payload,
    );
  }

  listRefunds(query: AdminRefundQuery = {}): Observable<AdminRefund[]> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.bookingId) params = params.set('bookingId', query.bookingId);
    return this.http.get<AdminRefund[]>(`${this.config.baseUrl}/admin/refunds`, { params });
  }
}
