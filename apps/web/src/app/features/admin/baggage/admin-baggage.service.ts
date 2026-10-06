import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { Baggage, BaggageStatus } from '../../../core/models/domain.model';

/** Baggage row plus the passenger/booking context the admin API embeds. */
export interface AdminBaggage extends Baggage {
  bookingPassenger: {
    passenger: { firstName: string; lastName: string };
    booking: { bookingReference: string };
  };
}

@Injectable({ providedIn: 'root' })
export class AdminBaggageService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  adminList(): Observable<AdminBaggage[]> {
    return this.http.get<AdminBaggage[]>(`${this.config.baseUrl}/admin/baggage`);
  }

  recordEvent(id: string, eventType: BaggageStatus, location: string): Observable<AdminBaggage> {
    return this.http.post<AdminBaggage>(`${this.config.baseUrl}/admin/baggage/${id}/events`, {
      eventType,
      location,
    });
  }
}
