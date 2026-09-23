import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { BOOKINGS, flightById } from '../mock/mock-data';
import type { Seat, Flight } from '../models/domain.model';

export type SeatMapState = 'available' | 'occupied' | 'selected' | 'held' | 'blocked' | 'exit';

export interface SeatMapRow {
  rowNumber: number;
  left: Seat[];
  right: Seat[];
}

@Injectable({ providedIn: 'root' })
export class SeatService {
  /** Seats that are already occupied on this flight via confirmed bookings. */
  occupiedSeatIds(flight: Flight): Set<string> {
    const ids = new Set<string>();
    for (const booking of BOOKINGS) {
      if (booking.flightId !== flight.id || booking.status === 'CANCELLED') continue;
      for (const seat of booking.seats) ids.add(seat.seatId);
    }
    return ids;
  }

  seatMapRows(flight: Flight): SeatMapRow[] {
    const seats = [...flight.aircraft.seats].sort((a, b) => (a.seatRow ?? 0) - (b.seatRow ?? 0) || (a.seatColumn ?? '').localeCompare(b.seatColumn ?? ''));
    const byRow = new Map<number, Seat[]>();
    for (const s of seats) {
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

  stateOf(seat: Seat, occupied: Set<string>, selected: Set<string>, holdExpiresAt: string | null, now = Date.now()): SeatMapState {
    if (seat.isExitRow) return 'exit';
    if (occupied.has(seat.id)) return 'occupied';
    if (selected.has(seat.id)) {
      if (holdExpiresAt && new Date(holdExpiresAt).getTime() <= now) return 'held';
      return 'selected';
    }
    return 'available';
  }

  accessibleSeatList(flight: Flight, cabin: string): Observable<Seat[]> {
    const occupied = this.occupiedSeatIds(flight);
    const list = flight.aircraft.seats.filter((s) => s.cabinClass === cabin && !occupied.has(s.id));
    return of(list).pipe(delay(150));
  }
}
