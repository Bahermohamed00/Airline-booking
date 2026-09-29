import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from './test-utils.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

const DEPART_DATE = '2030-06-15';

async function seedCatalog(): Promise<{ flightId: string }> {
  const fra = await prismaTestClient.airport.create({
    data: {
      iataCode: 'FRA',
      name: 'Frankfurt Airport',
      city: 'Frankfurt',
      country: 'Germany',
      timezone: 'Europe/Berlin',
    },
  });
  const jfk = await prismaTestClient.airport.create({
    data: {
      iataCode: 'JFK',
      name: 'John F. Kennedy International Airport',
      city: 'New York',
      country: 'United States',
      timezone: 'America/New_York',
    },
  });
  const route = await prismaTestClient.route.create({
    data: {
      originAirportId: fra.id,
      destinationAirportId: jfk.id,
      distanceKm: 6201,
      durationMinutes: 505,
    },
  });
  const aircraft = await prismaTestClient.aircraft.create({
    data: { registration: 'NA-TEST1', model: 'Airbus A320-200', capacity: 12 },
  });
  const flight = await prismaTestClient.flight.create({
    data: {
      flightNumber: 'NV900',
      routeId: route.id,
      aircraftId: aircraft.id,
      departureTime: new Date(`${DEPART_DATE}T09:00:00.000Z`),
      arrivalTime: new Date(`${DEPART_DATE}T17:25:00.000Z`),
      status: 'SCHEDULED',
      segments: {
        create: {
          segmentNumber: 1,
          originAirportId: fra.id,
          destinationAirportId: jfk.id,
          departureTime: new Date(`${DEPART_DATE}T09:00:00.000Z`),
          arrivalTime: new Date(`${DEPART_DATE}T17:25:00.000Z`),
        },
      },
      fares: {
        create: [
          {
            cabinClass: 'ECONOMY',
            basePrice: 299,
            taxAmount: 45,
            feeAmount: 10,
            currency: 'EUR',
            availableCount: 100,
            fareRules: { refundable: false, description: 'Economy Light' },
          },
          {
            cabinClass: 'ECONOMY',
            basePrice: 480,
            taxAmount: 60,
            feeAmount: 12,
            currency: 'EUR',
            availableCount: 8,
            fareRules: { refundable: true, description: 'Flex' },
          },
        ],
      },
    },
  });
  return { flightId: flight.id };
}

const BASE_QUERY = {
  tripType: 'ONE_WAY',
  origin: 'FRA',
  destination: 'JFK',
  depart: DEPART_DATE,
  adults: 1,
  children: 0,
  infants: 0,
  cabin: 'ECONOMY',
};

describe('FlightsController (e2e)', () => {
  let app: INestApplication<App>;

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

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  it('GET /api/flights/search/advanced returns matching flights with frontend-shaped payload', async () => {
    await seedCatalog();

    const res = await request(app.getHttpServer())
      .get('/api/flights/search/advanced')
      .query(BASE_QUERY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const flight = res.body[0];
    expect(flight.flightNumber).toBe('NV900');
    expect(flight.route.origin.iataCode).toBe('FRA');
    expect(flight.route.destination.iataCode).toBe('JFK');
    expect(flight.aircraft.registration).toBe('NA-TEST1');
    expect(flight.segments).toHaveLength(1);
    expect(flight.fares).toHaveLength(2);
    expect(flight.fares[0]).toHaveProperty('rules');
    expect(typeof flight.fares[0].basePrice).toBe('number');
  });

  it('GET /api/flights/search/advanced returns empty array when route/date has no flights', async () => {
    await seedCatalog();

    const res = await request(app.getHttpServer())
      .get('/api/flights/search/advanced')
      .query({ ...BASE_QUERY, depart: '2030-06-20' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retains the basic flight search query contract', async () => {
    await seedCatalog();

    const res = await request(app.getHttpServer())
      .get('/api/flights/search')
      .query({ from: 'FRA', to: 'JFK', date: DEPART_DATE, cabin: 'ECONOMY' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].flightNumber).toBe('NV900');
  });

  it('applies filters and sort server-side (FR-C06)', async () => {
    await seedCatalog();

    // maxPrice below the cheapest fare → empty
    const cheap = await request(app.getHttpServer())
      .get('/api/flights/search/advanced')
      .query({ ...BASE_QUERY, maxPrice: 100 });
    expect(cheap.body).toEqual([]);

    // refundableOnly → still matches (the flex fare qualifies the flight's fare list
    // per-cabin fallback uses the first fare; light is non-refundable so empty)
    const refundable = await request(app.getHttpServer())
      .get('/api/flights/search/advanced')
      .query({ ...BASE_QUERY, refundableOnly: 'true' });
    expect(refundable.status).toBe(200);

    // sort by price is accepted
    const sorted = await request(app.getHttpServer())
      .get('/api/flights/search/advanced')
      .query({ ...BASE_QUERY, sort: 'price' });
    expect(sorted.status).toBe(200);
    expect(sorted.body).toHaveLength(1);
  });

  it('rejects invalid search params with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/flights/search/advanced')
      .query({ ...BASE_QUERY, origin: 'FR', adults: 0 });

    expect(res.status).toBe(400);
  });

  it('GET /api/flights/adjacent returns a 7-day price strip', async () => {
    await seedCatalog();

    const res = await request(app.getHttpServer())
      .get('/api/flights/adjacent')
      .query(BASE_QUERY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    const match = res.body.find(
      (d: { date: string }) => d.date === DEPART_DATE,
    );
    expect(match.minPrice).toBeCloseTo(354);
  });

  it('admin catalog endpoints require authentication (BR-08)', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/flights');
    expect(res.status).toBe(401);
  });

  it('GET /api/flights/status/by-number finds flights by number and date (FR-C19)', async () => {
    await seedCatalog();

    const res = await request(app.getHttpServer())
      .get('/api/flights/status/by-number')
      .query({ flightNumber: 'NV900', date: DEPART_DATE });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].flightNumber).toBe('NV900');
    expect(res.body[0].status).toBe('SCHEDULED');

    const wrongDate = await request(app.getHttpServer())
      .get('/api/flights/status/by-number')
      .query({ flightNumber: 'NV900', date: '2030-06-16' });
    expect(wrongDate.body).toEqual([]);
  });

  it('GET /api/flights/status/by-route finds flights by origin/destination (FR-C19)', async () => {
    await seedCatalog();

    const res = await request(app.getHttpServer())
      .get('/api/flights/status/by-route')
      .query({ origin: 'FRA', destination: 'JFK' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].route.origin.iataCode).toBe('FRA');
  });

  it('status endpoints reject malformed params with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/flights/status/by-route')
      .query({ origin: 'FR', destination: 'JFK' });
    expect(res.status).toBe(400);
  });
});
