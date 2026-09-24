import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapAirport, mapFlight } from './flight-response.mapper.js';
import { SearchFlightsDto } from './dto/search-flights.dto.js';

type FlightResponse = ReturnType<typeof mapFlight>;

const FLIGHT_INCLUDE = {
  route: { include: { originAirport: true, destinationAirport: true } },
  aircraft: { include: { seats: true } },
  segments: { include: { originAirport: true, destinationAirport: true }, orderBy: { segmentNumber: 'asc' as const } },
  fares: true,
} satisfies Prisma.FlightInclude;

/** Statuses a customer may book (mirrors the mock `bookable` check). */
const BOOKABLE_STATUSES = ['SCHEDULED', 'ACTIVE', 'DELAYED'] as const;

@Injectable()
export class FlightsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async searchAirports(query?: string) {
    const q = query?.trim();
    const airports = await this.prisma.airport.findMany({
      where: q
        ? {
            OR: [
              { iataCode: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { country: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { iataCode: 'asc' },
      take: 20,
    });
    return airports.map(mapAirport);
  }

  async searchFlights(dto: SearchFlightsDto): Promise<FlightResponse[]> {
    // Same calendar day as the requested departure date (mirrors mock `sameDay`).
    const dayStart = new Date(`${dto.depart}T00:00:00.000Z`);
    const dayEnd = new Date(`${dto.depart}T23:59:59.999Z`);

    const flights = await this.prisma.flight.findMany({
      where: {
        status: { in: [...BOOKABLE_STATUSES] },
        departureTime: { gte: dayStart, lte: dayEnd },
        route: {
          originAirport: { iataCode: dto.origin.toUpperCase() },
          destinationAirport: { iataCode: dto.destination.toUpperCase() },
        },
        fares: {
          some: {
            cabinClass: dto.cabin,
            availableCount: { gt: 0 },
          },
        },
      },
      include: FLIGHT_INCLUDE,
      orderBy: { departureTime: 'asc' },
    });

    let results = flights.map(mapFlight);
    results = this.applyFilters(results, dto);
    results = this.applySort(results, dto);
    return results;
  }

  async adjacentDates(dto: Pick<SearchFlightsDto, 'origin' | 'destination' | 'depart' | 'cabin'>) {
    const base = new Date(`${dto.depart}T00:00:00.000Z`);
    const days: { date: string; minPrice: number | null }[] = [];

    for (let offset = -3; offset <= 3; offset++) {
      const day = new Date(base);
      day.setUTCDate(day.getUTCDate() + offset);
      const dateStr = day.toISOString().slice(0, 10);
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

      const flights = await this.prisma.flight.findMany({
        where: {
          status: { not: 'CANCELLED' },
          departureTime: { gte: dayStart, lte: dayEnd },
          route: {
            originAirport: { iataCode: dto.origin.toUpperCase() },
            destinationAirport: { iataCode: dto.destination.toUpperCase() },
          },
        },
        include: { fares: { where: { cabinClass: dto.cabin } } },
      });

      const prices = flights.flatMap((f) =>
        f.fares.map((fare) => Number(fare.basePrice) + Number(fare.taxAmount) + Number(fare.feeAmount)),
      );
      days.push({ date: dateStr, minPrice: prices.length ? Math.min(...prices) : null });
    }
    return days;
  }

  async getFlight(id: string): Promise<FlightResponse> {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: FLIGHT_INCLUDE,
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return mapFlight(flight);
  }

  /** FR-C19: flight status by flight number (optionally on a given date). */
  async statusByNumber(flightNumber: string, date?: string): Promise<FlightResponse[]> {
    const where: Prisma.FlightWhereInput = {
      flightNumber: { contains: flightNumber.trim(), mode: 'insensitive' },
    };
    if (date) {
      where.departureTime = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lte: new Date(`${date}T23:59:59.999Z`),
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

  /** FR-C19: flight status by origin/destination. */
  async statusByRoute(originCode: string, destinationCode: string): Promise<FlightResponse[]> {
    const flights = await this.prisma.flight.findMany({
      where: {
        route: {
          originAirport: { iataCode: originCode.toUpperCase() },
          destinationAirport: { iataCode: destinationCode.toUpperCase() },
        },
      },
      include: FLIGHT_INCLUDE,
      orderBy: { departureTime: 'asc' },
      take: 20,
    });
    return flights.map(mapFlight);
  }

  // ---------- Filter & sort (mirrors mock applyFilters/applySort exactly) ----------

  private fareTotal(flight: FlightResponse, cabin: string): number {
    const fare = flight.fares.find((f) => f.cabinClass === cabin) ?? flight.fares[0];
    return fare.basePrice + fare.taxAmount + fare.feeAmount;
  }

  private applyFilters(flights: FlightResponse[], dto: SearchFlightsDto): FlightResponse[] {
    return flights.filter((f) => {
      const fare = f.fares.find((x) => x.cabinClass === dto.cabin) ?? f.fares[0];
      const total = fare.basePrice + fare.taxAmount + fare.feeAmount;
      if (dto.maxPrice != null && total > dto.maxPrice) return false;
      if (dto.refundableOnly === 'true' && !fare.rules.refundable) return false;
      if (dto.departureWindow) {
        const h = new Date(f.departureTime).getHours();
        const inWindow =
          dto.departureWindow === 'morning' ? h < 12
          : dto.departureWindow === 'afternoon' ? h >= 12 && h < 18
          : h >= 18;
        if (!inWindow) return false;
      }
      if (dto.stops === 'nonstop' && f.segments.length > 1) return false;
      return true;
    });
  }

  private applySort(flights: FlightResponse[], dto: SearchFlightsDto): FlightResponse[] {
    const totalOf = (f: FlightResponse) => this.fareTotal(f, dto.cabin);
    const durationOf = (f: FlightResponse) =>
      new Date(f.arrivalTime).getTime() - new Date(f.departureTime).getTime();
    const list = [...flights];
    switch (dto.sort) {
      case 'price':
        return list.sort((a, b) => totalOf(a) - totalOf(b));
      case 'duration':
        return list.sort((a, b) => durationOf(a) - durationOf(b));
      case 'departure':
        return list.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
      case 'recommended':
        return list.sort((a, b) => totalOf(a) * 0.7 + durationOf(a) / 60000 - (totalOf(b) * 0.7 + durationOf(b) / 60000));
      default:
        return list;
    }
  }
}
