import type { Aircraft, Airport, Route } from './domain.model';

// Raw response shapes of the catalog REST API (apps/api): /airports, /routes,
// /aircraft. These mirror the NestJS view mappers — airport views carry
// latitude/longitude (unused by the UI), route views nest originAirport/
// destinationAirport, and aircraft views expose seatCount without seats.

export interface ApiAirport {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  status: Airport['status'];
}

export interface ApiRoute {
  id: string;
  originAirportId: string;
  destinationAirportId: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  status: Route['status'];
  originAirport: ApiAirport;
  destinationAirport: ApiAirport;
}

export interface ApiAircraft {
  id: string;
  registration: string;
  model: string;
  capacity: number;
  status: Aircraft['status'];
}

/** GET /aircraft list and detail view: the aircraft plus its configured seat count (no embedded seats). */
export type AircraftView = ApiAircraft & { seatCount: number };

/** Matches CreateAirportDto; Partial<AirportPayload> matches UpdateAirportDto. */
export interface AirportPayload {
  iataCode: string;
  icaoCode?: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  status?: Airport['status'];
}

export type AirportUpdatePayload = Partial<AirportPayload>;

/** Matches CreateRouteDto exactly. */
export interface RoutePayload {
  originAirportId: string;
  destinationAirportId: string;
  distanceKm?: number;
  durationMinutes?: number;
}

/** Matches UpdateRouteDto: every create field optional, plus status. */
export type RouteUpdatePayload = Partial<RoutePayload> & { status?: Route['status'] };

/** Matches CreateAircraftDto; Partial<AircraftPayload> matches UpdateAircraftDto. */
export interface AircraftPayload {
  registration: string;
  model: string;
  capacity: number;
  status?: Aircraft['status'];
}

export type AircraftUpdatePayload = Partial<AircraftPayload>;

/** Maps the API airport view to the domain Airport, dropping geo coordinates. */
export function mapApiAirport(api: ApiAirport): Airport {
  return {
    id: api.id,
    iataCode: api.iataCode,
    icaoCode: api.icaoCode,
    name: api.name,
    city: api.city,
    country: api.country,
    timezone: api.timezone,
    status: api.status,
  };
}

export function mapApiRoute(api: ApiRoute): Route {
  return {
    id: api.id,
    originAirportId: api.originAirportId,
    destinationAirportId: api.destinationAirportId,
    origin: mapApiAirport(api.originAirport),
    destination: mapApiAirport(api.destinationAirport),
    distanceKm: api.distanceKm,
    durationMinutes: api.durationMinutes,
    status: api.status,
  };
}

export function mapApiAircraft(api: AircraftView): Aircraft & { seatCount: number } {
  return {
    id: api.id,
    registration: api.registration,
    model: api.model,
    capacity: api.capacity,
    status: api.status,
    seatCount: api.seatCount,
  };
}
