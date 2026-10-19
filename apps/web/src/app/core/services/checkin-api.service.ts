import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type {
  BoardingPassResponse,
  CheckInBooking,
  CheckInResponse,
} from '../models/checkin.model';

/**
 * Real check-in API. Every endpoint is JWT-required and ownership-enforced
 * server-side; eligibility (24h open / 1h close) is enforced by the server —
 * 409 responses carry `err.error.code` (CHECKIN_NOT_OPEN, CHECKIN_CLOSED,
 * ALREADY_CHECKED_IN, CHECKIN_NOT_ELIGIBLE).
 */
@Injectable({ providedIn: 'root' })
export class CheckInApiService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  private get base(): string {
    return `${this.config.baseUrl}/checkin`;
  }

  /** Exactly one of reference/email per request — the server rejects both with 400. */
  lookupByReference(reference: string): Observable<CheckInBooking[]> {
    return this.http.get<CheckInBooking[]>(`${this.base}/bookings`, {
      params: { reference: reference.trim().toUpperCase() },
    });
  }

  /** The email must match the account email — the server rejects mismatches
   *  with 400/403 `{ code: 'EMAIL_MISMATCH' }`. */
  lookupByEmail(email: string): Observable<CheckInBooking[]> {
    return this.http.get<CheckInBooking[]>(`${this.base}/bookings`, {
      params: { email: email.trim() },
    });
  }

  checkIn(bookingId: string, bookingPassengerId: string, checkedBagCount = 0): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(this.base, {
      bookingId,
      bookingPassengerId,
      ...(checkedBagCount > 0 ? { checkedBagCount } : {}),
    });
  }

  boardingPass(bookingId: string): Observable<BoardingPassResponse> {
    return this.http.get<BoardingPassResponse>(`${this.base}/boarding-pass`, {
      params: { bookingId },
    });
  }
}
