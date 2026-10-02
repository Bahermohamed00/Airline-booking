import { Inject, Injectable } from '@nestjs/common';
import { FlightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { FlightsService } from '../flights/flights.service.js';
import {
  DashboardQueryDto,
  type DashboardRange,
} from './dto/dashboard-query.dto.js';

const DAY_MS = 86_400_000;
const UPCOMING_FLIGHT_DAYS = 7;
const RECENT_BOOKINGS_LIMIT = 5;
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED'] as const;
// Payments that represent money actually captured (REFUNDED/PARTIALLY_REFUNDED
// payments captured funds too — the refund rows then subtract from revenue).
const REVENUE_PAYMENT_STATUSES = ['SUCCESS', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;

export interface TrendPoint {
  date: string;
  value: number;
}

export interface DashboardFlightView {
  id: string;
  flightNumber: string;
  status: FlightStatus;
  departureTime: Date;
  arrivalTime: Date;
  originIata: string;
  destinationIata: string;
  aircraftRegistration: string;
}

export interface DashboardBookingView {
  id: string;
  bookingReference: string;
  status: string;
  totalAmount: number;
  currency: string;
  bookedAt: Date;
}

export interface DashboardView {
  range: DashboardRange;
  totalFlights: number;
  totalBookings: number;
  confirmedBookings: number;
  passengers: number;
  occupancyPercent: number;
  revenue: number;
  currency: string;
  scheduledCount: number;
  delayedCount: number;
  cancelledCount: number;
  completedCount: number;
  pendingRefunds: number;
  openBaggageCases: number;
  todaysFlights: DashboardFlightView[];
  recentBookings: DashboardBookingView[];
  bookingsTrend: TrendPoint[];
  revenueTrend: TrendPoint[];
}

/** Counts events per UTC calendar day over the trailing `days` window, zero-filling empty days. */
export function bucketPerDay(
  dates: Date[],
  days: number,
  now: Date,
): TrendPoint[] {
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const counts = new Map<number, number>();
  for (const d of dates) {
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = todayUtc - i * DAY_MS;
    points.push({
      date: new Date(day).toISOString().slice(0, 10),
      value: counts.get(day) ?? 0,
    });
  }
  return points;
}

/** Sums signed amounts per UTC calendar day over the trailing `days` window, zero-filling empty days. */
export function bucketSumPerDay(
  entries: { date: Date; value: number }[],
  days: number,
  now: Date,
): TrendPoint[] {
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const sums = new Map<number, number>();
  for (const e of entries) {
    const day = Date.UTC(
      e.date.getUTCFullYear(),
      e.date.getUTCMonth(),
      e.date.getUTCDate(),
    );
    sums.set(day, (sums.get(day) ?? 0) + e.value);
  }
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = todayUtc - i * DAY_MS;
    points.push({
      date: new Date(day).toISOString().slice(0, 10),
      value: Math.round((sums.get(day) ?? 0) * 100) / 100,
    });
  }
  return points;
}

/**
 * Operations dashboard aggregates. Metric definitions:
 * - totalFlights: flights departing in [now, now + 7 days).
 * - passengers: passengers on active (PENDING/CONFIRMED) bookings.
 * - occupancyPercent: seats assigned on active bookings for non-CANCELLED
 *   flights departing in [now, now + 7 days) ÷ total seats of those flights.
 * - status counts (scheduled/delayed/cancelled/completed): today's operations;
 *   ACTIVE flights are counted as scheduled.
 * - revenue: all-time net revenue = Σ successful payments (by paidAt) − Σ
 *   processed refunds (by processedAt); revenueTrend buckets the same net
 *   amounts per UTC day over the selected range. The platform is
 *   single-currency (fares are generated in EUR — see FARE_CURRENCY).
 * - pendingRefunds / openBaggageCases: real counts over the refunds/baggage
 *   tables.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlightsService) private readonly flights: FlightsService,
  ) {}

  async getDashboard(query: DashboardQueryDto): Promise<DashboardView> {
    const range: DashboardRange = query.range ?? '30d';
    const trendDays = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const now = new Date();
    const upcomingEnd = new Date(now.getTime() + UPCOMING_FLIGHT_DAYS * DAY_MS);
    const trendStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        (trendDays - 1) * DAY_MS,
    );

    const [
      totalFlights,
      totalBookings,
      confirmedBookings,
      passengers,
      pendingRefunds,
      openBaggageCases,
      todaysFlightsRaw,
      recentBookingsRaw,
      trendBookings,
      upcomingFlights,
      revenuePayments,
      revenueRefunds,
    ] = await Promise.all([
      this.prisma.flight.count({
        where: { departureTime: { gte: now, lt: upcomingEnd } },
      }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.bookingPassenger.count({
        where: { booking: { status: { in: [...ACTIVE_BOOKING_STATUSES] } } },
      }),
      this.prisma.refund.count({ where: { status: 'PENDING' } }),
      this.prisma.baggage.count({
        where: { status: { in: ['LOST', 'DELAYED'] } },
      }),
      this.flights.findAll({ date: now.toISOString().slice(0, 10) }),
      this.prisma.booking.findMany({
        orderBy: { bookedAt: 'desc' },
        take: RECENT_BOOKINGS_LIMIT,
        select: {
          id: true,
          bookingReference: true,
          status: true,
          totalAmount: true,
          currency: true,
          bookedAt: true,
        },
      }),
      this.prisma.booking.findMany({
        where: { bookedAt: { gte: trendStart } },
        select: { bookedAt: true },
      }),
      this.prisma.flight.findMany({
        where: {
          departureTime: { gte: now, lt: upcomingEnd },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          aircraft: { select: { _count: { select: { seats: true } } } },
        },
      }),
      this.prisma.payment.findMany({
        where: { status: { in: [...REVENUE_PAYMENT_STATUSES] }, paidAt: { not: null } },
        select: { amount: true, paidAt: true },
      }),
      this.prisma.refund.findMany({
        where: { status: 'PROCESSED', processedAt: { not: null } },
        select: { amount: true, processedAt: true },
      }),
    ]);

    const todaysFlights = todaysFlightsRaw.map((f) => ({
      id: f.id,
      flightNumber: f.flightNumber,
      status: f.status,
      departureTime: f.departureTime,
      arrivalTime: f.arrivalTime,
      originIata: f.route.originAirport.iataCode,
      destinationIata: f.route.destinationAirport.iataCode,
      aircraftRegistration: f.aircraft.registration,
    }));

    const countByStatus = (statuses: FlightStatus[]) =>
      todaysFlights.filter((f) => statuses.includes(f.status)).length;

    const occupiedSeats = await this.prisma.bookingSeat.count({
      where: {
        flightSegment: { flightId: { in: upcomingFlights.map((f) => f.id) } },
        bookingPassenger: {
          booking: { status: { in: [...ACTIVE_BOOKING_STATUSES] } },
        },
      },
    });
    const seatCapacity = upcomingFlights.reduce(
      (sum, f) => sum + f.aircraft._count.seats,
      0,
    );
    const occupancyPercent =
      seatCapacity === 0 ? 0 : Math.round((occupiedSeats / seatCapacity) * 100);

    // Net revenue: captured payments minus processed refunds (single-currency
    // platform — fares are generated in EUR).
    const grossRevenue = revenuePayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const refundedTotal = revenueRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const revenue = Math.round((grossRevenue - refundedTotal) * 100) / 100;
    const revenueEntries = [
      ...revenuePayments.map((p) => ({ date: p.paidAt!, value: Number(p.amount) })),
      ...revenueRefunds.map((r) => ({ date: r.processedAt!, value: -Number(r.amount) })),
    ];

    return {
      range,
      totalFlights,
      totalBookings,
      confirmedBookings,
      passengers,
      occupancyPercent,
      revenue,
      currency: 'EUR',
      scheduledCount: countByStatus(['SCHEDULED', 'ACTIVE']),
      delayedCount: countByStatus(['DELAYED']),
      cancelledCount: countByStatus(['CANCELLED']),
      completedCount: countByStatus(['COMPLETED']),
      pendingRefunds,
      openBaggageCases,
      todaysFlights,
      recentBookings: recentBookingsRaw.map((b) => ({
        ...b,
        totalAmount: Number(b.totalAmount),
      })),
      bookingsTrend: bucketPerDay(
        trendBookings.map((b) => b.bookedAt),
        trendDays,
        now,
      ),
      revenueTrend: bucketSumPerDay(revenueEntries, trendDays, now),
    };
  }
}
