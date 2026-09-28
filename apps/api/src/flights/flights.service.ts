import { Injectable } from '@nestjs/common';
import { AirportStatus, FlightStatus, Prisma, RouteStatus } from '@prisma/client';
import type { Airport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AirportSearchQueryDto } from './dto/airport-search-query.dto.js';
import type { DestinationsQueryDto } from './dto/destinations-query.dto.js';
import type { FlightSearchQueryDto } from './dto/flight-search-query.dto.js';

const airportSelect = {
  id: true,
  iataCode: true,
  icaoCode: true,
  name: true,
  city: true,
  country: true,
  timezone: true,
  status: true,
} satisfies Prisma.AirportSelect;

type AirportRow = Pick<Airport, keyof typeof airportSelect>;

const flightInclude = {
  route: {
    include: {
      originAirport: { select: airportSelect },
      destinationAirport: { select: airportSelect },
    },
  },
  aircraft: true,
  segments: {
    orderBy: { segmentNumber: 'asc' },
    include: {
      originAirport: { select: airportSelect },
      destinationAirport: { select: airportSelect },
    },
  },
  fares: true,
} satisfies Prisma.FlightInclude;

type FlightWithRelations = Prisma.FlightGetPayload<{ include: typeof flightInclude }>;

const BOOKABLE_STATUSES: FlightStatus[] = [FlightStatus.SCHEDULED, FlightStatus.ACTIVE, FlightStatus.DELAYED];

// fareRules is nullable Json in the schema and not populated by the seed; the
// frontend contract requires a rules object on every fare.
export const DEFAULT_FARE_RULES = {
  refundable: false,
  changeAllowed: false,
  changeFee: 0,
  cancellationFeePercent: 100,
  checkedBaggagePieces: 1,
  checkedBaggageWeightKg: 23,
  carryOnPieces: 1,
  seatSelectionFee: 0,
  priorityBoarding: false,
  loungeAccess: false,
  description: 'Standard fare',
};

@Injectable()
export class FlightsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAirports(query: AirportSearchQueryDto): Promise<AirportRow[]> {
    const q = query.q?.trim();
    const where: Prisma.AirportWhereInput = { status: AirportStatus.ACTIVE };
    if (q) {
      where.OR = [
        { iataCode: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.airport.findMany({
      where,
      select: airportSelect,
      orderBy: [{ city: 'asc' }, { iataCode: 'asc' }],
      take: 15,
    });
  }

  async searchDestinations(query: DestinationsQueryDto): Promise<AirportRow[]> {
    const q = query.q?.trim();
    const destinationFilter: Prisma.AirportWhereInput = { status: AirportStatus.ACTIVE };
    if (q) {
      destinationFilter.OR = [
        { iataCode: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
      ];
    }
    const routes = await this.prisma.route.findMany({
      where: {
        status: RouteStatus.ACTIVE,
        originAirport: { iataCode: query.from, status: AirportStatus.ACTIVE },
        destinationAirport: destinationFilter,
      },
      select: { destinationAirport: { select: airportSelect } },
      orderBy: { destinationAirport: { city: 'asc' } },
      take: 50,
    });
    return routes.map((r) => r.destinationAirport);
  }

  async searchFlights(query: FlightSearchQueryDto) {
    const flights = await this.prisma.flight.findMany({
      where: this.flightWhere(query),
      include: flightInclude,
      orderBy: { departureTime: 'asc' },
      take: 50,
    });
    return flights.map((f) => this.toFlightResponse(f));
  }

  async getFlight(id: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: flightInclude,
    });
    return flight ? this.toFlightResponse(flight) : null;
  }

  private flightWhere(query: FlightSearchQueryDto): Prisma.FlightWhereInput {
    const where: Prisma.FlightWhereInput = {
      status: { in: BOOKABLE_STATUSES },
      route: {
        status: RouteStatus.ACTIVE,
        originAirport: { iataCode: query.from },
        destinationAirport: { iataCode: query.to },
      },
    };
    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      where.departureTime = { gte: dayStart, lt: dayEnd };
    }
    if (query.cabin) {
      where.fares = { some: { cabinClass: query.cabin, availableCount: { gt: 0 } } };
    }
    return where;
  }

  // Shapes a Prisma flight row into the frontend's domain contract: routes and
  // segments expose origin/destination (not originAirport/...), Decimal prices
  // become numbers, and nullable fareRules get a default.
  private toFlightResponse(f: FlightWithRelations) {
    return {
      id: f.id,
      flightNumber: f.flightNumber,
      routeId: f.routeId,
      route: {
        id: f.route.id,
        originAirportId: f.route.originAirportId,
        destinationAirportId: f.route.destinationAirportId,
        origin: f.route.originAirport,
        destination: f.route.destinationAirport,
        distanceKm: f.route.distanceKm,
        durationMinutes: f.route.durationMinutes,
        status: f.route.status,
      },
      aircraftId: f.aircraftId,
      aircraft: {
        id: f.aircraft.id,
        registration: f.aircraft.registration,
        model: f.aircraft.model,
        capacity: f.aircraft.capacity,
        status: f.aircraft.status,
        seats: [],
      },
      departureTime: f.departureTime.toISOString(),
      arrivalTime: f.arrivalTime.toISOString(),
      status: f.status,
      scheduleStatus: f.scheduleStatus,
      segments: f.segments.map((s) => ({
        id: s.id,
        flightId: s.flightId,
        segmentNumber: s.segmentNumber,
        originAirportId: s.originAirportId,
        origin: s.originAirport,
        destinationAirportId: s.destinationAirportId,
        destination: s.destinationAirport,
        departureTime: s.departureTime.toISOString(),
        arrivalTime: s.arrivalTime.toISOString(),
      })),
      fares: f.fares.map((fare) => ({
        id: fare.id,
        flightId: fare.flightId,
        cabinClass: fare.cabinClass,
        basePrice: fare.basePrice.toNumber(),
        taxAmount: fare.taxAmount.toNumber(),
        feeAmount: fare.feeAmount.toNumber(),
        currency: fare.currency,
        availableCount: fare.availableCount,
        rules: fare.fareRules ?? DEFAULT_FARE_RULES,
      })),
    };
  }
}
