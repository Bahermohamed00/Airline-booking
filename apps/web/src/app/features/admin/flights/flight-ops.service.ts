import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { FlightStatus, CabinClass } from '../../../core/models/domain.model';
import type { ApiFlight } from '../../../core/models/flight-api.model';

/** Numeric-price fare view returned by the flights API (Prisma decimals converted). */
export interface ApiFareView {
  cabinClass: CabinClass;
  basePrice: number;
  taxAmount: number;
  feeAmount: number;
  currency: string;
  availableCount: number;
}

export interface FlightOverview {
  totalFlights: number;
  upcomingFlights: number;
  activeFlights: number;
  completedFlights: number;
  cancelledFlights: number;
  delayedFlights: number;
  routes: number;
  airports: number;
  aircraft: number;
  statusBreakdown: Record<string, number>;
  upcoming: ApiFlight[];
  recentActivity: HistoryItem[];
}

export interface HistoryItem {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface HistoryPage {
  items: HistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CompletedFlightItem {
  id: string;
  flightNumber: string;
  publicNumber: number;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  route: {
    origin: { iataCode: string; name: string; city: string };
    destination: { iataCode: string; name: string; city: string };
  };
  aircraft: { registration: string; model: string };
  operatingDate: string | null;
  departureTime: string;
  arrivalTime: string;
  status: FlightStatus;
  scheduleStatus: string;
  bookedSeats: number;
  fares: ApiFareView[];
}

export interface CompletedFlightsPage {
  items: CompletedFlightItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HistoryQuery {
  event?: string;
  domain?: 'flights' | 'airports' | 'aircraft' | 'routes';
  actorType?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface CompletedQuery {
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Flight Manager operations APIs (flights:read): overview, completed, history. */
@Injectable({ providedIn: 'root' })
export class FlightOpsService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  overview(): Observable<FlightOverview> {
    return this.http.get<FlightOverview>(`${this.config.baseUrl}/admin/flights/overview`);
  }

  completed(query: CompletedQuery = {}): Observable<CompletedFlightsPage> {
    const params: Record<string, string | number> = { page: query.page ?? 1, limit: query.limit ?? 20 };
    if (query.search) params['search'] = query.search;
    if (query.from) params['from'] = query.from;
    if (query.to) params['to'] = query.to;
    return this.http.get<CompletedFlightsPage>(`${this.config.baseUrl}/admin/flights/completed`, { params });
  }

  history(query: HistoryQuery = {}): Observable<HistoryPage> {
    const params: Record<string, string | number> = { page: query.page ?? 1, limit: query.limit ?? 20 };
    if (query.event) params['event'] = query.event;
    if (query.domain) params['domain'] = query.domain;
    if (query.actorType) params['actorType'] = query.actorType;
    if (query.search) params['search'] = query.search;
    if (query.from) params['from'] = query.from;
    if (query.to) params['to'] = query.to;
    return this.http.get<HistoryPage>(`${this.config.baseUrl}/admin/flights/history`, { params });
  }
}
