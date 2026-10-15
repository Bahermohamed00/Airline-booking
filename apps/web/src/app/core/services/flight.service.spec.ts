import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FlightService, sortAlternatives } from './flight.service';
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
    publicNumber: 100,
    tripType: 'ONE_WAY',
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

  it('updateFlightStatus PATCHes /flights/:id/status and maps the response', () => {
    let result: unknown;
    service.updateFlightStatus('f1', 'BOARDING').subscribe((r) => (result = r));
    const req = http.expectOne('http://api.test/api/flights/f1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'BOARDING' });
    req.flush(apiFlight({ status: 'BOARDING' }));
    expect((result as { status: string }).status).toBe('BOARDING');
  });

  it('updateFlight PATCHes /flights/:id with the time payload and maps the response', () => {
    let result: unknown;
    const payload = { departureTime: '2026-10-05T13:00:00.000Z', arrivalTime: '2026-10-05T15:00:00.000Z' };
    service.updateFlight('f1', payload).subscribe((r) => (result = r));
    const req = http.expectOne('http://api.test/api/flights/f1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush(apiFlight());
    expect((result as { id: string }).id).toBe('f1');
  });

  it('createFlight POSTs /flights with the explicit flight number and maps the response', () => {
    let result: unknown;
    const payload = {
      routeId: 'r1',
      aircraftId: 'ac1',
      departureDate: '2026-10-07',
      departureTime: '10:00',
      arrivalDate: '2026-10-07',
      arrivalTime: '13:30',
      flightNumber: 'NV720',
      price: 250,
    };
    service.createFlight(payload).subscribe((r) => (result = r));
    const req = http.expectOne('http://api.test/api/flights');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(apiFlight({ flightNumber: 'NV720' }));
    expect((result as { flightNumber: string }).flightNumber).toBe('NV720');
  });

  it('adminFlights sends only the provided filters as query params (id stays available for internal use)', () => {
    service.adminFlights({ id: 'f1', flightNumber: 'NV1', status: 'COMPLETED', from: '2026-10-01', to: '2026-10-07' }).subscribe();
    const req = http.expectOne('http://api.test/api/flights?id=f1&flightNumber=NV1&status=COMPLETED&from=2026-10-01&to=2026-10-07');
    expect(req.request.method).toBe('GET');
    req.flush([]);

    service.adminFlights({ flightNumber: 'NV100' }).subscribe();
    const bare = http.expectOne('http://api.test/api/flights?flightNumber=NV100');
    bare.flush([]);

    service.adminFlights().subscribe();
    const none = http.expectOne('http://api.test/api/flights');
    none.flush([]);
  });

  it('findAlternatives queries ±3 days on the same route, excludes the exact date, and returns the closest first', () => {
    let result: unknown;
    service.findAlternatives(CRITERIA).subscribe((r) => (result = r));

    const req = http.expectOne(
      'http://api.test/api/flights?origin=FRA&destination=JFK&from=2026-09-28&to=2026-10-04',
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      apiFlight({ id: 'exact', operatingDate: '2026-10-01' }), // excluded — the searched date
      apiFlight({ id: 'plus2', operatingDate: '2026-10-03' }),
      apiFlight({ id: 'minus1', operatingDate: '2026-09-30' }),
      apiFlight({ id: 'plus1', operatingDate: '2026-10-02' }),
      // The ±3-day window is enforced by the from/to query params server-side;
      // the API never returns out-of-window flights.
      apiFlight({ id: 'cancelled', operatingDate: '2026-10-02', status: 'CANCELLED' }), // unbookable
    ]);

    const flights = result as { id: string }[];
    expect(flights.map((f) => f.id)).toEqual(['minus1', 'plus1', 'plus2']);
  });

  it('sortAlternatives orders by absolute day distance then departure time', () => {
    const f = (id: string, operatingDate: string, departureTime: string) =>
      ({ id, operatingDate, departureTime }) as never;

    const sorted = sortAlternatives(
      [
        f('b-late', '2026-10-03', '2026-10-03T18:00:00Z'),
        f('a-early', '2026-10-03', '2026-10-03T07:00:00Z'),
        f('minus1', '2026-09-30', '2026-09-30T12:00:00Z'),
        f('plus3', '2026-10-04', '2026-10-04T12:00:00Z'),
        f('same-day', '2026-10-01', '2026-10-01T06:00:00Z'),
      ],
      '2026-10-01',
    );

    expect(sorted.map((x: { id: string }) => x.id)).toEqual([
      'same-day', // offset 0
      'minus1', // offset 1
      'a-early', // offset 2, earlier time first
      'b-late', // offset 2
      'plus3', // offset 3
    ]);
  });
});
