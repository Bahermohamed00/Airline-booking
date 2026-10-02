import { Injectable, inject } from '@angular/core';
import { Observable, of, delay, throwError, map } from 'rxjs';
import { BOOKINGS, DEMO_CUSTOMER, PASSENGERS, bookingByReference } from '../mock/mock-data';
import type { Booking, Payment, Refund, BookingStatus } from '../models/domain.model';
import type { BookingDraft } from '../models/booking-flow.model';
import { PricingService } from './pricing.service';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly pricing = inject(PricingService);
  private readonly bookings: Booking[] = [...BOOKINGS];
  private referenceCounter = 1000;

  myBookings(): Observable<Booking[]> {
    return of(this.bookings.filter((b) => b.userId === DEMO_CUSTOMER.id)).pipe(delay(300));
  }

  findByReference(ref: string, contactEmail?: string): Observable<Booking | undefined> {
    const booking = this.bookings.find((b) => b.bookingReference.toUpperCase() === ref.trim().toUpperCase());
    if (booking && contactEmail && booking.contactEmail.toLowerCase() !== contactEmail.trim().toLowerCase()) {
      return throwError(() => ({ status: 403, message: 'The email does not match this booking.' })).pipe(delay(300));
    }
    return of(booking).pipe(delay(300));
  }

  getById(id: string): Observable<Booking | undefined> {
    return of(this.bookings.find((b) => b.id === id)).pipe(delay(200));
  }

  adminBookings(query?: string): Observable<Booking[]> {
    const q = (query ?? '').trim().toLowerCase();
    const list = q
      ? this.bookings.filter(
          (b) =>
            b.bookingReference.toLowerCase().includes(q) ||
            b.contactEmail.toLowerCase().includes(q) ||
            b.flight.flightNumber.toLowerCase().includes(q) ||
            b.passengers.some((p) => `${p.passenger.firstName} ${p.passenger.lastName}`.toLowerCase().includes(q)),
        )
      : this.bookings;
    return of(list).pipe(delay(250));
  }

  confirmFromDraft(draft: BookingDraft): Observable<Booking> {
    const breakdown = this.pricing.computeBreakdown({
      fare: draft.fare,
      returnFare: draft.returnFare,
      passengerTypes: draft.passengers.map((p) => p.passengerType),
      seats: draft.seats,
      returnSeats: draft.returnSeats,
      extras: draft.extras,
      extraBags: draft.baggagePieces.reduce((a, b) => a + b, 0),
      promoCode: draft.criteria.promoCode,
    });

    const bookingId = crypto.randomUUID();
    const reference = this.generateReference();
    const now = new Date().toISOString();

    const booking: Booking = {
      id: bookingId,
      bookingReference: reference,
      userId: DEMO_CUSTOMER.id,
      status: 'CONFIRMED',
      totalAmount: breakdown.total,
      currency: breakdown.currency,
      bookedAt: now,
      contactEmail: DEMO_CUSTOMER.email,
      contactPhone: null,
      flightId: draft.outbound.id,
      flight: draft.outbound,
      passengers: draft.passengers.map((p, i) => ({
        id: `${bookingId}-bp${i}`,
        passengerId: PASSENGERS[0].id,
        passenger: {
          id: crypto.randomUUID(),
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          passportNumber: p.passportNumber,
          nationality: p.nationality,
        },
        passengerType: p.passengerType,
      })),
      seats: draft.seats.map((s, i) => ({
        id: `${bookingId}-bs${i}`,
        bookingPassengerId: `${bookingId}-bp${s.passengerIndex}`,
        flightSegmentId: draft.outbound.segments[0].id,
        seatId: s.seat.id,
        seatNumber: s.seat.seatNumber,
      })),
      extras: draft.extras.map((e, i) => ({
        id: `${bookingId}-be${i}`,
        extraServiceId: e.extra.id,
        extraService: e.extra,
        quantity: e.quantity,
        price: e.extra.price * e.quantity,
      })),
      payments: [
        {
          id: crypto.randomUUID(),
          bookingId,
          amount: breakdown.total,
          currency: breakdown.currency,
          status: 'SUCCESS',
          provider: 'mockpay',
          providerReference: `mp_${reference.toLowerCase()}`,
          paidAt: now,
          createdAt: now,
        },
      ],
      refunds: [],
    };

    this.bookings.push(booking);
    return of(booking).pipe(delay(600));
  }

  cancelBooking(id: string): Observable<Booking> {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) return throwError(() => ({ status: 404, message: 'Booking not found.' }));
    if (booking.status === 'CANCELLED') return throwError(() => ({ status: 409, message: 'Booking is already cancelled.' }));
    const fare = booking.flight.fares[0];
    const estimate = this.pricing.estimateRefund(fare, booking.totalAmount);
    booking.status = 'CANCELLED';
    if (estimate.amount > 0) {
      booking.refunds.push({
        id: crypto.randomUUID(),
        paymentId: booking.payments[0]?.id ?? '',
        bookingId: booking.id,
        amount: estimate.amount,
        currency: booking.currency,
        status: 'PENDING',
        reason: 'Customer cancellation',
        createdAt: new Date().toISOString(),
      });
      if (booking.payments[0]) booking.payments[0].status = 'PARTIALLY_REFUNDED';
    }
    return of(booking).pipe(delay(500));
  }

  estimateCancellation(booking: Booking) {
    const fare = booking.flight.fares[0];
    return this.pricing.estimateRefund(fare, booking.totalAmount);
  }

  adminConfirmException(id: string, reason: string): Observable<Booking> {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) return throwError(() => ({ status: 404, message: 'Booking not found.' }));
    if (!reason.trim()) return throwError(() => ({ status: 400, message: 'A reason is required for the exception workflow.' }));
    booking.status = 'CONFIRMED';
    return of(booking).pipe(delay(400));
  }

  private generateReference(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = 'NV';
    const n = this.referenceCounter++;
    for (let i = 0; i < 4; i++) {
      ref += chars.charAt((n + i * 7) % chars.length);
    }
    return ref;
  }
}
