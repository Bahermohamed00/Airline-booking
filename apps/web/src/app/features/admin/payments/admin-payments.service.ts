import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { RefundStatus } from '../../../core/models/domain.model';
import type {
  AdminPayment,
  AdminPaymentQuery,
  AdminRefundListResult,
  OrphanProviderRefund,
  OrphanRefundListResult,
  OrphanRefundStatus,
  RefundOperations,
  RefundPaymentPayload,
  RefundPaymentResult,
  ResumeRefundResult,
} from '../../../core/models/payment.model';

/** Operational refund filters (Phase 3.4D) — pending ages in minutes. */
export interface AdminRefundQuery {
  status?: RefundStatus;
  bookingId?: string;
  bookingReference?: string;
  paymentId?: string;
  refundId?: string;
  providerReference?: string;
  from?: string;
  to?: string;
  pendingMinAgeMinutes?: number;
  pendingMaxAgeMinutes?: number;
  page?: number;
  limit?: number;
}

export interface AdminOrphanRefundQuery {
  status?: OrphanRefundStatus;
  page?: number;
  limit?: number;
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

  listRefunds(query: AdminRefundQuery = {}): Observable<AdminRefundListResult> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.bookingId) params = params.set('bookingId', query.bookingId);
    if (query.bookingReference) params = params.set('bookingReference', query.bookingReference);
    if (query.paymentId) params = params.set('paymentId', query.paymentId);
    if (query.refundId) params = params.set('refundId', query.refundId);
    if (query.providerReference) params = params.set('providerReference', query.providerReference);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.pendingMinAgeMinutes !== undefined)
      params = params.set('pendingMinAgeMinutes', query.pendingMinAgeMinutes);
    if (query.pendingMaxAgeMinutes !== undefined)
      params = params.set('pendingMaxAgeMinutes', query.pendingMaxAgeMinutes);
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    return this.http.get<AdminRefundListResult>(`${this.config.baseUrl}/admin/refunds`, { params });
  }

  /** Live refund operations snapshot (Phase 3.4D/3.4F). */
  getRefundOperations(): Observable<RefundOperations> {
    return this.http.get<RefundOperations>(`${this.config.baseUrl}/admin/refunds/operations`);
  }

  /**
   * Recovers a stuck PENDING refund through the Batch 1 recovery core — never
   * a new refund. 502 = outcome still uncertain (recoverable), 409 =
   * definitively rejected.
   */
  resumeRefund(refundId: string): Observable<ResumeRefundResult> {
    return this.http.post<ResumeRefundResult>(
      `${this.config.baseUrl}/admin/refunds/${refundId}/resume`,
      {},
    );
  }

  /** Unmatched provider refunds discovered by orphan discovery (Phase 3.4E). */
  listOrphanRefunds(query: AdminOrphanRefundQuery = {}): Observable<OrphanRefundListResult> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    return this.http.get<OrphanRefundListResult>(`${this.config.baseUrl}/admin/refunds/orphans`, { params });
  }

  /** Marks an investigated orphan provider refund resolved (audited). */
  resolveOrphanRefund(orphanId: string, note?: string): Observable<OrphanProviderRefund> {
    return this.http.post<OrphanProviderRefund>(
      `${this.config.baseUrl}/admin/refunds/orphans/${orphanId}/resolve`,
      note ? { note } : {},
    );
  }
}
