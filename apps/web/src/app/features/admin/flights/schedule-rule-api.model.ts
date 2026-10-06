import { mapApiRoute, type ApiAircraft, type ApiRoute } from '../catalog/catalog-api.model';

// Raw response shapes of the schedule-rules REST API (apps/api). Rules nest
// the catalog route view (with originAirport/destinationAirport) and the
// aircraft row; effective dates are yyyy-mm-dd strings and the departure time
// is an origin-local 'HH:mm' string, not an ISO timestamp.

export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type ScheduleRuleStatus = 'ACTIVE' | 'INACTIVE';

export interface ApiScheduleRule {
  id: string;
  flightNumber: string;
  routeId: string;
  aircraftId: string;
  departureTimeLocal: string;
  operatingDays: Weekday[];
  effectiveFrom: string;
  effectiveTo: string;
  status: ScheduleRuleStatus;
  route: ApiRoute;
  aircraft: ApiAircraft;
}

/** Flattened rule for admin tables: IATA codes and tail number resolved up front. */
export interface ScheduleRule {
  id: string;
  flightNumber: string;
  routeId: string;
  aircraftId: string;
  departureTimeLocal: string;
  operatingDays: Weekday[];
  effectiveFrom: string;
  effectiveTo: string;
  status: ScheduleRuleStatus;
  originIata: string;
  destinationIata: string;
  aircraftRegistration: string;
}

/** Matches CreateScheduleRuleDto exactly. */
export interface CreateScheduleRulePayload {
  routeId: string;
  aircraftId: string;
  flightNumber: string;
  departureTimeLocal: string;
  operatingDays: Weekday[];
  effectiveFrom: string;
  effectiveTo: string;
  status?: ScheduleRuleStatus;
}

/** Matches UpdateScheduleRuleDto: every create field optional, including status. */
export type UpdateScheduleRulePayload = Partial<CreateScheduleRulePayload>;

/** Response of POST /flights/generate — all counts come from the server. */
export interface GenerationSummary {
  rulesEvaluated: number;
  operatingDates: number;
  flightsCreated: number;
  flightsUpdated: number;
  segmentsCreated: number;
  segmentsUpdated: number;
  faresCreated: number;
  faresUpdated: number;
  skippedRules: { flightNumber: string; reason: string }[];
}

export function mapApiScheduleRule(api: ApiScheduleRule): ScheduleRule {
  const route = mapApiRoute(api.route);
  return {
    id: api.id,
    flightNumber: api.flightNumber,
    routeId: api.routeId,
    aircraftId: api.aircraftId,
    departureTimeLocal: api.departureTimeLocal,
    operatingDays: [...api.operatingDays],
    effectiveFrom: api.effectiveFrom,
    effectiveTo: api.effectiveTo,
    status: api.status,
    originIata: route.origin.iataCode,
    destinationIata: route.destination.iataCode,
    aircraftRegistration: api.aircraft.registration,
  };
}
