import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type {
  ExtraCatalogItem,
  ExtraSelectionPayload,
  ExtrasCatalogQuery,
  ExtrasQuote,
} from '../models/extras.model';

/**
 * Real extras catalog API. Read-only: prices/eligibility are computed on the
 * server; purchase happens through booking creation. No mock data involved.
 */
@Injectable({ providedIn: 'root' })
export class ExtrasCatalogService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  catalog(query: ExtrasCatalogQuery): Observable<ExtraCatalogItem[]> {
    const params = new HttpParams()
      .set('flightId', query.flightId)
      .set('cabinClass', query.cabinClass);
    return this.http.get<ExtraCatalogItem[]>(`${this.config.baseUrl}/extras/catalog`, { params });
  }

  /** Read-only server quote for a set of selections (writes nothing). */
  quote(request: {
    flightId: string;
    cabinClass: string;
    passengerCount: number;
    selections: ExtraSelectionPayload[];
  }): Observable<ExtrasQuote> {
    return this.http.post<ExtrasQuote>(`${this.config.baseUrl}/extras/quote`, request);
  }
}
