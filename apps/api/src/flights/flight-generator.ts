import { CabinClass, FlightScheduleStatus, FlightStatus, PrismaClient, Weekday } from '@prisma/client';
import type { Airport, Aircraft, Route, ScheduleRule } from '@prisma/client';
import { generateSeatMap } from '../aircraft/seat-map.js';
import { formatDateInZone, zonedTimeToUtc } from './airport-time.js';

/** Prisma surface the generator needs (works for PrismaClient/PrismaService). */
export type GeneratorDb = Pick<PrismaClient, 'scheduleRule' | 'flight' | 'flightSegment' | 'fare' | '$transaction'>;

export const FARE_CURRENCY = 'EUR';
export const TAX_RATE = 0.16;
export const FEE_RATE = 0.04;
const ECONOMY_BASE_FLAT = 49;
const ECONOMY_BASE_PER_KM = 0.06;
const BUSINESS_MULTIPLIER = 3.5;
const FIRST_MULTIPLIER = 5.5;

export type RuleWithRelations = ScheduleRule & {
  route: Route & { originAirport: Airport; destinationAirport: Airport };
  aircraft: Aircraft;
};

export interface FareDraft {
  cabinClass: CabinClass;
  basePrice: number;
  taxAmount: number;
  feeAmount: number;
  availableCount: number;
}

/**
 * Deterministic fictional fare strategy: distance-based economy base with the
 * project's 16% tax / 4% fee convention, cabin multipliers, and availability
 * equal to the aircraft's cabin seat counts. No randomness anywhere.
 */
export function computeFareDrafts(distanceKm: number, capacity: number): FareDraft[] {
  const cabinSeats = new Map<CabinClass, number>();
  for (const seat of generateSeatMap(capacity)) {
    cabinSeats.set(seat.cabinClass, (cabinSeats.get(seat.cabinClass) ?? 0) + 1);
  }
  const economyBase = Math.round(ECONOMY_BASE_FLAT + distanceKm * ECONOMY_BASE_PER_KM);
  const draft = (cabinClass: CabinClass, basePrice: number): FareDraft => ({
    cabinClass,
    basePrice,
    taxAmount: Math.round(basePrice * TAX_RATE),
    feeAmount: Math.round(basePrice * FEE_RATE),
    availableCount: cabinSeats.get(cabinClass) ?? 0,
  });
  const fares = [draft(CabinClass.ECONOMY, economyBase)];
  if (cabinSeats.has(CabinClass.BUSINESS)) fares.push(draft(CabinClass.BUSINESS, Math.round(economyBase * BUSINESS_MULTIPLIER)));
  if (cabinSeats.has(CabinClass.FIRST)) fares.push(draft(CabinClass.FIRST, Math.round(economyBase * FIRST_MULTIPLIER)));
  return fares;
}

/** Inclusive calendar-date iteration over "yyyy-mm-dd" strings (UTC-anchored). */
export function calendarDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const WEEKDAY_BY_UTC_DAY: Weekday[] = [Weekday.SUN, Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI, Weekday.SAT];

