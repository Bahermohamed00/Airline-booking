import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import { API_CONFIG } from '../config/api-config';
import type { Airport, Route, Seat } from '../models/domain.model';
import type {
  AircraftPayload,
  AircraftView,
  AirportPayload,
  ApiAirport,
  ApiRoute,
  RoutePayload,
} from '../models/catalog-api.model';

const API = 'http://api.test/api';

function apiAirport(partial: Partial<ApiAirport> = {}): ApiAirport {
  return {
    id: '9b1d4c2e-0000-4000-8000-0000000000a1',
    iataCode: 'FRA',
    icaoCode: 'EDDF',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    latitude: 50.0379,
    longitude: 8.5622,
    status: 'ACTIVE',
    ...partial,
  };
}

function apiRoute(partial: Partial<ApiRoute> = {}): ApiRoute {
  return {
    id: '9b1d4c2e-0000-4000-8000-0000000000r1',
    originAirportId: apiAirport().id,
    destinationAirportId: '9b1d4c2e-0000-4000-8000-0000000000a2',
    distanceKm: 6200,
    durationMinutes: 480,
    status: 'ACTIVE',
    originAirport: apiAirport(),
    destinationAirport: apiAirport({
      id: '9b1d4c2e-0000-4000-8000-0000000000a2',
      iataCode: 'JFK',
      icaoCode: 'KJFK',
      name: 'John F. Kennedy International Airport',
      city: 'New York',
      country: 'United States',
      timezone: 'America/New_York',
    }),
    ...partial,
  };
}

function aircraftView(partial: Partial<AircraftView> = {}): AircraftView {
  return {
    id: '9b1d4c2e-0000-4000-8000-0000000000c1',
    registration: 'NV-738Z',
    model: 'Boeing 737-800',
    capacity: 189,
    status: 'ACTIVE',
    seatCount: 189,
    ...partial,
  };
}

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: API, useRealApi: true } },
      ],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listAirports GETs /airports and drops geo coordinates', () => {
    let result: Airport[] | undefined;
    service.listAirports().subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/airports`);
    expect(req.request.method).toBe('GET');
    req.flush([apiAirport()]);

    expect(result!.length).toBe(1);
    expect(result![0]).toEqual({
      id: apiAirport().id,
      iataCode: 'FRA',
      icaoCode: 'EDDF',
      name: 'Frankfurt Airport',
      city: 'Frankfurt',
      country: 'Germany',
      timezone: 'Europe/Berlin',
      status: 'ACTIVE',
    });
    expect(result![0]).not.toHaveProperty('latitude');
    expect(result![0]).not.toHaveProperty('longitude');
  });

  it('createAirport POSTs the DTO payload to /airports and maps the response', () => {
    const payload: AirportPayload = {
      iataCode: 'FRA',
      icaoCode: 'EDDF',
      name: 'Frankfurt Airport',
      city: 'Frankfurt',
      country: 'Germany',
      timezone: 'Europe/Berlin',
    };
    let result: Airport | undefined;
    service.createAirport(payload).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/airports`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(apiAirport());

    expect(result!.iataCode).toBe('FRA');
    expect(result!).not.toHaveProperty('latitude');
  });

  it('updateAirport PATCHes /airports/:id with the partial payload', () => {
    let result: Airport | undefined;
    service.updateAirport(apiAirport().id, { status: 'INACTIVE' }).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/airports/${apiAirport().id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush(apiAirport({ status: 'INACTIVE' }));

    expect(result!.status).toBe('INACTIVE');
  });

  it('listRoutes GETs /routes and maps originAirport/destinationAirport to origin/destination', () => {
    let result: Route[] | undefined;
    service.listRoutes().subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/routes`);
    expect(req.request.method).toBe('GET');
    req.flush([apiRoute()]);

    expect(result!.length).toBe(1);
    expect(result![0].origin.iataCode).toBe('FRA');
    expect(result![0].destination.iataCode).toBe('JFK');
    expect(result![0].distanceKm).toBe(6200);
    expect(result![0]).not.toHaveProperty('originAirport');
  });

  it('createRoute POSTs the DTO payload to /routes and maps the response', () => {
    const payload: RoutePayload = {
      originAirportId: apiRoute().originAirportId,
      destinationAirportId: apiRoute().destinationAirportId,
      distanceKm: 6200,
      durationMinutes: 480,
    };
    let result: Route | undefined;
    service.createRoute(payload).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/routes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(apiRoute());

    expect(result!.origin.iataCode).toBe('FRA');
  });

  it('updateRoute PATCHes /routes/:id with the status payload', () => {
    let result: Route | undefined;
    service.updateRoute(apiRoute().id, { status: 'INACTIVE' }).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/routes/${apiRoute().id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush(apiRoute({ status: 'INACTIVE' }));

    expect(result!.status).toBe('INACTIVE');
  });

  it('listAircraft GETs /aircraft and preserves seatCount', () => {
    let result: unknown;
    service.listAircraft().subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/aircraft`);
    expect(req.request.method).toBe('GET');
    req.flush([aircraftView()]);

    const list = result as { id: string; seatCount: number }[];
    expect(list.length).toBe(1);
    expect(list[0]!.seatCount).toBe(189);
    expect(list[0]).not.toHaveProperty('seats');
  });

  it('getAircraft GETs /aircraft/:id and maps the view', () => {
    let result: unknown;
    service.getAircraft(aircraftView().id).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/aircraft/${aircraftView().id}`);
    expect(req.request.method).toBe('GET');
    req.flush(aircraftView({ status: 'MAINTENANCE' }));

    expect((result as { status: string }).status).toBe('MAINTENANCE');
    expect((result as { seatCount: number }).seatCount).toBe(189);
  });

  it('getAircraftSeats GETs /aircraft/:id/seats', () => {
    const seats: Seat[] = [
      {
        id: 's1',
        aircraftId: aircraftView().id,
        seatNumber: '1A',
        cabinClass: 'BUSINESS',
        seatRow: 1,
        seatColumn: 'A',
        isExitRow: false,
        features: {},
      },
    ];
    let result: Seat[] | undefined;
    service.getAircraftSeats(aircraftView().id).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/aircraft/${aircraftView().id}/seats`);
    expect(req.request.method).toBe('GET');
    req.flush(seats);

    expect(result).toEqual(seats);
  });

  it('createAircraft POSTs the DTO payload to /aircraft and maps the view', () => {
    const payload: AircraftPayload = {
      registration: 'NV-738Z',
      model: 'Boeing 737-800',
      capacity: 189,
    };
    let result: unknown;
    service.createAircraft(payload).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/aircraft`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.body).not.toHaveProperty('id');
    expect(req.request.body).not.toHaveProperty('seats');
    req.flush(aircraftView());

    expect((result as { seatCount: number }).seatCount).toBe(189);
  });

  it('updateAircraft PATCHes /aircraft/:id with the status payload', () => {
    let result: unknown;
    service
      .updateAircraft(aircraftView().id, { status: 'MAINTENANCE' })
      .subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/aircraft/${aircraftView().id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'MAINTENANCE' });
    req.flush(aircraftView({ status: 'MAINTENANCE' }));

    expect((result as { status: string }).status).toBe('MAINTENANCE');
  });
});
