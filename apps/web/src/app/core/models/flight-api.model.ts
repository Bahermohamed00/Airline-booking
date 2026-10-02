import type { Airport, FareRule, Flight } from './domain.model';

// Raw response shapes of the flights/airports REST API (apps/api). These
// mirror the NestJS view mappers, not the old mock object graph: routes nest
// originAirport/destinationAirport, fares carry fareRules (null today), and
// flight lists do not embed segments or aircraft seats.

export interface ApiAirport {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
  status: Airport['status'];
}

export interface ApiRoute {
  id: string;
  originAirportId: string;
  destinationAirportId: string;
  originAirport: ApiAirport;
  destinationAirport: ApiAirport;
  distanceKm: number | null;
  durationMinutes: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ApiAircraft {
  id: string;
  registration: string;
  model: string;
  capacity: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
}

export interface ApiFare {
  id: string;
  flightId: string;
  cabinClass: Flight['fares'][number]['cabinClass'];
  basePrice: number;
  taxAmount: number;
  feeAmount: number;
  currency: string;
  availableCount: number;
  fareRules: FareRule | null;
}

export interface ApiFlightSegment {
  id: string;
  flightId: string;
  segmentNumber: number;
  originAirportId: string;
  destinationAirportId: string;
  departureTime: string;
  arrivalTime: string;
}

export interface ApiFlight {
  id: string;
  flightNumber: string;
  routeId: string;
  aircraftId: string;
  scheduleRuleId: string | null;
  operatingDate: string | null;
  departureTime: string;
  arrivalTime: string;
  status: Flight['status'];
  scheduleStatus: Flight['scheduleStatus'];
  route: ApiRoute;
  aircraft: ApiAircraft;
  fares: ApiFare[];
  segments?: ApiFlightSegment[];
}

export function mapAirport(api: ApiAirport): Airport {
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

/** Maps the API flight view to the funnel's Flight type without inventing data. */
export function mapFlight(api: ApiFlight): Flight {
  const origin = mapAirport(api.route.originAirport);
  const destination = mapAirport(api.route.destinationAirport);
  return {
    id: api.id,
    flightNumber: api.flightNumber,
    routeId: api.routeId,
    route: {
      id: api.route.id,
      originAirportId: api.route.originAirportId,
      destinationAirportId: api.route.destinationAirportId,
      origin,
      destination,
      distanceKm: api.route.distanceKm,
      durationMinutes: api.route.durationMinutes,
      status: api.route.status,
    },
    aircraftId: api.aircraftId,
    aircraft: { ...api.aircraft, seats: [] },
    departureTime: api.departureTime,
    arrivalTime: api.arrivalTime,
    operatingDate: api.operatingDate,
    status: api.status,
    scheduleStatus: api.scheduleStatus,
    segments: (api.segments ?? []).map((s) => ({
      ...s,
      origin: s.originAirportId === origin.id ? origin : destination,
      destination: s.destinationAirportId === destination.id ? destination : origin,
    })),
    fares: api.fares.map((f) => ({
      id: f.id,
      flightId: f.flightId,
      cabinClass: f.cabinClass,
      basePrice: f.basePrice,
      taxAmount: f.taxAmount,
      feeAmount: f.feeAmount,
      currency: f.currency,
      availableCount: f.availableCount,
      rules: f.fareRules,
    })),
  };
}
