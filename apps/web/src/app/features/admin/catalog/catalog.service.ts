import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { Aircraft, Airport, Route, Seat } from '../../../core/models/domain.model';
import {
  mapApiAircraft,
  mapApiAirport,
  mapApiRoute,
  type AircraftPayload,
  type AircraftUpdatePayload,
  type AircraftView,
  type ApiAirport,
  type ApiRoute,
  type AirportPayload,
  type AirportUpdatePayload,
  type RoutePayload,
  type RouteUpdatePayload,
} from './catalog-api.model';

/**
 * Thin typed wrapper over the catalog REST API (/airports, /routes, /aircraft).
 * No UI state and no business rules — the backend stays authoritative.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  listAirports(): Observable<Airport[]> {
    return this.http
      .get<ApiAirport[]>(`${this.config.baseUrl}/airports`)
      .pipe(map((list) => list.map(mapApiAirport)));
  }

  createAirport(payload: AirportPayload): Observable<Airport> {
    return this.http
      .post<ApiAirport>(`${this.config.baseUrl}/airports`, payload)
      .pipe(map(mapApiAirport));
  }

  updateAirport(id: string, payload: AirportUpdatePayload): Observable<Airport> {
    return this.http
      .patch<ApiAirport>(`${this.config.baseUrl}/airports/${id}`, payload)
      .pipe(map(mapApiAirport));
  }

  listRoutes(): Observable<Route[]> {
    return this.http
      .get<ApiRoute[]>(`${this.config.baseUrl}/routes`)
      .pipe(map((list) => list.map(mapApiRoute)));
  }

  createRoute(payload: RoutePayload): Observable<Route> {
    return this.http
      .post<ApiRoute>(`${this.config.baseUrl}/routes`, payload)
      .pipe(map(mapApiRoute));
  }

  updateRoute(id: string, payload: RouteUpdatePayload): Observable<Route> {
    return this.http
      .patch<ApiRoute>(`${this.config.baseUrl}/routes/${id}`, payload)
      .pipe(map(mapApiRoute));
  }

  listAircraft(): Observable<Aircraft[]> {
    return this.http
      .get<AircraftView[]>(`${this.config.baseUrl}/aircraft`)
      .pipe(map((list) => list.map(mapApiAircraft)));
  }

  getAircraft(id: string): Observable<Aircraft> {
    return this.http
      .get<AircraftView>(`${this.config.baseUrl}/aircraft/${id}`)
      .pipe(map(mapApiAircraft));
  }

  /** Full seat map, ordered by row/column; generated server-side at aircraft creation. */
  getAircraftSeats(id: string): Observable<Seat[]> {
    return this.http.get<Seat[]>(`${this.config.baseUrl}/aircraft/${id}/seats`);
  }

  createAircraft(payload: AircraftPayload): Observable<Aircraft> {
    return this.http
      .post<AircraftView>(`${this.config.baseUrl}/aircraft`, payload)
      .pipe(map(mapApiAircraft));
  }

  updateAircraft(id: string, payload: AircraftUpdatePayload): Observable<Aircraft> {
    return this.http
      .patch<AircraftView>(`${this.config.baseUrl}/aircraft/${id}`, payload)
      .pipe(map(mapApiAircraft));
  }
}
