import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { CabinClass, FlightOffer } from '../models/domain.model';

export interface OfferFilter {
  cabin?: CabinClass | '';
  scope?: '' | 'domestic' | 'international';
}

@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  listOffers(filter: OfferFilter = {}): Observable<FlightOffer[]> {
    const params: Record<string, string> = {};
    if (filter.cabin) params['cabin'] = filter.cabin;
    if (filter.scope) params['scope'] = filter.scope;
    return this.http.get<FlightOffer[]>(`${this.config.baseUrl}/offers`, { params });
  }
}
