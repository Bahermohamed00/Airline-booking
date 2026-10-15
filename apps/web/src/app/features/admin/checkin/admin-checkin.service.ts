import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { BookingStatus, FlightStatus } from '../../../core/models/domain.model';

/** Server-computed online check-in window state (24h/-1h rule lives in the API). */
export type CheckinWindowState = 'NOT_OPEN' | 'OPEN' | 'CLOSED';

/** One operational row of GET /admin/checkin — real PostgreSQL-backed data. */
export interface AdminCheckInBooking {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  flight: {
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    status: FlightStatus;
    route: {
      originIata: string;
      destinationIata: string;
      originCity: string;
      destinationCity: string;
    };
  } | null;
  passengersTotal: number;
  /** Passengers with an active (COMPLETED) check-in. */
  checkedInCount: number;
  /** Passengers whose passes were invalidated and who have not re-checked-in. */
  invalidatedCount: number;
  windowState: CheckinWindowState | null;
}

export interface InvalidatePassesResult {
  bookingId: string;
  invalidatedCount: number;
  bookingStatus: BookingStatus;
}

/** Admin check-in API (requires the checkin:manage permission server-side). */
@Service()
export class AdminCheckinService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  operationalList(): Observable<AdminCheckInBooking[]> {
    return this.http.get<AdminCheckInBooking[]>(`${this.config.baseUrl}/admin/checkin`);
  }

  invalidatePasses(bookingId: string): Observable<InvalidatePassesResult> {
    return this.http.post<InvalidatePassesResult>(
      `${this.config.baseUrl}/admin/checkin/${bookingId}/invalidate`,
      {},
    );
  }
}
