import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Aircraft, Airport, Fare, Flight, Prisma, Route } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service.js';
import { changedFieldsOf } from '../audit/changed-fields.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { toAirportView } from '../airports/airport-view.js';
import { computeFareDraftsFromBase, FARE_CURRENCY, generateFlights, TAX_RATE, FEE_RATE, type GenerationSummary } from './flight-generator.js';
import { formatDateInZone, zonedTimeToUtc } from './airport-time.js';
import { isFlightTransitionAllowed } from './flight-status-transitions.js';
import { CreateFlightDto } from './dto/create-flight.dto.js';
import { FlightQueryDto } from './dto/flight-query.dto.js';
import { GenerateFlightsDto } from './dto/generate-flights.dto.js';
import { UpdateFlightStatusDto } from './dto/update-flight-status.dto.js';
import { UpdateFlightDto } from './dto/update-flight.dto.js';
import { CompletedFlightsQueryDto } from './dto/completed-flights-query.dto.js';
import { FlightHistoryQueryDto, type HistoryDomain } from './dto/flight-history-query.dto.js';

const MAX_GENERATION_RANGE_DAYS = 62;

/** Audit events owned by the Flight Management domain (History scoping). */
const FLIGHT_DOMAIN_EVENTS: Record<'all' | HistoryDomain, string[]> = {
  all: [
    'FLIGHT_CREATED', 'FLIGHT_UPDATED', 'FLIGHT_STATUS_CHANGED', 'FLIGHTS_GENERATED',
    'ROUTE_CREATED', 'ROUTE_UPDATED', 'AIRPORT_CREATED', 'AIRPORT_UPDATED',
    'AIRCRAFT_CREATED', 'AIRCRAFT_UPDATED', 'SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_UPDATED',
  ],
  flights: ['FLIGHT_CREATED', 'FLIGHT_UPDATED', 'FLIGHT_STATUS_CHANGED', 'FLIGHTS_GENERATED'],
  airports: ['AIRPORT_CREATED', 'AIRPORT_UPDATED'],
  aircraft: ['AIRCRAFT_CREATED', 'AIRCRAFT_UPDATED'],
  routes: ['ROUTE_CREATED', 'ROUTE_UPDATED', 'SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_UPDATED'],
};

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
  aircraft: Aircraft;
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

export type FlightView = ReturnType<typeof toFlightView>;

/** Response envelope for GET /flights when page/limit pagination is requested. */
export interface PaginatedFlights {
  items: FlightView[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const FLIGHT_ORDER_BY: Prisma.FlightOrderByWithRelationInput[] = [{ departureTime: 'asc' }, { flightNumber: 'asc' }];

@Injectable()
export class FlightsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(DashboardEventsService) private readonly dashboardEvents: DashboardEventsService,
  ) {}

