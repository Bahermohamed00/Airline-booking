import { Injectable } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import {
  BAGGAGE, CHECK_INS, EXTRAS, LOYALTY, NOTIFICATIONS, BOOKINGS,
} from '../mock/mock-data';
import type {
  Baggage, CheckIn, BoardingPass, ExtraService, LoyaltyAccount, NotificationItem,
  Booking,
} from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class ExtrasService {
  list(): Observable<ExtraService[]> {
    return of(EXTRAS).pipe(delay(150));
  }
}

export interface CheckInEligibility {
  eligible: boolean;
  reason: string | null;
  opensAt: string | null;
  closesAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class CheckInService {
  private readonly checkIns: CheckIn[] = [...CHECK_INS];

  eligibility(booking: Booking, now = Date.now()): CheckInEligibility {
    const dep = new Date(booking.flight.departureTime).getTime();
    const opensAt = dep - 24 * 3600 * 1000;
    const closesAt = dep - 60 * 60 * 1000;
    if (booking.status !== 'CONFIRMED' && booking.status !== 'CHECKED_IN') {
      return { eligible: false, reason: 'Only confirmed bookings can be checked in.', opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() };
    }
    if (now < opensAt) {
      return { eligible: false, reason: 'Online check-in opens 24 hours before departure.', opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() };
    }
    if (now > closesAt) {
      return { eligible: false, reason: 'Online check-in closed 1 hour before departure.', opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() };
    }
    return { eligible: true, reason: null, opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() };
  }

  alreadyCheckedIn(bookingId: string): CheckIn[] {
    const booking = BOOKINGS.find((b) => b.id === bookingId);
    if (!booking) return this.checkIns;
    const paxIds = new Set(booking.passengers.map((p) => p.id));
    return this.checkIns.filter((c) => paxIds.has(c.bookingPassengerId));
  }

  complete(booking: Booking, passengerIndex: number): Observable<{ checkIn: CheckIn; boardingPass: BoardingPass }> {
    const eligibility = this.eligibility(booking);
    if (!eligibility.eligible) {
      return throwError(() => ({ status: 409, message: eligibility.reason ?? 'Not eligible for check-in.' }));
    }
    const pax = booking.passengers[passengerIndex];
    const seat = booking.seats.find((s) => s.bookingPassengerId === pax.id);
    const checkIn: CheckIn = {
      id: crypto.randomUUID(),
      bookingPassengerId: pax.id,
      flightSegmentId: booking.flight.segments[0].id,
      checkInTime: new Date().toISOString(),
      status: 'COMPLETED',
    };
    const boardingPass: BoardingPass = {
      id: crypto.randomUUID(),
      checkInId: checkIn.id,
      boardingGroup: seat && seat.seatNumber.charCodeAt(0) % 2 === 0 ? 'B' : 'C',
      seatNumber: seat?.seatNumber ?? 'TBD',
      gate: booking.flight.route.destination.iataCode === 'JFK' ? 'B22' : 'A14',
      issuedAt: checkIn.checkInTime,
    };
    checkIn.boardingPass = boardingPass;
    this.checkIns.push(checkIn);
    return of({ checkIn, boardingPass }).pipe(delay(500));
  }
}

@Injectable({ providedIn: 'root' })
export class BaggageService {
  track(tagNumber: string): Observable<Baggage | undefined> {
    return of(BAGGAGE.find((b) => b.tagNumber?.toUpperCase() === tagNumber.trim().toUpperCase())).pipe(delay(350));
  }

  adminList(): Observable<Baggage[]> {
    return of(BAGGAGE).pipe(delay(250));
  }
}

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  account(): Observable<LoyaltyAccount> {
    return of(LOYALTY).pipe(delay(250));
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  mine(): Observable<NotificationItem[]> {
    return of(NOTIFICATIONS).pipe(delay(250));
  }
}
