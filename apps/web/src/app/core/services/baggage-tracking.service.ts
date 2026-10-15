import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';

/** Public tracking view from GET /api/baggage/track/:tagNumber (PII-free). */
export interface TrackedBaggageEvent {
  eventType: string;
  location: string | null;
  occurredAt: string;
}

export interface TrackedBaggage {
  tagNumber: string;
  type: string;
  pieces: number;
  weightKg: number | null;
  status: string;
  events: TrackedBaggageEvent[];
}

/**
 * Real baggage-tracking API. A 404 means "no bag with this tag" (the page's
 * empty state); every other failure propagates to the retryable error state.
 */
@Injectable({ providedIn: 'root' })
export class BaggageTrackingService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  track(tagNumber: string): Observable<TrackedBaggage | undefined> {
    const tag = encodeURIComponent(tagNumber.trim().toUpperCase());
    return this.http.get<TrackedBaggage>(`${this.config.baseUrl}/baggage/track/${tag}`).pipe(
      catchError((err: HttpErrorResponse) =>
        err.status === 404 ? of(undefined) : throwError(() => err),
      ),
    );
  }
}
