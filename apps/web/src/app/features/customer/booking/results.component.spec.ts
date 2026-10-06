import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, type ParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ResultsPage } from './results.component';
import { FlightService } from '../../../core/services/flight.service';
import type { Airport, Flight } from '../../../core/models/domain.model';

const FRA: Airport = {
  id: 'a-fra',
  iataCode: 'FRA',
  name: 'Frankfurt Airport',
  city: 'Frankfurt',
  country: 'Germany',
  timezone: 'Europe/Berlin',
  status: 'ACTIVE',
};
const JFK: Airport = {
  id: 'a-jfk',
  iataCode: 'JFK',
  name: 'John F. Kennedy International',
  city: 'New York',
  country: 'USA',
  timezone: 'America/New_York',
  status: 'ACTIVE',
};

function flight(overrides: Partial<Flight> = {}): Flight {
  return {
    id: 'f1',
    flightNumber: 'NA100',
    routeId: 'r1',
    route: {
      id: 'r1',
      originAirportId: FRA.id,
      destinationAirportId: JFK.id,
      origin: FRA,
      destination: JFK,
      distanceKm: 6200,
      durationMinutes: 480,
      status: 'ACTIVE',
    },
    aircraftId: 'ac1',
    aircraft: {
      id: 'ac1',
      registration: 'D-AIXA',
      model: 'A350-900',
      capacity: 293,
      status: 'ACTIVE',
    },
    departureTime: '2026-10-01T10:00:00Z',
    arrivalTime: '2026-10-01T14:00:00Z',
    operatingDate: '2026-10-01',
    status: 'SCHEDULED',
    scheduleStatus: 'ONTIME',
    segments: [],
    fares: [
      {
        id: 'fare-eco',
        flightId: 'f1',
        cabinClass: 'ECONOMY',
        basePrice: 400,
        taxAmount: 60,
        feeAmount: 15,
        currency: 'EUR',
        availableCount: 9,
        rules: null,
      },
    ],
    ...overrides,
  };
}

const PARAMS: Record<string, string> = {
  tripType: 'ONE_WAY',
  origin: 'FRA',
  destination: 'JFK',
  depart: '2026-10-01',
  adults: '2',
  children: '1',
  infants: '0',
  cabin: 'ECONOMY',
};

interface SetupOptions {
  searchFlights?: ReturnType<typeof vi.fn>;
  params?: Record<string, string>;
}

async function setup(opts: SetupOptions = {}) {
  const paramMap: ParamMap = convertToParamMap(opts.params ?? PARAMS);
  const flightsApi = {
    searchFlights: opts.searchFlights ?? vi.fn(() => of([flight()])),
    adjacentDateAvailability: vi.fn(() => of([{ date: '2026-10-01', minPrice: 475 }])),
  };

  await TestBed.configureTestingModule({
    imports: [ResultsPage],
    providers: [
      provideRouter([]),
      { provide: FlightService, useValue: flightsApi },
      {
        provide: ActivatedRoute,
        useValue: { queryParamMap: of(paramMap), snapshot: { queryParamMap: paramMap } },
      },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ResultsPage> = TestBed.createComponent(ResultsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, flightsApi };
}

describe('ResultsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('searches with criteria derived from the query params and renders the flight card', async () => {
    const { el, flightsApi } = await setup();

    expect(flightsApi.searchFlights).toHaveBeenCalledWith(
      expect.objectContaining({
        tripType: 'ONE_WAY',
        originCode: 'FRA',
        destinationCode: 'JFK',
        departureDate: '2026-10-01',
        cabinClass: 'ECONOMY',
        passengers: { adults: 2, children: 1, infants: 0 },
      }),
    );
    expect(flightsApi.adjacentDateAvailability).toHaveBeenCalledOnce();

    const card = el.querySelector('.cards .card');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('NA100');
    expect(card!.textContent).toContain('A350-900');
    expect(card!.textContent).toContain('FRA');
    expect(card!.textContent).toContain('JFK');
    expect(card!.textContent).toContain('Nonstop');
    // Real fare total = base + tax + fee = 400 + 60 + 15
    expect(card!.querySelector('.card__price')?.textContent).toContain('475');
    // rules is null from the real API — no baggage/rule claims may be rendered
    expect(card!.textContent).not.toContain('checked bag');
    expect(card!.textContent).not.toContain('Refundable');
  });

  it('shows a retryable error state when the flight search fails', async () => {
    const searchFlights = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('unavailable')))
      .mockReturnValue(of([flight()]));
    const { fixture, el, flightsApi } = await setup({ searchFlights });

    expect(el.textContent).toContain("We couldn't load flights for this route");
    expect(el.querySelector('na-alert .alert__retry')).not.toBeNull();

    (el.querySelector('na-alert .alert__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(flightsApi.searchFlights).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.cards .card')).not.toBeNull();
  });

  it('shows an empty state when no flights match', async () => {
    const { el } = await setup({ searchFlights: vi.fn(() => of([])) });

    expect(el.textContent).toContain('No flights match your search');
    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.querySelector('.cards .card')).toBeNull();
  });

  it('notes that round-trip booking is unavailable and shows outbound results only', async () => {
    const { el } = await setup({
      params: { ...PARAMS, tripType: 'ROUND_TRIP', return: '2026-10-08' },
    });

    expect(el.textContent).toContain("Round-trip booking isn't available yet");
    expect(el.querySelector('.cards .card')).not.toBeNull();
  });
});
