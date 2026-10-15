import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BookingDraftService } from './booking-draft.service';
import { FLIGHTS } from '../../../core/mock/mock-data';
import type { SearchCriteria } from '../../../core/models/booking-flow.model';

const criteria: SearchCriteria = {
  tripType: 'ONE_WAY',
  originCode: 'FRA',
  destinationCode: 'JFK',
  departureDate: '2026-10-01',
  passengers: { adults: 1, children: 0, infants: 0 },
  cabinClass: 'ECONOMY',
};

describe('BookingDraftService offer carry (BR-16)', () => {
  let draft: BookingDraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    draft = TestBed.inject(BookingDraftService);
    draft.clear();
  });

  it('carries the offerId from the search criteria into the draft', () => {
    draft.start({ ...criteria, offerId: 'offer-42' }, FLIGHTS[6], FLIGHTS[6].fares[0]);

    expect(draft.offerId()).toBe('offer-42');
    expect(draft.draft()?.offerId).toBe('offer-42');
  });

  it('starts with no offer when the criteria carries none', () => {
    draft.start(criteria, FLIGHTS[6], FLIGHTS[6].fares[0]);

    expect(draft.offerId()).toBeNull();
    expect(draft.draft()?.offerId).toBeNull();
  });

  it('clearOffer drops the offer from the draft and its criteria so a fare re-selection cannot resurrect it', () => {
    draft.start({ ...criteria, offerId: 'offer-42' }, FLIGHTS[6], FLIGHTS[6].fares[0]);

    draft.clearOffer();

    expect(draft.offerId()).toBeNull();
    expect(draft.draft()?.criteria.offerId).toBeNull();

    // A fresh start from the same (already cleared) criteria stays offerless.
    draft.start(draft.draft()!.criteria, FLIGHTS[6], FLIGHTS[6].fares[0]);
    expect(draft.offerId()).toBeNull();
  });

  it('a new start with different criteria replaces any previous offer', () => {
    draft.start({ ...criteria, offerId: 'offer-42' }, FLIGHTS[6], FLIGHTS[6].fares[0]);
    draft.start(criteria, FLIGHTS[7], FLIGHTS[7].fares[0]);

    expect(draft.offerId()).toBeNull();
  });
});
