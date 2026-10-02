import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BookingDraftService, SEAT_HOLD_MINUTES } from './booking-draft.service';
import { FLIGHTS } from '../mock/mock-data';
import type { SearchCriteria } from '../models/booking-flow.model';

const criteria: SearchCriteria = {
  tripType: 'ONE_WAY',
  originCode: 'FRA',
  destinationCode: 'JFK',
  departureDate: '2026-10-01',
  passengers: { adults: 1, children: 0, infants: 0 },
  cabinClass: 'ECONOMY',
};

describe('BookingDraftService seat holds (BR-13)', () => {
  let draft: BookingDraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    draft = TestBed.inject(BookingDraftService);
    draft.clear();
    draft.start(criteria, FLIGHTS[6], FLIGHTS[6].fares[0]);
  });

  it('creates a hold with an expiry window when seats are set', () => {
    const seat = FLIGHTS[6].aircraft.seats![10];
    draft.setSeats([{ passengerIndex: 0, seat }], []);

    const expires = draft.seatHoldExpiresAt();
    expect(expires).not.toBeNull();
    const windowMs = new Date(expires!).getTime() - Date.now();
    expect(windowMs).toBeGreaterThan((SEAT_HOLD_MINUTES - 1) * 60 * 1000);
    expect(windowMs).toBeLessThanOrEqual(SEAT_HOLD_MINUTES * 60 * 1000 + 1000);
  });

  it('reports remaining seconds and non-expiry inside the window', () => {
    const seat = FLIGHTS[6].aircraft.seats![10];
    draft.setSeats([{ passengerIndex: 0, seat }], []);
    expect(draft.holdSecondsRemaining()).toBeGreaterThan(0);
    expect(draft.isHoldExpired()).toBe(false);
  });

  it('treats a hold past expiresAt as expired (BR-13 auto-expiry)', () => {
    const seat = FLIGHTS[6].aircraft.seats![10];
    draft.setSeats([{ passengerIndex: 0, seat }], []);
    const future = Date.now() + (SEAT_HOLD_MINUTES + 1) * 60 * 1000;
    expect(draft.isHoldExpired(future)).toBe(true);
    expect(draft.holdSecondsRemaining(future)).toBe(0);
  });

  it('releaseHold clears seats and expiry', () => {
    const seat = FLIGHTS[6].aircraft.seats![10];
    draft.setSeats([{ passengerIndex: 0, seat }], []);
    draft.releaseHold();
    expect(draft.seatHoldExpiresAt()).toBeNull();
    expect(draft.draft()?.seats).toEqual([]);
  });
});
