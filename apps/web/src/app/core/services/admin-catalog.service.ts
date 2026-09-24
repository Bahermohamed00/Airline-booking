import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { AIRPORTS, AIRCRAFT, ROUTES, FLIGHTS } from '../mock/mock-data';
import { environment } from '../../../environments/environment';
import type {
  Airport, Route, Aircraft, Flight, Fare, FlightSegment, Seat,
  CabinClass, FareRule, RouteStatus, AircraftStatus, FlightStatus,
} from '../models/domain.model';

export interface CreateAirportInput {
  iataCode: string;
  icaoCode?: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
}
export type UpdateAirportInput = Partial<Pick<Airport, 'name' | 'city' | 'country' | 'timezone' | 'status'>>;

export interface CreateRouteInput {
  originAirportId: string;
  destinationAirportId: string;
  distanceKm?: number | null;
  durationMinutes?: number | null;
}
export interface UpdateRouteInput {
  distanceKm?: number | null;
  durationMinutes?: number | null;
  status?: RouteStatus;
}

export interface CreateAircraftInput {
  registration: string;
  model: string;
  capacity: number;
}
export interface UpdateAircraftInput {
  model?: string;
  capacity?: number;
  status?: AircraftStatus;
}

export interface CreateFlightInput {
  flightNumber: string;
  routeId: string;
  aircraftId: string;
  departureTime: string;
  arrivalTime: string;
  /** Seats for the default economy fare created alongside the flight. */
  economyFareSeats?: number;
}
export interface UpdateFlightInput {
  departureTime?: string;
  arrivalTime?: string;
  aircraftId?: string;
  status?: FlightStatus;
}

export interface CreateSegmentInput {
  segmentNumber: number;
  originAirportId: string;
  destinationAirportId: string;
  departureTime: string;
  arrivalTime: string;
}

export interface CreateFareInput {
  cabinClass: CabinClass;
  basePrice: number;
  taxAmount?: number;
  feeAmount?: number;
  currency: string;
  availableCount: number;
}
export interface UpdateFareInput {
  basePrice?: number;
  taxAmount?: number;
  feeAmount?: number;
  availableCount?: number;
}

// Mutable copies of the mock catalog so mock mode persists edits for the
// session, mirroring what the real API persists in the database.
const mockAirports: Airport[] = AIRPORTS.map((a) => ({ ...a }));
const mockAircraft: Aircraft[] = AIRCRAFT.map((a) => ({ ...a }));
const mockRoutes: Route[] = ROUTES.map((r) => ({ ...r }));
const mockFlights: Flight[] = FLIGHTS.map((f) => ({ ...f }));

function buildSeats(aircraftId: string, capacity: number): Seat[] {
  const seats: Seat[] = [];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  let count = 0;
  for (let row = 1; count < capacity; row++) {
    for (const col of cols) {
      if (count >= capacity) break;
      const cabin: CabinClass =
        row <= 2 && capacity >= 300 ? 'FIRST' : row <= 6 && capacity >= 220 ? 'BUSINESS' : 'ECONOMY';
      seats.push({
        id: `${aircraftId.slice(0, 8)}-s${row}${col}`,
        aircraftId,
        seatNumber: `${row}${col}`,
        cabinClass: cabin,
        seatRow: row,
        seatColumn: col,
        isExitRow: row === 12 || row === 25,
        features: {},
      });
      count++;
    }
  }
  return seats;
}

function defaultFareRules(cabin: CabinClass): FareRule {
  return cabin === 'ECONOMY'
    ? {
        refundable: false, changeAllowed: true, changeFee: 90, cancellationFeePercent: 100,
        checkedBaggagePieces: 1, checkedBaggageWeightKg: 23, carryOnPieces: 1,
        seatSelectionFee: 15, priorityBoarding: false, loungeAccess: false,
        description: 'Economy Light — changes for a fee, non-refundable.',
      }
    : {
        refundable: true, changeAllowed: true, changeFee: 0, cancellationFeePercent: 10,
        checkedBaggagePieces: 2, checkedBaggageWeightKg: 32, carryOnPieces: 2,
        seatSelectionFee: 0, priorityBoarding: true, loungeAccess: true,
        description: 'Premium fare with included seat selection and lounge access.',
      };
}

function airportById(id: string): Airport | undefined {
  return mockAirports.find((a) => a.id === id);
}

