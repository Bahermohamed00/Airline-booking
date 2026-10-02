import { Weekday, ScheduleRuleStatus, Route, Aircraft, Airport, ScheduleRule } from '@prisma/client';
import {
  generateFlights,
  operatingDateOfFlight,
} from '../../apps/api/src/flights/flight-generator.js';
import { prisma, isoLocal } from './shared.js';

const ALL_DAYS: Weekday[] = [
  Weekday.MON,
  Weekday.TUE,
  Weekday.WED,
  Weekday.THU,
  Weekday.FRI,
  Weekday.SAT,
  Weekday.SUN,
];
const WEEKDAYS: Weekday[] = [Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI];

interface ScheduleRuleDef {
  flightNumber: string;
  origin: string;
  destination: string;
  aircraftRegistration: string;
  departureTimeLocal: string;
  operatingDays: Weekday[];
}

/**
 * NovaAir schedule rules — the single source of truth for generated flights.
 * NV100–NV107 are the daily base rotations (they adopt the Phase 1 flights);
 * NV200+ are additional weekday-pattern frequencies on existing routes.
 */
export const SCHEDULE_RULE_DEFS: ScheduleRuleDef[] = [
  {
    flightNumber: 'NV100',
    origin: 'FRA',
    destination: 'JFK',
    aircraftRegistration: 'NV-359Y',
    departureTimeLocal: '08:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV101',
    origin: 'FRA',
    destination: 'LAX',
    aircraftRegistration: 'NV-748X',
    departureTimeLocal: '09:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV102',
    origin: 'FRA',
    destination: 'SIN',
    aircraftRegistration: 'NV-748X',
    departureTimeLocal: '10:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV103',
    origin: 'FRA',
    destination: 'DXB',
    aircraftRegistration: 'NV-321B',
    departureTimeLocal: '11:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV104',
    origin: 'MUC',
    destination: 'LHR',
    aircraftRegistration: 'NV-320A',
    departureTimeLocal: '12:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV105',
    origin: 'MUC',
    destination: 'CDG',
    aircraftRegistration: 'NV-321B',
    departureTimeLocal: '13:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV106',
    origin: 'HAM',
    destination: 'AMS',
    aircraftRegistration: 'NV-320A',
    departureTimeLocal: '14:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV107',
    origin: 'JFK',
    destination: 'LAX',
    aircraftRegistration: 'NV-321B',
    departureTimeLocal: '15:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV200',
    origin: 'FRA',
    destination: 'JFK',
    aircraftRegistration: 'NV-359Y',
    departureTimeLocal: '18:30',
    operatingDays: [Weekday.MON, Weekday.WED, Weekday.FRI, Weekday.SUN],
  },
  {
    flightNumber: 'NV201',
    origin: 'FRA',
    destination: 'SIN',
    aircraftRegistration: 'NV-748X',
    departureTimeLocal: '22:15',
    operatingDays: [Weekday.TUE, Weekday.THU, Weekday.SAT],
  },
  {
    flightNumber: 'NV202',
    origin: 'MUC',
    destination: 'LHR',
    aircraftRegistration: 'NV-320A',
    departureTimeLocal: '07:15',
    operatingDays: WEEKDAYS,
  },
];

async function seedScheduleRules(
  routes: Route[],
  aircraft: Aircraft[],
  airports: Airport[],
): Promise<ScheduleRule[]> {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const effectiveFrom = new Date(baseDate);
  effectiveFrom.setDate(effectiveFrom.getDate() - 7);
  const effectiveTo = new Date(baseDate);
  effectiveTo.setDate(effectiveTo.getDate() + 358);

  const routeByPair = (origin: string, destination: string): Route => {
    const o = airports.find((a) => a.iataCode === origin)!;
    const d = airports.find((a) => a.iataCode === destination)!;
    return routes.find((r) => r.originAirportId === o.id && r.destinationAirportId === d.id)!;
  };

  const rules: ScheduleRule[] = [];
  for (const def of SCHEDULE_RULE_DEFS) {
    const route = routeByPair(def.origin, def.destination);
    const ac = aircraft.find((a) => a.registration === def.aircraftRegistration)!;
    rules.push(
      await prisma.scheduleRule.upsert({
        where: { flightNumber: def.flightNumber },
        update: {
          routeId: route.id,
          aircraftId: ac.id,
          departureTimeLocal: def.departureTimeLocal,
          operatingDays: def.operatingDays,
          effectiveFrom,
          effectiveTo,
          status: ScheduleRuleStatus.ACTIVE,
        },
        create: {
          flightNumber: def.flightNumber,
          routeId: route.id,
          aircraftId: ac.id,
          departureTimeLocal: def.departureTimeLocal,
          operatingDays: def.operatingDays,
          effectiveFrom,
          effectiveTo,
          status: ScheduleRuleStatus.ACTIVE,
        },
      }),
    );
  }
  return rules;
}

/** Links pre-Phase-3 flights to their schedule rule by (flightNumber, route). */
async function adoptExistingFlights(rules: ScheduleRule[]): Promise<number> {
  const unlinked = await prisma.flight.findMany({
    where: { scheduleRuleId: null },
    include: { route: { include: { originAirport: true } } },
  });
  let adopted = 0;
  for (const flight of unlinked) {
    const rule = rules.find(
      (r) => r.flightNumber === flight.flightNumber && r.routeId === flight.routeId,
    );
    if (!rule) continue;
    const operatingDate = operatingDateOfFlight(
      flight.departureTime,
      flight.route.originAirport.timezone,
    );
    await prisma.flight.update({
      where: { id: flight.id },
      data: { scheduleRuleId: rule.id, operatingDate: new Date(`${operatingDate}T00:00:00Z`) },
    });
    adopted++;
  }
  return adopted;
}

/** Generates the rolling 14-day flight window from the active schedule rules. */
async function seedGenerateFlights(): Promise<void> {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 13);
  const summary = await generateFlights(prisma, isoLocal(from), isoLocal(to));
  // eslint-disable-next-line no-console
  console.log(
    `Flights ${isoLocal(from)} → ${isoLocal(to)}: ${summary.flightsCreated} created, ${summary.flightsUpdated} updated; ` +
      `fares ${summary.faresCreated} created, ${summary.faresUpdated} updated; skipped rules: ${summary.skippedRules.length}`,
  );
}

export interface FlightsSeedResult {
  scheduleRules: ScheduleRule[];
  adopted: number;
}

/** Flights: schedule rules, adoption of legacy flights, and the rolling window. */
export async function seedFlights(
  routes: Route[],
  aircraft: Aircraft[],
  airports: Airport[],
): Promise<FlightsSeedResult> {
  const scheduleRules = await seedScheduleRules(routes, aircraft, airports);
  const adopted = await adoptExistingFlights(scheduleRules);
  await seedGenerateFlights();
  return { scheduleRules, adopted };
}
