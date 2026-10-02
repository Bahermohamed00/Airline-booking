import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Phase 6B: GET /api/flights/:id/seat-availability — real per-flight seat
 * availability from BookingSeat + SeatHold state, integrated with the Phase 4
 * booking lifecycle (create → held, cancel → released, expiry → free).
 */
describe('Flight seat availability (e2e)', () => {
  let app: INestApplication<App>;
  let flightId: string;
  let seatIds: string[];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function loginAs(email: string): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Seat',
      lastName: 'Tester',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  async function availability(id: string) {
    const res = await request(app.getHttpServer()).get(
      `/api/flights/${id}/seat-availability`,
    );
    expect(res.status).toBe(200);
    return res.body as {
      flightId: string;
      occupiedSeatIds: string[];
      heldSeatIds: string[];
    };
  }

  async function bookOneSeat(email: string, seatId: string) {
    const token = await loginAs(email);
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        flightId,
        cabinClass: 'ECONOMY',
        seatIds: [seatId],
        passengers: [{ firstName: 'Seat', lastName: 'Tester' }],
      });
    expect(res.status).toBe(201);
    return { token, booking: res.body as { id: string } };
  }

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    await prismaTestClient.airport.createMany({
      data: [
        {
          iataCode: 'FRA',
          name: 'Frankfurt Airport',
          city: 'Frankfurt',
          country: 'Germany',
          timezone: 'Europe/Berlin',
        },
        {
          iataCode: 'JFK',
          name: 'JFK International',
          city: 'New York',
          country: 'United States',
          timezone: 'America/New_York',
        },
      ],
    });
    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'FRA' },
      }),
      prismaTestClient.airport.findUniqueOrThrow({
        where: { iataCode: 'JFK' },
      }),
    ]);
    const route = await prismaTestClient.route.create({
      data: {
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        distanceKm: 6201,
        durationMinutes: 505,
      },
    });
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 },
    });
    await prismaTestClient.seat.createMany({
      data: generateSeatMap(aircraft.capacity).map((s) => ({
        ...s,
        aircraftId: aircraft.id,
        features: {},
      })),
    });
    const departure = new Date(Date.now() + 2 * 86_400_000);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV900',
        routeId: route.id,
        aircraftId: aircraft.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
        status: 'SCHEDULED',
      },
    });
    flightId = flight.id;
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
      },
    });
    await prismaTestClient.fare.create({
      data: {
        flightId: flight.id,
        cabinClass: 'ECONOMY',
        basePrice: 421,
        taxAmount: 67,
        feeAmount: 17,
        currency: 'EUR',
        availableCount: 12,
      },
    });
    seatIds = (
      await prismaTestClient.seat.findMany({
        where: { aircraftId: aircraft.id },
        orderBy: { seatNumber: 'asc' },
      })
    ).map((s) => s.id);
  });

  it('is public and starts with every seat free', async () => {
    const body = await availability(flightId);
    expect(body.flightId).toBe(flightId);
    expect(body.occupiedSeatIds).toEqual([]);
    expect(body.heldSeatIds).toEqual([]);
  });

  it('404s for an unknown flight and 400s for a malformed id', async () => {
    await request(app.getHttpServer())
      .get(`/api/flights/${randomUUID()}/seat-availability`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/flights/not-a-uuid/seat-availability')
      .expect(400);
  });

  it('marks a seat as held after a real booking creation', async () => {
    await bookOneSeat('avail-book@test.dev', seatIds[0]!);
    const body = await availability(flightId);
    expect(body.heldSeatIds).toContain(seatIds[0]);
    expect(body.heldSeatIds).not.toContain(seatIds[1]);
    expect(body.occupiedSeatIds).toEqual([]);
  });

  it('frees the seat after the booking is cancelled', async () => {
    const { token, booking } = await bookOneSeat(
      'avail-cancel@test.dev',
      seatIds[0]!,
    );
    expect((await availability(flightId)).heldSeatIds).toContain(seatIds[0]);

    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = await availability(flightId);
    expect(body.heldSeatIds).not.toContain(seatIds[0]);
    expect(body.occupiedSeatIds).not.toContain(seatIds[0]);
  });

  it('excludes expired holds so the seat becomes selectable again', async () => {
    await bookOneSeat('avail-expire@test.dev', seatIds[0]!);
    expect((await availability(flightId)).heldSeatIds).toContain(seatIds[0]);

    await prismaTestClient.seatHold.updateMany({
      where: { flightId, seatId: seatIds[0] },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const body = await availability(flightId);
    expect(body.heldSeatIds).not.toContain(seatIds[0]);
  });

  it('never counts RELEASED holds as blocking', async () => {
    await bookOneSeat('avail-released@test.dev', seatIds[0]!);
    await prismaTestClient.seatHold.updateMany({
      where: { flightId, seatId: seatIds[0] },
      data: { status: 'RELEASED' },
    });
    const body = await availability(flightId);
    expect(body.heldSeatIds).toEqual([]);
    expect(body.occupiedSeatIds).toEqual([]);
  });

  it('a second user sees the held seat as unavailable while other seats stay free', async () => {
    await bookOneSeat('avail-first@test.dev', seatIds[0]!);
    const body = await availability(flightId);
    expect(body.heldSeatIds).toEqual([seatIds[0]]);
    expect(body.heldSeatIds).not.toContain(seatIds[1]);
  });
});
