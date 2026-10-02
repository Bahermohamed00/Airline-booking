import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FlightService } from './flight.service';
import { API_CONFIG } from '../config/api-config';
import type { SearchCriteria } from '../models/booking-flow.model';

const CRITERIA: SearchCriteria = {
  tripType: 'ONE_WAY',
  originCode: 'FRA',
  destinationCode: 'JFK',
  departureDate: '2026-10-01',
  passengers: { adults: 1, children: 0, infants: 0 },
  cabinClass: 'ECONOMY',
};

const AIRPORT = {
  id: 'a1',
  iataCode: 'FRA',
  icaoCode: 'EDDF',
  name: 'Frankfurt Airport',
  city: 'Frankfurt',
  country: 'Germany',
  timezone: 'Europe/Berlin',
  status: 'ACTIVE',
};

function apiFlight(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    flightNumber: 'NV100',
    routeId: 'r1',
    aircraftId: 'ac1',
    scheduleRuleId: null,
    operatingDate: '2026-10-01',
    departureTime: '2026-10-01T06:00:00Z',
    arrivalTime: '2026-10-01T14:00:00Z',
    status: 'SCHEDULED',
    scheduleStatus: 'ONTIME',
    route: {
      id: 'r1',
      originAirportId: 'a1',
      destinationAirportId: 'a2',
      originAirport: AIRPORT,
      destinationAirport: { ...AIRPORT, id: 'a2', iataCode: 'JFK', name: 'JFK International' },
      distanceKm: 6201,
      durationMinutes: 505,
      status: 'ACTIVE',
    },
    aircraft: {
      id: 'ac1',
      registration: 'NV-320A',
      model: 'Airbus A320-200',
      capacity: 180,
      status: 'ACTIVE',
    },
    fares: [
      {
        id: 'fare1',
        flightId: 'f1',
        cabinClass: 'ECONOMY',
        basePrice: 421,
        taxAmount: 67,
        feeAmount: 17,
        currency: 'EUR',
        availableCount: 24,
        fareRules: null,
      },
    ],
    ...overrides,
  };
}

describe('FlightService', () => {
  let service: FlightService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/api', useRealApi: true } },
      ],
    });
    service = TestBed.inject(FlightService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listAirports GETs /airports, keeps ACTIVE and sorts by IATA', () => {
    let result: unknown;
    service.listAirports().subscribe((r) => (result = r));

    const req = http.expectOne('http://api.test/api/airports');
    expect(req.request.method).toBe('GET');
    req.flush([
      { ...AIRPORT, iataCode: 'MUC', id: 'a3' },
      { ...AIRPORT, iataCode: 'XXX', id: 'a4', status: 'INACTIVE' },
      AIRPORT,
    ]);
    expect((result as { iataCode: string }[]).map((a) => a.iataCode)).toEqual(['FRA', 'MUC']);
  });

  it('searchFlights GETs /flights with origin/destination/date and maps the response', () => {
    let result: unknown;
    service.searchFlights(CRITERIA).subscribe((r) => (result = r));

    const req = http.expectOne(
      'http://api.test/api/flights?origin=FRA&destination=JFK&date=2026-10-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush([apiFlight()]);

    const [flight] = result as import('../models/domain.model').Flight[];
    expect(flight.flightNumber).toBe('NV100');
    expect(flight.route.origin.iataCode).toBe('FRA');
    expect(flight.route.destination.iataCode).toBe('JFK');
    expect(flight.fares[0]!.rules).toBeNull();
    expect(flight.operatingDate).toBe('2026-10-01');
  });

  it('searchFlights filters out unbookable flights and cabins without availability', () => {
    let result: unknown;
    service.searchFlights(CRITERIA).subscribe((r) => (result = r));

    http
      .expectOne('http://api.test/api/flights?origin=FRA&destination=JFK&date=2026-10-01')
      .flush([
        apiFlight({ id: 'ok' }),
        apiFlight({ id: 'cancelled', status: 'CANCELLED' }),
        apiFlight({ id: 'no-seats', fares: [{ ...apiFlight().fares[0], availableCount: 0 }] }),
      ]);
    expect((result as { id: string }[]).map((f) => f.id)).toEqual(['ok']);
  });

  it('adjacentDateAvailability issues one from/to range query and buckets per operating date', () => {
    let result: unknown;
    service.adjacentDateAvailability(CRITERIA).subscribe((r) => (result = r));

    const req = http.expectOne(
      'http://api.test/api/flights?origin=FRA&destination=JFK&from=2026-09-28&to=2026-10-04',
    );
    expect(req.request.params.get('from')).toBe('2026-09-28');
    expect(req.request.params.get('to')).toBe('2026-10-04');
    req.flush([apiFlight()]);

    const days = result as { date: string; minPrice: number | null }[];
    expect(days).toHaveLength(7);
    expect(days.find((d) => d.date === '2026-10-01')!.minPrice).toBe(505);
    expect(days.find((d) => d.date === '2026-09-30')!.minPrice).toBeNull();
  });

  it('getFlight GETs /flights/:id and returns undefined on 404', () => {
    let result: unknown;
    service.getFlight('f1').subscribe((r) => (result = r));
    http.expectOne('http://api.test/api/flights/f1').flush(apiFlight());
    expect((result as { id: string }).id).toBe('f1');

    let missing: unknown = 'unset';
    service.getFlight('nope').subscribe((r) => (missing = r));
    http
      .expectOne('http://api.test/api/flights/nope')
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(missing).toBeUndefined();
  });

  it('flightStatusByRoute GETs with uppercased IATA params', () => {
    service.flightStatusByRoute('fra', 'jfk').subscribe();
    const req = http.expectOne('http://api.test/api/flights?origin=FRA&destination=JFK');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
