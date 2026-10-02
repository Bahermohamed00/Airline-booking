import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type {
  CustomerPayment,
  PayBookingPayload,
  PayBookingResult,
} from '../models/payment.model';

/**
 * Real customer payments API. The client only ever handles provider tokens
 * (`tok_…`) — raw card data is never collected, stored or transmitted.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  pay(bookingId: string, payload: PayBookingPayload): Observable<PayBookingResult> {
    return this.http.post<PayBookingResult>(
      `${this.config.baseUrl}/bookings/${bookingId}/payment`,
      payload,
    );
  }

  getPayments(bookingId: string): Observable<CustomerPayment[]> {
    return this.http.get<CustomerPayment[]>(
      `${this.config.baseUrl}/bookings/${bookingId}/payments`,
    );
  }

  /**
   * Stand-in for the PCI provider's tokenization SDK (e.g. Stripe Elements):
   * in production this is where card data would be exchanged for a token
   * client-side, so it never touches our servers. The mock provider accepts
   * any `tok_…` token.
   */
  tokenize(): Observable<string> {
    return of(`tok_${crypto.randomUUID().replaceAll('-', '')}`);
  }
}
