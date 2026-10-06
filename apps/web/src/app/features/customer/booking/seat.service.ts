import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { Seat } from '../../../core/models/domain.model';

export type SeatMapState = 'available' | 'occupied' | 'selected' | 'held' | 'blocked' | 'exit';

export interface SeatMapRow {
  rowNumber: number;
  left: Seat[];
  right: Seat[];
}

/** Per-flight availability from GET /api/flights/:id/seat-availability. */
export interface SeatAvailability {
  flightId: string;
  occupiedSeatIds: string[];
  heldSeatIds: string[];
}

@Injectable({ providedIn: 'root' })
export class SeatService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  /** Full seat catalog of an aircraft (public endpoint), row/column ordered. */
  seatCatalog(aircraftId: string): Observable<Seat[]> {
    return this.http.get<Seat[]>(`${this.config.baseUrl}/aircraft/${aircraftId}/seats`);
  }

  /** Real per-flight occupancy: non-cancelled bookings + unexpired active holds. */
  seatAvailability(flightId: string): Observable<SeatAvailability> {
    return this.http.get<SeatAvailability>(
      `${this.config.baseUrl}/flights/${flightId}/seat-availability`,
    );
  }

  seatMapRows(seats: Seat[]): SeatMapRow[] {
    const sorted = [...seats].sort(
      (a, b) =>
        (a.seatRow ?? 0) - (b.seatRow ?? 0) ||
        (a.seatColumn ?? '').localeCompare(b.seatColumn ?? ''),
    );
    const byRow = new Map<number, Seat[]>();
    for (const s of sorted) {
      const row = s.seatRow ?? 0;
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(s);
    }
    return [...byRow.entries()].map(([rowNumber, rowSeats]) => ({
      rowNumber,
      left: rowSeats.filter((s) => ['A', 'B', 'C'].includes(s.seatColumn ?? '')),
      right: rowSeats.filter((s) => ['D', 'E', 'F'].includes(s.seatColumn ?? '')),
    }));
  }

  stateOf(
    seat: Seat,
    unavailable: Set<string>,
    selected: Set<string>,
    holdExpiresAt: string | null,
    now = Date.now(),
  ): SeatMapState {
    if (seat.isExitRow) return 'exit';
    if (unavailable.has(seat.id)) return 'occupied';
    if (selected.has(seat.id)) {
      if (holdExpiresAt && new Date(holdExpiresAt).getTime() <= now) return 'held';
      return 'selected';
    }
    return 'available';
  }
}
