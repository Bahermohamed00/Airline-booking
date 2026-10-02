import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, type ParamMap } from '@angular/router';
import { of } from 'rxjs';
import { FlightDetailsPage } from './flight-details.component';
import { FlightService } from '../../../core/services/flight.service';
import type { Airport, FareRule, Flight } from '../../../core/models/domain.model';

const FRA: Airport = {
  id: 'a-fra', iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany',
  timezone: 'Europe/Berlin', status: 'ACTIVE',
};
const JFK: Airport = {
  id: 'a-jfk', iataCode: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA',
  timezone: 'America/New_York', status: 'ACTIVE',
};

const RULES: FareRule = {
  refundable: true,
  changeAllowed: true,
  changeFee: 0,
  cancellationFeePercent: 10,
  checkedBaggagePieces: 2,
  checkedBaggageWeightKg: 23,
  carryOnPieces: 1,
  seatSelectionFee: 0,
  priorityBoarding: true,
  loungeAccess: false,
  description: 'Flexible economy with free changes.',
};

function flight(rules: FareRule | null): Flight {
  return {
    id: 'f1',
    flightNumber: 'NA100',
    routeId: 'r1',
    route: {
      id: 'r1', originAirportId: FRA.id, destinationAirportId: JFK.id,
      origin: FRA, destination: JFK, distanceKm: 6200, durationMinutes: 480, status: 'ACTIVE',
    },
    aircraftId: 'ac1',
    aircraft: { id: 'ac1', registration: 'D-AIXA', model: 'A350-900', capacity: 293, status: 'ACTIVE' },
    departureTime: '2026-10-01T10:00:00Z',
    arrivalTime: '2026-10-01T14:00:00Z',
    operatingDate: '2026-10-01',
    status: 'SCHEDULED',
    scheduleStatus: 'ONTIME',
    segments: [],
    fares: [
      {
        id: 'fare-eco', flightId: 'f1', cabinClass: 'ECONOMY',
        basePrice: 400, taxAmount: 60, feeAmount: 15, currency: 'EUR', availableCount: 9,
        rules,
      },
    ],
  };
}

async function setup(getFlight: ReturnType<typeof vi.fn> = vi.fn(() => of(flight(null)))) {
  const paramMap: ParamMap = convertToParamMap({ id: 'f1' });
  await TestBed.configureTestingModule({
    imports: [FlightDetailsPage],
    providers: [
      provideRouter([]),
      { provide: FlightService, useValue: { getFlight } },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(paramMap), snapshot: { paramMap } },
      },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<FlightDetailsPage> = TestBed.createComponent(FlightDetailsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, getFlight };
}

describe('FlightDetailsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the flight and the real fare price split without invented benefits when rules are null', async () => {
    const { el, getFlight } = await setup();
    expect(getFlight).toHaveBeenCalledWith('f1');

    expect(el.querySelector('h1')?.textContent).toContain('FRA → JFK');
    expect(el.textContent).toContain('NA100');
    expect(el.textContent).toContain('A350-900');

    const fare = el.querySelector('.fare');
    expect(fare).not.toBeNull();
    expect(fare!.querySelector('h3')?.textContent).toContain('Economy');

    const breakdown = fare!.querySelector('.fare__breakdown')!.textContent!;
    expect(breakdown).toContain('Base fare');
    expect(breakdown).toContain('Taxes');
    expect(breakdown).toContain('Fees');
    expect(breakdown).toContain('Total per adult');
    // base 400 + tax 60 + fee 15
    expect(breakdown).toContain('475');

    // rules is null from the real API: no rules list, no refundable/benefit badges
    expect(fare!.querySelector('.fare__rules')).toBeNull();
    expect(fare!.textContent).not.toContain('Refundable');
    expect(fare!.textContent).not.toContain('Priority boarding');
    expect(fare!.textContent).not.toContain('checked bag');
    expect(fare!.textContent).toContain('Continue with this fare');
  });

  it('renders the rules and badges only when the API provides fare rules', async () => {
    const { el } = await setup(vi.fn(() => of(flight(RULES))));

    const fare = el.querySelector('.fare')!;
    expect(fare.querySelector('.fare__rules')).not.toBeNull();
    expect(fare.textContent).toContain('Flexible economy with free changes.');
    expect(fare.textContent).toContain('Refundable');
    expect(fare.textContent).toContain('Priority boarding');
    expect(fare.textContent).toContain('2× checked bag up to 23 kg + 1× carry-on');
  });

  it('shows a not-found state with a way back when the flight does not exist', async () => {
    const { el } = await setup(vi.fn(() => of(undefined)));

    expect(el.textContent).toContain('Flight not found');
    const empty = el.querySelector('na-empty-state');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('Back to search');
    expect(el.querySelector('.fare')).toBeNull();
  });
});
