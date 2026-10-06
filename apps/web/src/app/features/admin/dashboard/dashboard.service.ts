import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { BookingStatus, FlightStatus } from '../../../core/models/domain.model';

export type DashboardRange = '7d' | '30d' | '90d';

export interface TrendPoint {
  date: string;
  value: number;
}

/** Slim operations row from GET /api/admin/dashboard (no fares, no PII). */
export interface DashboardFlight {
  id: string;
  flightNumber: string;
  status: FlightStatus;
  departureTime: string;
  arrivalTime: string;
  originIata: string;
  destinationIata: string;
  aircraftRegistration: string;
}

export interface DashboardBooking {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  bookedAt: string;
}

/**
 * Operations dashboard payload. `revenue`/`revenueTrend` are null while the
 * payments backend is intentionally deferred — never demo or fabricated data.
 */
export interface DashboardData {
  range: DashboardRange;
  totalFlights: number;
  totalBookings: number;
  confirmedBookings: number;
  passengers: number;
  occupancyPercent: number;
  revenue: number | null;
  currency: string;
  scheduledCount: number;
  delayedCount: number;
  cancelledCount: number;
  completedCount: number;
  pendingRefunds: number;
  openBaggageCases: number;
  todaysFlights: DashboardFlight[];
  recentBookings: DashboardBooking[];
  bookingsTrend: TrendPoint[];
  revenueTrend: TrendPoint[] | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  getDashboard(range: DashboardRange): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.config.baseUrl}/admin/dashboard`, {
      params: { range },
    });
  }
}
