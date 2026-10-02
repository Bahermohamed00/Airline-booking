import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Airport, Fare, Flight, Route } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { toAirportView } from '../airports/airports.service.js';
import { generateFlights, type GenerationSummary } from './flight-generator.js';
import { FlightQueryDto } from './dto/flight-query.dto.js';
import { GenerateFlightsDto } from './dto/generate-flights.dto.js';

const MAX_GENERATION_RANGE_DAYS = 62;

type FareView = Omit<Fare, 'basePrice' | 'taxAmount' | 'feeAmount'> & {
  basePrice: number;
  taxAmount: number;
  feeAmount: number;
};

const toFareView = (fare: Fare): FareView => ({
  ...fare,
  basePrice: Number(fare.basePrice),
  taxAmount: Number(fare.taxAmount),
  feeAmount: Number(fare.feeAmount),
});

const FLIGHT_INCLUDE = {
  route: { include: { originAirport: true, destinationAirport: true } },
  aircraft: true,
  fares: { orderBy: { cabinClass: 'desc' as const } },
} as const;

type FlightWithRelations = Flight & {
  route: Route & { originAirport: Airport; destinationAirport: Airport };
  fares: Fare[];
};

const toFlightView = <T extends FlightWithRelations>(flight: T) => ({
  ...flight,
  route: {
    ...flight.route,
    originAirport: toAirportView(flight.route.originAirport),
    destinationAirport: toAirportView(flight.route.destinationAirport),
  },
  fares: flight.fares.map(toFareView),
});

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async findAll(query: FlightQueryDto) {
    const flights = await this.prisma.flight.findMany({
      where: {
        route: {
          originAirport: query.origin ? { iataCode: query.origin } : undefined,
          destinationAirport: query.destination ? { iataCode: query.destination } : undefined,
        },
        operatingDate: query.date
          ? new Date(`${query.date}T00:00:00Z`)
          : query.from || query.to
            ? {
                ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
                ...(query.to ? { lte: new Date(`${query.to}T00:00:00Z`) } : {}),
              }
            : undefined,
      },
      include: FLIGHT_INCLUDE,
      orderBy: [{ departureTime: 'asc' }, { flightNumber: 'asc' }],
    });
    return flights.map(toFlightView);
  }

  async findOne(id: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: { ...FLIGHT_INCLUDE, segments: true, scheduleRule: true },
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return toFlightView(flight);
  }

  /**
   * Per-flight seat availability for the customer seat map. Occupied seats
   * come from BookingSeat rows on non-cancelled bookings; held seats from
   * unexpired ACTIVE seat holds. Expired/RELEASED holds and cancelled
   * bookings never block a seat (the cron + booking-creation self-heal own
   * the state transitions; this read-only view applies the same rules).
   */
  async getSeatAvailability(id: string) {
    const flight = await this.prisma.flight.findUnique({ where: { id }, select: { id: true } });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    const [occupied, held] = await Promise.all([
      this.prisma.bookingSeat.findMany({
        where: {
          flightSegment: { flightId: id },
          bookingPassenger: { booking: { status: { not: 'CANCELLED' } } },
        },
        select: { seatId: true },
      }),
      this.prisma.seatHold.findMany({
        where: { flightId: id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        select: { seatId: true },
      }),
    ]);
    return {
      flightId: id,
      occupiedSeatIds: occupied.map((s) => s.seatId),
      heldSeatIds: held.map((s) => s.seatId),
    };
  }

  async generate(dto: GenerateFlightsDto): Promise<GenerationSummary> {
    if (dto.from > dto.to) {
      throw new BadRequestException('from must be on or before to');
    }
    const rangeDays = (Date.parse(`${dto.to}T00:00:00Z`) - Date.parse(`${dto.from}T00:00:00Z`)) / 86_400_000 + 1;
    if (rangeDays > MAX_GENERATION_RANGE_DAYS) {
      throw new BadRequestException(`generation range must not exceed ${MAX_GENERATION_RANGE_DAYS} days`);
    }
    return generateFlights(this.prisma, dto.from, dto.to);
  }

  /**
   * Daily automatic generation for the rolling window (default: next 14 days,
   * configurable via FLIGHT_GENERATION_WINDOW_DAYS). Manual/admin generation
   * goes through POST /api/flights/generate.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateRollingWindow(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    const windowDays = Number(this.config.get('FLIGHT_GENERATION_WINDOW_DAYS') ?? 14);
    const from = new Date();
    const to = new Date(from.getTime() + (windowDays - 1) * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const summary = await generateFlights(this.prisma, iso(from), iso(to));
    this.logger.log(
      `Scheduled flight generation ${iso(from)} → ${iso(to)}: ${summary.flightsCreated} created, ${summary.flightsUpdated} updated, ${summary.skippedRules.length} rules skipped`,
    );
  }
}