  // Overloads keep internal callers precise: a query that cannot contain
  // page/limit (e.g. DashboardService) is typed as the legacy bare array;
  // the controller's full FlightQueryDto falls through to the union.
  async findAll(query: FlightQueryDto & { page?: undefined; limit?: undefined }): Promise<FlightView[]>;
  async findAll(query: FlightQueryDto): Promise<FlightView[] | PaginatedFlights>;
  async findAll(query: FlightQueryDto): Promise<FlightView[] | PaginatedFlights> {
    const where: Prisma.FlightWhereInput = {
      id: query.id,
      flightNumber: query.flightNumber ? { contains: query.flightNumber } : undefined,
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
      // Opt-in status filter. The default (no param) intentionally returns
      // every status — the customer status tracker and admin list rely on it.
      // excludeCompleted=true switches to the operational view (no COMPLETED).
      status: query.status ?? (query.excludeCompleted === 'true' ? { not: 'COMPLETED' } : undefined),
    };

    // Backward compatibility: without page/limit the endpoint keeps returning
    // the bare array that every existing consumer (web app, status tracker) expects.
    if (query.page === undefined && query.limit === undefined) {
      const flights = await this.prisma.flight.findMany({
        where,
        include: FLIGHT_INCLUDE,
        orderBy: FLIGHT_ORDER_BY,
      });
      return flights.map(toFlightView);
    }

    // Opt-in pagination: a lone `page` defaults limit to 20, a lone `limit`
    // defaults page to 1 (the DTO deliberately carries no defaults).
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.flight.findMany({
        where,
        include: FLIGHT_INCLUDE,
        orderBy: FLIGHT_ORDER_BY,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.flight.count({ where }),
    ]);

    return {
      items: rows.map(toFlightView),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
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
   * Completed-flight operational report (Flight Management scope): schedule,
   * route, aircraft, times, final statuses and booked-seat counts only.
   * Deliberately no financial data — revenue/payments belong to Finance.
   * Read-only; completed flights stay stored and are never deleted.
   */
  async findCompleted(query: CompletedFlightsQueryDto) {
    const where: Prisma.FlightWhereInput = {
      status: 'COMPLETED',
      ...(query.flightNumber ? { flightNumber: { contains: query.flightNumber.toUpperCase() } } : {}),
      ...this.completedSearchWhere(query.search),
      ...(query.from || query.to
        ? {
            operatingDate: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T00:00:00Z`) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.flight.findMany({
        where,
        include: {
          route: { include: { originAirport: true, destinationAirport: true } },
          aircraft: true,
          fares: { orderBy: { cabinClass: 'desc' as const }, take: 4 },
          segments: {
            select: {
              id: true,
              _count: {
                select: {
                  bookingSeats: {
                    where: { bookingPassenger: { booking: { status: { not: 'CANCELLED' } } } },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ arrivalTime: 'desc' }, { flightNumber: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.flight.count({ where }),
    ]);

    return {
      items: rows.map((flight) => ({
        id: flight.id,
        flightNumber: flight.flightNumber,
        publicNumber: flight.publicNumber,
        tripType: flight.tripType,
        route: {
          origin: toAirportView(flight.route.originAirport),
          destination: toAirportView(flight.route.destinationAirport),
        },
        aircraft: {
          registration: flight.aircraft.registration,
          model: flight.aircraft.model,
        },
        operatingDate: flight.operatingDate,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        status: flight.status,
        scheduleStatus: flight.scheduleStatus,
        bookedSeats: flight.segments.reduce((sum, s) => sum + s._count.bookingSeats, 0),
        fares: flight.fares.map(toFareView),
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /** FL-xxxx / NV-number / airport-IATA search for completed flights. */
  private completedSearchWhere(search?: string): Prisma.FlightWhereInput {
    if (!search) return {};
    const publicId = /^FL-?(\d+)$/i.exec(search);
    if (publicId) {
      return { publicNumber: Number(publicId[1]) - 1000 };
    }
    return {
      OR: [
        { flightNumber: { contains: search.toUpperCase() } },
        { route: { originAirport: { iataCode: { contains: search.toUpperCase() } } } },
        { route: { destinationAirport: { iataCode: { contains: search.toUpperCase() } } } },
      ],
    };
  }

  /**
   * Flight Manager operational overview — real DB counts only, all within the
   * Flight Management domain. Statuses: upcoming = SCHEDULED(+legacy ACTIVE)
   * in the future; active = BOARDING/DEPARTED/ARRIVED right now.
   */
  async overview() {
    const now = new Date();
    const statuses = ['SCHEDULED', 'BOARDING', 'DEPARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'ACTIVE', 'DELAYED'] as const;
    const [
      totalFlights,
      upcomingFlights,
      activeFlights,
      completedFlights,
      cancelledFlights,
      delayedFlights,
      routes,
      airports,
      aircraft,
      upcomingList,
      recentActivity,
      scheduled,
      boarding,
      departed,
      arrived,
      completed,
      cancelled,
      legacyActive,
      legacyDelayed,
    ] = await this.prisma.$transaction([
      this.prisma.flight.count(),
      this.prisma.flight.count({ where: { status: { in: ['SCHEDULED', 'ACTIVE'] }, departureTime: { gte: now } } }),
      this.prisma.flight.count({ where: { status: { in: ['BOARDING', 'DEPARTED', 'ARRIVED'] } } }),
      this.prisma.flight.count({ where: { status: 'COMPLETED' } }),
      this.prisma.flight.count({ where: { status: 'CANCELLED' } }),
      this.prisma.flight.count({ where: { status: 'DELAYED' } }),
      this.prisma.route.count(),
      this.prisma.airport.count(),
      this.prisma.aircraft.count(),
      this.prisma.flight.findMany({
        where: { status: { in: ['SCHEDULED', 'ACTIVE'] }, departureTime: { gte: now } },
        include: FLIGHT_INCLUDE,
        orderBy: { departureTime: 'asc' },
        take: 8,
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: { in: FLIGHT_DOMAIN_EVENTS.all },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      ...statuses.map((status) => this.prisma.flight.count({ where: { status } })),
    ]);

    const statusBreakdown: Record<string, number> = {
      SCHEDULED: scheduled,
      BOARDING: boarding,
      DEPARTED: departed,
      ARRIVED: arrived,
      COMPLETED: completed,
      CANCELLED: cancelled,
      ACTIVE: legacyActive,
      DELAYED: legacyDelayed,
    };

    return {
      totalFlights,
      upcomingFlights,
      activeFlights,
      completedFlights,
      cancelledFlights,
      delayedFlights,
      routes,
      airports,
      aircraft,
      statusBreakdown,
      upcoming: upcomingList.map(toFlightView),
      recentActivity: recentActivity.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        actorId: row.actorId,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
    };
  }

  /**
   * Flight Manager History: the existing audit log, scoped to Flight
   * Management domain events. Read-only by construction — there is no delete
   * anywhere in the audit stack.
   */
  async history(query: FlightHistoryQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      action: query.event
        ? query.event
        : query.domain
          ? { in: FLIGHT_DOMAIN_EVENTS[query.domain] ?? FLIGHT_DOMAIN_EVENTS.flights }
          : { in: FLIGHT_DOMAIN_EVENTS.all },
      ...(query.actorType ? { actorType: query.actorType } : {}),
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' as const } },
              { targetId: { contains: query.search, mode: 'insensitive' as const } },
              { targetType: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        actorId: row.actorId,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
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

  /**
   * Explicit single-flight creation by the Flight Manager (no schedule rule
   * required — scheduleRuleId is nullable by design; legacy adopted flights
   * prove the pattern). Departure time is origin-local, arrival time is
   * destination-local, both converted to UTC instants exactly like the
   * rule-based generator. One segment mirroring the flight times and the
   * deterministic fare set are created in the same transaction. Manual-flight
   * idempotency: (routeId, aircraftId, departureTime) must be unique.
   */
  async create(dto: CreateFlightDto, actor: AuthUser) {
    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
      include: { originAirport: true, destinationAirport: true },
    });
    if (!route) {
      throw new BadRequestException('Route does not exist');
    }
    const aircraft = await this.prisma.aircraft.findUnique({ where: { id: dto.aircraftId } });
    if (!aircraft) {
      throw new BadRequestException('Aircraft does not exist');
    }

    const departureTime = zonedTimeToUtc(dto.departureDate, dto.departureTime, route.originAirport.timezone);
    const arrivalTime = zonedTimeToUtc(dto.arrivalDate, dto.arrivalTime, route.destinationAirport.timezone);
    if (departureTime >= arrivalTime) {
      throw new BadRequestException('arrivalTime must be after departureTime');
    }

    // The business-facing flight number is required and must be free: not
    // owned by a schedule rule, not used by any existing flight.
    const flightNumber = dto.flightNumber;
    const ruleCollision = await this.prisma.scheduleRule.findUnique({ where: { flightNumber } });
    if (ruleCollision) {
      throw new ConflictException(`Flight number ${flightNumber} is already used by a schedule rule`);
    }
    const numberTaken = await this.prisma.flight.findFirst({ where: { flightNumber }, select: { id: true } });
    if (numberTaken) {
      throw new ConflictException(`A flight with flight number ${flightNumber} already exists`);
    }

    const duplicate = await this.prisma.flight.findFirst({
      where: { routeId: dto.routeId, aircraftId: dto.aircraftId, departureTime },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('A flight with this route, aircraft and departure time already exists');
    }

    const operatingDate = new Date(
      `${formatDateInZone(departureTime, route.originAirport.timezone)}T00:00:00Z`,
    );
    const fareDrafts = computeFareDraftsFromBase(dto.price, aircraft.capacity);

    const flightId = await this.prisma.$transaction(async (tx) => {
      const flight = await tx.flight.create({
        data: {
          flightNumber,
          routeId: dto.routeId,
          aircraftId: dto.aircraftId,
          operatingDate,
          departureTime,
          arrivalTime,
          status: 'SCHEDULED',
          scheduleStatus: 'ONTIME',
          tripType: dto.tripType ?? 'ONE_WAY',
        },
      });
      await tx.flightSegment.create({
        data: {
          flightId: flight.id,
          segmentNumber: 1,
          originAirportId: route.originAirportId,
          destinationAirportId: route.destinationAirportId,
          departureTime,
          arrivalTime,
        },
      });
      for (const fare of fareDrafts) {
        await tx.fare.create({
          data: {
            flightId: flight.id,
            cabinClass: fare.cabinClass,
            basePrice: fare.basePrice,
            taxAmount: fare.taxAmount,
            feeAmount: fare.feeAmount,
            availableCount: fare.availableCount,
            currency: FARE_CURRENCY,
          },
        });
      }
      return flight.id;
    });

    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'FLIGHT_CREATED',
      targetType: 'Flight',
      targetId: flightId,
      metadata: { flightNumber },
    });
    await this.dashboardEvents.publish('flight.created');

    return this.findOne(flightId);
  }

  /**
   * Edit a flight's schedule times. Deliberately narrow: route, aircraft and
   * lifecycle status are not editable here (status has its own transition
   * endpoint; route/aircraft changes would affect seat/booking references).
   * Terminal flights (CANCELLED/COMPLETED) are immutable — never resurrected.
   * Segment times are kept in sync inside the same transaction; BookingSeat
   * rows reference segments by id, so no booking data is corrupted.
   */
  async update(id: string, dto: UpdateFlightDto, actor: AuthUser) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      select: { id: true, status: true, departureTime: true, arrivalTime: true },
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    if (flight.status === 'CANCELLED' || flight.status === 'COMPLETED') {
      throw new ConflictException(`A ${flight.status} flight cannot be edited`);
    }

    const departureTime = dto.departureTime ? new Date(dto.departureTime) : flight.departureTime;
    const arrivalTime = dto.arrivalTime ? new Date(dto.arrivalTime) : flight.arrivalTime;
    if (departureTime >= arrivalTime) {
      throw new BadRequestException('departureTime must be before arrivalTime');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.flightSegment.updateMany({
        where: { flightId: id },
        data: {
          ...(dto.departureTime ? { departureTime } : {}),
          ...(dto.arrivalTime ? { arrivalTime } : {}),
        },
      });
      if (dto.price !== undefined) {
        // Price lives on the existing Fare model (economy base); taxes/fees
        // follow the same rates as the generator.
        const base = Math.round(dto.price * 100) / 100;
        await tx.fare.updateMany({
          where: { flightId: id, cabinClass: 'ECONOMY' },
          data: {
            basePrice: base,
            taxAmount: Math.round(base * TAX_RATE),
            feeAmount: Math.round(base * FEE_RATE),
          },
        });
      }
      return tx.flight.update({
        where: { id },
        data: {
          ...(dto.departureTime ? { departureTime } : {}),
          ...(dto.arrivalTime ? { arrivalTime } : {}),
        },
        include: FLIGHT_INCLUDE,
      });
    });

    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'FLIGHT_UPDATED',
      targetType: 'Flight',
      targetId: id,
      metadata: { flightNumber: updated.flightNumber, changedFields: changedFieldsOf(dto) },
    });
    await this.dashboardEvents.publish('flight.updated');

    return toFlightView(updated);
  }

  async updateStatus(id: string, dto: UpdateFlightStatusDto, actor: AuthUser) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    if (!isFlightTransitionAllowed(flight.status, dto.status)) {
      throw new BadRequestException(`Transition ${flight.status} → ${dto.status} is not allowed`);
    }

    if (dto.status === 'CANCELLED') {
      // Flight-side guard only: a flight with active (non-cancelled) bookings
      // cannot be cancelled unilaterally — refund/rebooking policy belongs to
      // the Booking and Finance owners. Read-only integration via BookingSeat.
      const activeBookedSeats = await this.prisma.bookingSeat.count({
        where: {
          flightSegment: { flightId: id },
          bookingPassenger: { booking: { status: { not: 'CANCELLED' } } },
        },
      });
      if (activeBookedSeats > 0) {
        throw new ConflictException(
          'Flight has active bookings; cancellation requires Booking/Finance coordination',
        );
      }
    }

    // Compare-and-set: the persisted status must still be the one validated
    // above — a concurrent transition loses with P2025 instead of two updates
    // both committing against the same stale status.
    let updated: Prisma.FlightGetPayload<{ include: typeof FLIGHT_INCLUDE }>;
    try {
      updated = await this.prisma.flight.update({
        where: { id, status: flight.status },
        data: { status: dto.status },
        include: FLIGHT_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('Flight status changed concurrently — reload and retry');
      }
      throw error;
    }

    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'FLIGHT_STATUS_CHANGED',
      targetType: 'Flight',
      targetId: id,
      metadata: { previousStatus: flight.status, newStatus: dto.status },
    });
    await this.dashboardEvents.publish('flight.status.changed');
    if (dto.status === 'CANCELLED') {
      await this.dashboardEvents.publish('flight.cancelled');
    }

    return toFlightView(updated);
  }

  async generate(dto: GenerateFlightsDto, actor: AuthUser): Promise<GenerationSummary> {
    if (dto.from > dto.to) {
      throw new BadRequestException('from must be on or before to');
    }
    const rangeDays = (Date.parse(`${dto.to}T00:00:00Z`) - Date.parse(`${dto.from}T00:00:00Z`)) / 86_400_000 + 1;
    if (rangeDays > MAX_GENERATION_RANGE_DAYS) {
      throw new BadRequestException(`generation range must not exceed ${MAX_GENERATION_RANGE_DAYS} days`);
    }
    const summary = await generateFlights(this.prisma, dto.from, dto.to);
    // One summary row per generation run, post-commit — not one row per flight.
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'FLIGHTS_GENERATED',
      targetType: 'Flight',
      metadata: { flightsCreated: summary.flightsCreated, flightsUpdated: summary.flightsUpdated },
    });
    if (summary.flightsCreated > 0 || summary.flightsUpdated > 0) {
      await this.dashboardEvents.publish('flight.created');
    }
    return summary;
  }
}
