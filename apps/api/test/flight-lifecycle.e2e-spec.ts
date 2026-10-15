import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FlightLifecycleService } from '../src/flights/flight-lifecycle.service.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

const NOW = new Date('2026-10-05T11:15:00Z');

/**
 * Automatic lifecycle: advanceLifecycle is invoked directly with a fixed `now`
 * (the @Cron wrapper is bypassed, same pattern as the seat-hold expiry tests).
 * Fixtures are Prisma-level, flight-only — no bookings or payments involved.
 */
describe('Flight lifecycle automation (e2e)', () => {
  let app: INestApplication<App>;
  let lifecycle: FlightLifecycleService;
  let routeId: string;
  let aircraftId: string;
  let seq = 0;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    lifecycle = app.get(FlightLifecycleService);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.create({
        data: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
      }),
      prismaTestClient.airport.create({
        data: { iataCode: 'JFK', name: 'JFK International', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      }),
    ]);
    const route = await prismaTestClient.route.create({
      data: { originAirportId: fra.id, destinationAirportId: jfk.id, distanceKm: 6201, durationMinutes: 505 },
    });
    routeId = route.id;
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-LC01', model: 'Test Jet 100', capacity: 12 },
    });
    aircraftId = aircraft.id;
  });

  async function createFlight(status: string, departureTime: Date, arrivalTime: Date): Promise<string> {
    seq += 1;
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: `NV9${String(seq).padStart(2, '0')}`,
        routeId,
        aircraftId,
        departureTime,
        arrivalTime,
        status: status as never,
      },
    });
    return flight.id;
  }

  const statusOf = async (id: string) =>
    (await prismaTestClient.flight.findUniqueOrThrow({ where: { id } })).status;

  it('advances eligible flights, cascades overdue ones, and leaves excluded statuses untouched', async () => {
    const boardingCandidate = await createFlight(
      'SCHEDULED',
      new Date('2026-10-05T12:00:00Z'), // departs in 45 min — exactly at the boarding threshold
      new Date('2026-10-05T14:00:00Z'),
    );
    const overdue = await createFlight(
      'SCHEDULED',
      new Date('2026-10-04T12:00:00Z'), // departed and arrived yesterday
      new Date('2026-10-04T14:00:00Z'),
    );
    const cancelled = await createFlight(
      'CANCELLED',
      new Date('2026-10-04T12:00:00Z'),
      new Date('2026-10-04T14:00:00Z'),
    );
    const legacyActive = await createFlight(
      'ACTIVE',
      new Date('2026-10-04T12:00:00Z'),
      new Date('2026-10-04T14:00:00Z'),
    );
    const notYetBoarding = await createFlight(
      'SCHEDULED',
      new Date('2026-10-05T16:00:00Z'), // hours away — before the boarding window
      new Date('2026-10-05T18:00:00Z'),
    );

    await lifecycle.advanceLifecycle(NOW);

    expect(await statusOf(boardingCandidate)).toBe('BOARDING');
    expect(await statusOf(overdue)).toBe('COMPLETED'); // cascaded through all four stages
    expect(await statusOf(cancelled)).toBe('CANCELLED');
    expect(await statusOf(legacyActive)).toBe('ACTIVE');
    expect(await statusOf(notYetBoarding)).toBe('SCHEDULED');

    const audits = await prismaTestClient.auditLog.findMany({
      where: { action: 'FLIGHT_STATUS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });
    // 1 for the boarding candidate + 4 for the cascading overdue flight.
    expect(audits).toHaveLength(5);
    for (const row of audits) {
      expect(row.actorType).toBe('System');
      expect(row.actorId).toBeNull();
      expect(row.targetType).toBe('Flight');
    }
    const overdueTrail = audits
      .filter((a) => a.targetId === overdue)
      .map((a) => a.metadata as { previousStatus: string; newStatus: string });
    expect(overdueTrail).toEqual([
      { previousStatus: 'SCHEDULED', newStatus: 'BOARDING' },
      { previousStatus: 'BOARDING', newStatus: 'DEPARTED' },
      { previousStatus: 'DEPARTED', newStatus: 'ARRIVED' },
      { previousStatus: 'ARRIVED', newStatus: 'COMPLETED' },
    ]);
    const boardingAudit = audits.find((a) => a.targetId === boardingCandidate)!;
    expect(boardingAudit.metadata).toEqual({ previousStatus: 'SCHEDULED', newStatus: 'BOARDING' });
  });

  it('a second run at the same instant is a complete no-op', async () => {
    const id = await createFlight(
      'SCHEDULED',
      new Date('2026-10-05T12:00:00Z'),
      new Date('2026-10-05T14:00:00Z'),
    );

    await lifecycle.advanceLifecycle(NOW);
    expect(await statusOf(id)).toBe('BOARDING');

    await lifecycle.advanceLifecycle(NOW);
    expect(await statusOf(id)).toBe('BOARDING');
    expect(
      await prismaTestClient.auditLog.count({ where: { action: 'FLIGHT_STATUS_CHANGED' } }),
    ).toBe(1);
  });

  it('a flight past arrival but inside the grace period waits for COMPLETED', async () => {
    const id = await createFlight(
      'DEPARTED',
      new Date('2026-10-05T08:00:00Z'),
      new Date('2026-10-05T10:00:00Z'), // arrived 75 min ago < 120-min grace
    );

    await lifecycle.advanceLifecycle(NOW);
    expect(await statusOf(id)).toBe('ARRIVED'); // reached ARRIVED but not yet COMPLETED

    await lifecycle.advanceLifecycle(new Date('2026-10-05T12:00:00Z')); // exactly arrival + 120 min
    expect(await statusOf(id)).toBe('COMPLETED');
  });
});
