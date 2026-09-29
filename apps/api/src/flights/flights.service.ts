import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AirportStatus,
  FlightStatus,
  Prisma,
  RouteStatus,
} from '@prisma/client';
import type { Airport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapFlight } from './flight-response.mapper.js';
import type { AirportSearchQueryDto } from './dto/airport-search-query.dto.js';
import type { DestinationsQueryDto } from './dto/destinations-query.dto.js';
import type { FlightSearchQueryDto } from './dto/flight-search-query.dto.js';
import type { SearchFlightsDto } from './dto/search-flights.dto.js';

const FLIGHT_INCLUDE = {
  route: { include: { originAirport: true, destinationAirport: true } },
  aircraft: { include: { seats: true } },
  segments: {
    include: { originAirport: true, destinationAirport: true },
    orderBy: { segmentNumber: 'asc' as const },
  },
  fares: true,
} satisfies Prisma.FlightInclude;

const BOOKABLE_STATUSES: FlightStatus[] = [
  FlightStatus.SCHEDULED,
  FlightStatus.ACTIVE,
  FlightStatus.DELAYED,
];
type FlightResponse = ReturnType<typeof mapFlight>;

@Injectable()
export class FlightsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async searchAirports(query?: string): Promise<Airport[]> {
    const q = query?.trim();
    return this.prisma.airport.findMany({
      where: {
        status: AirportStatus.ACTIVE,
        ...(q
          ? {
              OR: [
                { iataCode: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ city: 'asc' }, { iataCode: 'asc' }],
      take: 20,
    });
  }

  async searchDestinations(query: DestinationsQueryDto): Promise<Airport[]> {
    const q = query.q?.trim();
    const destinationFilter: Prisma.AirportWhereInput = {
      status: AirportStatus.ACTIVE,
      ...(q
        ? {
            OR: [
              { iataCode: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { country: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const routes = await this.prisma.route.findMany({
      where: {
        status: RouteStatus.ACTIVE,
        originAirport: { iataCode: query.from, status: AirportStatus.ACTIVE },
        destinationAirport: destinationFilter,
      },
      select: { destinationAirport: true },
      orderBy: { destinationAirport: { city: 'asc' } },
      take: 50,
    });
    return routes.map((route) => route.destinationAirport);
  }

  async searchFlights(query: FlightSearchQueryDto): Promise<FlightResponse[]> {
    const where: Prisma.FlightWhereInput = {
      status: { in: BOOKABLE_STATUSES },
      route: {
        status: RouteStatus.ACTIVE,
        originAirport: { iataCode: query.from, status: AirportStatus.ACTIVE },
        destinationAirport: {
          iataCode: query.to,
          status: AirportStatus.ACTIVE,
        },
      },
    };
    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      where.departureTime = {
        gte: start,
        lt: new Date(start.getTime() + 86_400_000),
      };
    }
    if (query.cabin)
      where.fares = {
        some: { cabinClass: query.cabin, availableCount: { gt: 0 } },
      };

    const flights = await this.prisma.flight.findMany({
      where,
      include: FLIGHT_INCLUDE,
      orderBy: { departureTime: 'asc' },
      take: 50,
    });
    return flights.map(mapFlight);
  }

  async searchAdvanced(dto: SearchFlightsDto): Promise<FlightResponse[]> {
    const start = new Date(`${dto.depart}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86_400_000);
    const flights = await this.prisma.flight.findMany({
      where: {
        status: { in: BOOKABLE_STATUSES },
        departureTime: { gte: start, lt: end },
        route: {
          status: RouteStatus.ACTIVE,
          originAirport: {
            iataCode: dto.origin.toUpperCase(),
            status: AirportStatus.ACTIVE,
          },
          destinationAirport: {
            iataCode: dto.destination.toUpperCase(),
            status: AirportStatus.ACTIVE,
          },
        },
        fares: { some: { cabinClass: dto.cabin, availableCount: { gt: 0 } } },
      },
      include: FLIGHT_INCLUDE,
      orderBy: { departureTime: 'asc' },
    });
    return this.applySort(this.applyFilters(flights.map(mapFlight), dto), dto);
  }

  async adjacentDates(
    dto: Pick<SearchFlightsDto, 'origin' | 'destination' | 'depart' | 'cabin'>,
  ) {
    const base = new Date(`${dto.depart}T00:00:00.000Z`);
    const days: { date: string; minPrice: number | null }[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const day = new Date(base);
      day.setUTCDate(day.getUTCDate() + offset);
      const date = day.toISOString().slice(0, 10);
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 86_400_000);
      const flights = await this.prisma.flight.findMany({
        where: {
          status: { not: FlightStatus.CANCELLED },
          departureTime: { gte: start, lt: end },
          route: {
            status: RouteStatus.ACTIVE,
            originAirport: {
              iataCode: dto.origin.toUpperCase(),
              status: AirportStatus.ACTIVE,
            },
            destinationAirport: {
              iataCode: dto.destination.toUpperCase(),
              status: AirportStatus.ACTIVE,
            },
          },
        },
        include: { fares: { where: { cabinClass: dto.cabin } } },
      });
      const prices = flights.flatMap((flight) =>
        flight.fares.map(
          (fare) =>
            Number(fare.basePrice) +
            Number(fare.taxAmount) +
            Number(fare.feeAmount),
        ),
      );
      days.push({ date, minPrice: prices.length ? Math.min(...prices) : null });
    }
    return days;
  }

  async getFlight(id: string): Promise<FlightResponse> {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: FLIGHT_INCLUDE,
    });
    if (!flight) throw new NotFoundException('Flight not found');
    return mapFlight(flight);
  }

  async statusByNumber(
    flightNumber: string,
    date?: string,
  ): Promise<FlightResponse[]> {
    const where: Prisma.FlightWhereInput = {
      flightNumber: { contains: flightNumber.trim(), mode: 'insensitive' },
    };
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      where.departureTime = {
        gte: start,
        lt: new Date(start.getTime() + 86_400_000),
      };
    }
    const flights = await this.prisma.flight.findMany({
      where,
      include: FLIGHT_INCLUDE,
      orderBy: { departureTime: 'asc' },
      take: 20,
    });
    return flights.map(mapFlight);
  }

  async statusByRoute(
    origin: string,
    destination: string,
  ): Promise<FlightResponse[]> {
    const flights = await this.prisma.flight.findMany({
      where: {
        route: {
          originAirport: { iataCode: origin.toUpperCase() },
          destinationAirport: { iataCode: destination.toUpperCase() },
        },
      },
      include: FLIGHT_INCLUDE,
      orderBy: { departureTime: 'asc' },
      take: 20,
    });
    return flights.map(mapFlight);
  }

  private applyFilters(
    flights: FlightResponse[],
    dto: SearchFlightsDto,
  ): FlightResponse[] {
    return flights.filter((flight) => {
      const fare =
        flight.fares.find((item) => item.cabinClass === dto.cabin) ??
        flight.fares[0];
      if (!fare) return false;
      const total = fare.basePrice + fare.taxAmount + fare.feeAmount;
      if (dto.maxPrice != null && total > dto.maxPrice) return false;
      if (dto.refundableOnly === 'true' && !fare.rules.refundable) return false;
      if (dto.departureWindow) {
        const hour = new Date(flight.departureTime).getHours();
        const inWindow =
          dto.departureWindow === 'morning'
            ? hour < 12
            : dto.departureWindow === 'afternoon'
              ? hour >= 12 && hour < 18
              : hour >= 18;
        if (!inWindow) return false;
      }
      return dto.stops !== 'nonstop' || flight.segments.length <= 1;
    });
  }

  private fareTotal(flight: FlightResponse, cabin: string): number {
    const fare =
      flight.fares.find((item) => item.cabinClass === cabin) ?? flight.fares[0];
    return fare
      ? fare.basePrice + fare.taxAmount + fare.feeAmount
      : Number.POSITIVE_INFINITY;
  }

  private applySort(
    flights: FlightResponse[],
    dto: SearchFlightsDto,
  ): FlightResponse[] {
    const duration = (flight: FlightResponse) =>
      new Date(flight.arrivalTime).getTime() -
      new Date(flight.departureTime).getTime();
    const sorted = [...flights];
    switch (dto.sort) {
      case 'price':
        return sorted.sort(
          (a, b) => this.fareTotal(a, dto.cabin) - this.fareTotal(b, dto.cabin),
        );
      case 'duration':
        return sorted.sort((a, b) => duration(a) - duration(b));
      case 'departure':
        return sorted.sort(
          (a, b) =>
            new Date(a.departureTime).getTime() -
            new Date(b.departureTime).getTime(),
        );
      case 'recommended':
        return sorted.sort(
          (a, b) =>
            this.fareTotal(a, dto.cabin) * 0.7 +
            duration(a) / 60_000 -
            (this.fareTotal(b, dto.cabin) * 0.7 + duration(b) / 60_000),
        );
      default:
        return sorted;
    }
  }
}