@Injectable({ providedIn: 'root' })
export class AdminCatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  /** When true, call the real NestJS admin API; otherwise mutate mock data. */
  private readonly useRealApi = environment.useRealApi;

  // ---------- Airports ----------

  listAirports(): Observable<Airport[]> {
    if (this.useRealApi) {
      return this.http.get<Airport[]>(`${this.baseUrl}/admin/airports`);
    }
    return of(mockAirports.map((a) => ({ ...a }))).pipe(delay(300));
  }

  createAirport(input: CreateAirportInput): Observable<Airport> {
    if (this.useRealApi) {
      return this.http.post<Airport>(`${this.baseUrl}/admin/airports`, {
        ...input,
        icaoCode: input.icaoCode || undefined,
      });
    }
    const airport: Airport = {
      id: crypto.randomUUID(),
      iataCode: input.iataCode,
      icaoCode: input.icaoCode || null,
      name: input.name,
      city: input.city,
      country: input.country,
      timezone: input.timezone,
      status: 'ACTIVE',
    };
    mockAirports.push(airport);
    return of({ ...airport }).pipe(delay(200));
  }

  updateAirport(id: string, patch: UpdateAirportInput): Observable<Airport> {
    if (this.useRealApi) {
      return this.http.patch<Airport>(`${this.baseUrl}/admin/airports/${id}`, patch);
    }
    const current = airportById(id);
    if (current) Object.assign(current, patch);
    return of({ ...(current ?? ({ id } as Airport)) }).pipe(delay(200));
  }

  deactivateAirport(id: string): Observable<Airport> {
    if (this.useRealApi) {
      return this.http.delete<Airport>(`${this.baseUrl}/admin/airports/${id}`);
    }
    const current = airportById(id);
    if (current) current.status = 'INACTIVE';
    return of({ ...(current ?? ({ id } as Airport)) }).pipe(delay(200));
  }

  // ---------- Routes ----------

  listRoutes(): Observable<Route[]> {
    if (this.useRealApi) {
      return this.http.get<Route[]>(`${this.baseUrl}/admin/routes`);
    }
    return of(mockRoutes.map((r) => ({ ...r }))).pipe(delay(300));
  }

  createRoute(input: CreateRouteInput): Observable<Route> {
    if (this.useRealApi) {
      return this.http.post<Route>(`${this.baseUrl}/admin/routes`, {
        originAirportId: input.originAirportId,
        destinationAirportId: input.destinationAirportId,
        distanceKm: input.distanceKm ?? undefined,
        durationMinutes: input.durationMinutes ?? undefined,
      });
    }
    const origin = airportById(input.originAirportId)!;
    const destination = airportById(input.destinationAirportId)!;
    const route: Route = {
      id: crypto.randomUUID(),
      originAirportId: origin.id,
      destinationAirportId: destination.id,
      origin,
      destination,
      distanceKm: input.distanceKm ?? null,
      durationMinutes: input.durationMinutes ?? null,
      status: 'ACTIVE',
    };
    mockRoutes.push(route);
    return of({ ...route }).pipe(delay(200));
  }

  updateRoute(id: string, patch: UpdateRouteInput): Observable<Route> {
    if (this.useRealApi) {
      return this.http.patch<Route>(`${this.baseUrl}/admin/routes/${id}`, patch);
    }
    const current = mockRoutes.find((r) => r.id === id);
    if (current) Object.assign(current, patch);
    return of({ ...(current ?? ({ id } as Route)) }).pipe(delay(200));
  }

  // ---------- Aircraft ----------

  listAircraft(): Observable<Aircraft[]> {
    if (this.useRealApi) {
      return this.http.get<Aircraft[]>(`${this.baseUrl}/admin/aircraft`);
    }
    return of(mockAircraft.map((a) => ({ ...a }))).pipe(delay(300));
  }

  createAircraft(input: CreateAircraftInput): Observable<Aircraft> {
    if (this.useRealApi) {
      return this.http.post<Aircraft>(`${this.baseUrl}/admin/aircraft`, input);
    }
    const id = crypto.randomUUID();
    const aircraft: Aircraft = {
      id,
      registration: input.registration,
      model: input.model,
      capacity: input.capacity,
      status: 'ACTIVE',
      seats: buildSeats(id, input.capacity),
    };
    mockAircraft.push(aircraft);
    return of({ ...aircraft }).pipe(delay(200));
  }

  updateAircraft(id: string, patch: UpdateAircraftInput): Observable<Aircraft> {
    if (this.useRealApi) {
      return this.http.patch<Aircraft>(`${this.baseUrl}/admin/aircraft/${id}`, patch);
    }
    const current = mockAircraft.find((a) => a.id === id);
    if (current) Object.assign(current, patch);
    return of({ ...(current ?? ({ id } as Aircraft)) }).pipe(delay(200));
  }

  // ---------- Flights ----------

  listFlights(): Observable<Flight[]> {
    if (this.useRealApi) {
      return this.http.get<Flight[]>(`${this.baseUrl}/admin/flights`);
    }
    return of(mockFlights.map((f) => ({ ...f }))).pipe(delay(250));
  }

  createFlight(input: CreateFlightInput): Observable<Flight> {
    if (this.useRealApi) {
      const fares =
        input.economyFareSeats != null
          ? [{ cabinClass: 'ECONOMY', basePrice: 129, taxAmount: 20.64, feeAmount: 5.16, currency: 'EUR', availableCount: input.economyFareSeats }]
          : undefined;
      return this.http.post<Flight>(`${this.baseUrl}/admin/flights`, {
        flightNumber: input.flightNumber,
        routeId: input.routeId,
        aircraftId: input.aircraftId,
        departureTime: input.departureTime,
        arrivalTime: input.arrivalTime,
        ...(fares ? { fares } : {}),
      });
    }
    const route = mockRoutes.find((r) => r.id === input.routeId)!;
    const aircraft = mockAircraft.find((a) => a.id === input.aircraftId)!;
    const id = crypto.randomUUID();
    const flight: Flight = {
      id,
      flightNumber: input.flightNumber,
      routeId: route.id,
      route,
      aircraftId: aircraft.id,
      aircraft,
      departureTime: input.departureTime,
      arrivalTime: input.arrivalTime,
      status: 'SCHEDULED',
      scheduleStatus: 'ONTIME',
      segments: [
        {
          id: `${id}-seg1`,
          flightId: id,
          segmentNumber: 1,
          originAirportId: route.originAirportId,
          origin: route.origin,
          destinationAirportId: route.destinationAirportId,
          destination: route.destination,
          departureTime: input.departureTime,
          arrivalTime: input.arrivalTime,
        },
      ],
      fares: [
        {
          id: `${id}-fare-economy`,
          flightId: id,
          cabinClass: 'ECONOMY',
          basePrice: 129,
          taxAmount: 20.64,
          feeAmount: 5.16,
          currency: 'EUR',
          availableCount: input.economyFareSeats ?? aircraft.capacity,
          rules: defaultFareRules('ECONOMY'),
        },
      ],
    };
    mockFlights.unshift(flight);
    return of({ ...flight }).pipe(delay(200));
  }

  updateFlight(id: string, patch: UpdateFlightInput): Observable<Flight> {
    if (this.useRealApi) {
      return this.http.patch<Flight>(`${this.baseUrl}/admin/flights/${id}`, patch);
    }
    const current = mockFlights.find((f) => f.id === id);
    if (current) {
      if (patch.departureTime) current.departureTime = patch.departureTime;
      if (patch.arrivalTime) current.arrivalTime = patch.arrivalTime;
      if (patch.aircraftId) {
        const aircraft = mockAircraft.find((a) => a.id === patch.aircraftId);
        if (aircraft) {
          current.aircraftId = aircraft.id;
          current.aircraft = aircraft;
        }
      }
      if (patch.status) {
        current.status = patch.status;
        if (patch.status === 'CANCELLED') current.scheduleStatus = 'CANCELLED';
        else if (patch.status === 'DELAYED') current.scheduleStatus = 'DELAYED';
      }
    }
    return of({ ...(current ?? ({ id } as Flight)) }).pipe(delay(200));
  }

  addSegment(flightId: string, segment: CreateSegmentInput): Observable<Flight> {
    if (this.useRealApi) {
      return this.http.post<Flight>(`${this.baseUrl}/admin/flights/${flightId}/segments`, segment);
    }
    const flight = mockFlights.find((f) => f.id === flightId);
    if (flight) {
      const origin = airportById(segment.originAirportId)!;
      const destination = airportById(segment.destinationAirportId)!;
      const seg: FlightSegment = {
        id: `${flightId}-seg${segment.segmentNumber}`,
        flightId,
        segmentNumber: segment.segmentNumber,
        originAirportId: origin.id,
        origin,
        destinationAirportId: destination.id,
        destination,
        departureTime: segment.departureTime,
        arrivalTime: segment.arrivalTime,
      };
      flight.segments = [...flight.segments, seg];
    }
    return of({ ...(flight ?? ({ id: flightId } as Flight)) }).pipe(delay(200));
  }

  // ---------- Fares ----------

  addFare(flightId: string, fare: CreateFareInput): Observable<Fare> {
    if (this.useRealApi) {
      return this.http.post<Fare>(`${this.baseUrl}/admin/flights/${flightId}/fares`, fare);
    }
    const flight = mockFlights.find((f) => f.id === flightId);
    const created: Fare = {
      id: crypto.randomUUID(),
      flightId,
      cabinClass: fare.cabinClass,
      basePrice: fare.basePrice,
      taxAmount: fare.taxAmount ?? 0,
      feeAmount: fare.feeAmount ?? 0,
      currency: fare.currency,
      availableCount: fare.availableCount,
      rules: defaultFareRules(fare.cabinClass),
    };
    if (flight) flight.fares = [...flight.fares, created];
    return of({ ...created }).pipe(delay(200));
  }

  updateFare(id: string, patch: UpdateFareInput): Observable<Fare> {
    if (this.useRealApi) {
      return this.http.patch<Fare>(`${this.baseUrl}/admin/fares/${id}`, patch);
    }
    const current = mockFlights.flatMap((f) => f.fares).find((fare) => fare.id === id);
    if (current) Object.assign(current, patch);
    return of({ ...(current ?? ({ id } as Fare)) }).pipe(delay(200));
  }

  deleteFare(id: string): Observable<void> {
    if (this.useRealApi) {
      return this.http.delete<void>(`${this.baseUrl}/admin/fares/${id}`);
    }
    for (const flight of mockFlights) {
      if (flight.fares.some((fare) => fare.id === id)) {
        flight.fares = flight.fares.filter((fare) => fare.id !== id);
        break;
      }
    }
    return of(undefined).pipe(delay(200));
  }
}
