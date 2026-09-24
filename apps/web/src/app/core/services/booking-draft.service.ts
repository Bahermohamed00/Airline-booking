import { Injectable, computed, signal } from '@angular/core';
import type {
  BookingDraft, SearchCriteria, PassengerForm, SeatSelection, ExtraSelection, DraftLeg,
} from '../models/booking-flow.model';
import type { Flight, Fare } from '../models/domain.model';

const HOLD_MINUTES = 15;

@Injectable({ providedIn: 'root' })
export class BookingDraftService {
  private readonly draftSignal = signal<BookingDraft | null>(null);
  readonly draft = this.draftSignal.asReadonly();

  readonly passengers = computed(() => this.draftSignal()?.passengers ?? []);
  readonly criteria = computed(() => this.draftSignal()?.criteria ?? null);
  readonly outbound = computed(() => this.draftSignal()?.outbound ?? null);
  readonly fare = computed(() => this.draftSignal()?.fare ?? null);
  readonly seatHoldExpiresAt = computed(() => this.draftSignal()?.seatHoldExpiresAt ?? null);

  start(criteria: SearchCriteria, flight: Flight, fare: Fare, returnFlight?: Flight, returnFare?: Fare, legs?: DraftLeg[]): void {
    const count = criteria.passengers;
    const passengers: PassengerForm[] = [
      ...Array.from({ length: count.adults }, () => this.emptyPassenger('ADULT')),
      ...Array.from({ length: count.children }, () => this.emptyPassenger('CHILD')),
      ...Array.from({ length: count.infants }, () => this.emptyPassenger('INFANT')),
    ];
    this.draftSignal.set({
      criteria,
      outbound: flight,
      returnFlight: returnFlight ?? null,
      fare,
      returnFare: returnFare ?? null,
      legs: legs ?? [],
      passengers,
      seats: [],
      returnSeats: [],
      extraLegSeats: [],
      extras: [],
      baggagePieces: passengers.map(() => 0),
      seatHoldExpiresAt: null,
      paymentReference: null,
      confirmedBooking: null,
    });
  }

  private emptyPassenger(type: PassengerForm['passengerType']): PassengerForm {
    return { passengerType: type, firstName: '', lastName: '', dateOfBirth: '', nationality: '', passportNumber: '' };
  }

  setPassengers(passengers: PassengerForm[]): void {
    this.update((d) => ({ ...d, passengers }));
  }

  setSeats(seats: SeatSelection[], returnSeats: SeatSelection[], extraLegSeats: SeatSelection[] = []): void {
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60000).toISOString();
    this.update((d) => ({ ...d, seats, returnSeats, extraLegSeats, seatHoldExpiresAt: expiresAt }));
  }

  setExtras(extras: ExtraSelection[]): void {
    this.update((d) => ({ ...d, extras }));
  }

  setBaggage(pieces: number[]): void {
    this.update((d) => ({ ...d, baggagePieces: pieces }));
  }

  setPaymentReference(ref: string): void {
    this.update((d) => ({ ...d, paymentReference: ref }));
  }

  holdSecondsRemaining(now: number = Date.now()): number {
    const expires = this.draftSignal()?.seatHoldExpiresAt;
    if (!expires) return 0;
    return Math.max(0, Math.floor((new Date(expires).getTime() - now) / 1000));
  }

  isHoldExpired(now: number = Date.now()): boolean {
    const expires = this.draftSignal()?.seatHoldExpiresAt;
    if (!expires) return false;
    return new Date(expires).getTime() <= now;
  }

  releaseHold(): void {
    this.update((d) => ({ ...d, seats: [], returnSeats: [], extraLegSeats: [], seatHoldExpiresAt: null }));
  }

  clear(): void {
    this.draftSignal.set(null);
  }

  private update(fn: (d: BookingDraft) => BookingDraft): void {
    const current = this.draftSignal();
    if (current) this.draftSignal.set(fn(current));
  }
}

export const SEAT_HOLD_MINUTES = HOLD_MINUTES;