/** Calendar weekday of a "yyyy-mm-dd" date (zone-independent by design). */
export function weekdayOfDate(date: string): Weekday {
  return WEEKDAY_BY_UTC_DAY[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Whether a rule operates on a calendar date: effective range + weekday. */
export function ruleOperatesOn(rule: Pick<ScheduleRule, 'operatingDays' | 'effectiveFrom' | 'effectiveTo'>, date: string): boolean {
  return date >= isoDate(rule.effectiveFrom) && date <= isoDate(rule.effectiveTo) && rule.operatingDays.includes(weekdayOfDate(date));
}

export interface GenerationSummary {
  rulesEvaluated: number;
  operatingDates: number;
  flightsCreated: number;
  flightsUpdated: number;
  segmentsCreated: number;
  segmentsUpdated: number;
  faresCreated: number;
  faresUpdated: number;
  skippedRules: Array<{ flightNumber: string; reason: string }>;
}

/**
 * Deterministic, idempotent flight generation from active schedule rules.
 * Idempotency is anchored in the database: (scheduleRuleId, operatingDate),
 * (flightId, segmentNumber) and (flightId, cabinClass) unique constraints,
 * with each operating date written in its own transaction.
 */
export async function generateFlights(db: GeneratorDb, from: string, to: string): Promise<GenerationSummary> {
  const rules = await db.scheduleRule.findMany({
    where: {
      status: 'ACTIVE',
      effectiveFrom: { lte: new Date(`${to}T00:00:00Z`) },
      effectiveTo: { gte: new Date(`${from}T00:00:00Z`) },
    },
    include: { route: { include: { originAirport: true, destinationAirport: true } }, aircraft: true },
    orderBy: { flightNumber: 'asc' },
  });

  const summary: GenerationSummary = {
    rulesEvaluated: 0,
    operatingDates: 0,
    flightsCreated: 0,
    flightsUpdated: 0,
    segmentsCreated: 0,
    segmentsUpdated: 0,
    faresCreated: 0,
    faresUpdated: 0,
    skippedRules: [],
  };

  for (const rule of rules) {
    const durationMinutes = rule.route.durationMinutes;
    if (!durationMinutes || durationMinutes <= 0) {
      summary.skippedRules.push({ flightNumber: rule.flightNumber, reason: 'route has no durationMinutes' });
      continue;
    }
    summary.rulesEvaluated++;

    for (const date of calendarDatesInRange(from, to)) {
      if (!ruleOperatesOn(rule, date)) continue;
      summary.operatingDates++;

      const departureTime = zonedTimeToUtc(date, rule.departureTimeLocal, rule.route.originAirport.timezone);
      const arrivalTime = new Date(departureTime.getTime() + durationMinutes * 60000);
      const fareDrafts = computeFareDrafts(rule.route.distanceKm ?? 0, rule.aircraft.capacity);
      const operatingDate = new Date(`${date}T00:00:00Z`);

      await db.$transaction(async (tx) => {
        const flightData = {
          flightNumber: rule.flightNumber,
          routeId: rule.routeId,
          aircraftId: rule.aircraftId,
          departureTime,
          arrivalTime,
          status: FlightStatus.SCHEDULED,
          scheduleStatus: FlightScheduleStatus.ONTIME,
        };
        const existingFlight = await tx.flight.findUnique({
          where: { scheduleRuleId_operatingDate: { scheduleRuleId: rule.id, operatingDate } },
        });
        const flight = existingFlight
          ? await tx.flight.update({ where: { id: existingFlight.id }, data: flightData })
          : await tx.flight.create({ data: { ...flightData, scheduleRuleId: rule.id, operatingDate } });
        if (existingFlight) summary.flightsUpdated++;
        else summary.flightsCreated++;

        const segmentData = {
          originAirportId: rule.route.originAirportId,
          destinationAirportId: rule.route.destinationAirportId,
          departureTime,
          arrivalTime,
        };
        const existingSegment = await tx.flightSegment.findUnique({
          where: { flightId_segmentNumber: { flightId: flight.id, segmentNumber: 1 } },
        });
        if (existingSegment) {
          await tx.flightSegment.update({ where: { id: existingSegment.id }, data: segmentData });
          summary.segmentsUpdated++;
        } else {
          await tx.flightSegment.create({ data: { ...segmentData, flightId: flight.id, segmentNumber: 1 } });
          summary.segmentsCreated++;
        }

        for (const fare of fareDrafts) {
          const fareData = {
            basePrice: fare.basePrice,
            taxAmount: fare.taxAmount,
            feeAmount: fare.feeAmount,
            availableCount: fare.availableCount,
          };
          const existingFare = await tx.fare.findUnique({
            where: { flightId_cabinClass: { flightId: flight.id, cabinClass: fare.cabinClass } },
          });
          if (existingFare) {
            await tx.fare.update({ where: { id: existingFare.id }, data: fareData });
            summary.faresUpdated++;
          } else {
            await tx.fare.create({ data: { ...fareData, flightId: flight.id, cabinClass: fare.cabinClass, currency: FARE_CURRENCY } });
            summary.faresCreated++;
          }
        }
      });
    }
  }

  return summary;
}

/** Local operating date ("yyyy-mm-dd" at the origin) of an existing flight. */
export function operatingDateOfFlight(departureTime: Date, originTimeZone: string): string {
  return formatDateInZone(departureTime, originTimeZone);
}
