import { AircraftStatus, AirportStatus, RouteStatus, Aircraft, Airport, Route } from '@prisma/client';
import { generateSeatMap } from '../../apps/api/src/aircraft/seat-map.js';
import { prisma } from './shared.js';

/** NovaAir fleet — fictional registrations; models/capacities are the locked fleet definition. */
export const AIRCRAFT_DEFS: Array<Pick<Aircraft, 'registration' | 'model' | 'capacity'>> = [
  { registration: 'NV-320A', model: 'Airbus A320-200', capacity: 180 },
  { registration: 'NV-321B', model: 'Airbus A321-200', capacity: 220 },
  { registration: 'NV-748X', model: 'Boeing 747-8', capacity: 364 },
  { registration: 'NV-359Y', model: 'Airbus A350-900', capacity: 319 },
];

export const AIRPORTS: Array<
  Pick<
    Airport,
    'iataCode' | 'icaoCode' | 'name' | 'city' | 'country' | 'timezone' | 'latitude' | 'longitude'
  >
> = [
  {
    iataCode: 'FRA',
    icaoCode: 'EDDF',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    latitude: 50.0379,
    longitude: 8.5622,
  },
  {
    iataCode: 'MUC',
    icaoCode: 'EDDM',
    name: 'Munich Airport',
    city: 'Munich',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    latitude: 48.3538,
    longitude: 11.7861,
  },
  {
    iataCode: 'HAM',
    icaoCode: 'EDDH',
    name: 'Hamburg Airport',
    city: 'Hamburg',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    latitude: 53.6304,
    longitude: 9.9882,
  },
  {
    iataCode: 'LHR',
    icaoCode: 'EGLL',
    name: 'Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    latitude: 51.47,
    longitude: -0.4614,
  },
  {
    iataCode: 'JFK',
    icaoCode: 'KJFK',
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States',
    timezone: 'America/New_York',
    latitude: 40.6413,
    longitude: -73.7781,
  },
  {
    iataCode: 'LAX',
    icaoCode: 'KLAX',
    name: 'Los Angeles International Airport',
    city: 'Los Angeles',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    latitude: 33.9416,
    longitude: -118.4085,
  },
  {
    iataCode: 'CDG',
    icaoCode: 'LFPG',
    name: 'Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France',
    timezone: 'Europe/Paris',
    latitude: 49.0097,
    longitude: 2.5479,
  },
  {
    iataCode: 'AMS',
    icaoCode: 'EHAM',
    name: 'Amsterdam Airport Schiphol',
    city: 'Amsterdam',
    country: 'Netherlands',
    timezone: 'Europe/Amsterdam',
    latitude: 52.3105,
    longitude: 4.7683,
  },
  {
    iataCode: 'SIN',
    icaoCode: 'WSSS',
    name: 'Singapore Changi Airport',
    city: 'Singapore',
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    latitude: 1.3644,
    longitude: 103.9915,
  },
  {
    iataCode: 'DXB',
    icaoCode: 'OMDB',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    timezone: 'Asia/Dubai',
    latitude: 25.2532,
    longitude: 55.3657,
  },
];

async function seedAirports(): Promise<Airport[]> {
  const created: Airport[] = [];
  for (const a of AIRPORTS) {
    const airport = await prisma.airport.upsert({
      where: { iataCode: a.iataCode },
      update: {},
      create: { ...a, status: AirportStatus.ACTIVE },
    });
    created.push(airport);
  }
  return created;
}

async function seedAircraft(): Promise<Aircraft[]> {
  const created: Aircraft[] = [];
  for (const d of AIRCRAFT_DEFS) {
    const aircraft = await prisma.aircraft.upsert({
      where: { registration: d.registration },
      update: {},
      create: { ...d, status: AircraftStatus.ACTIVE },
    });
    created.push(aircraft);
  }
  return created;
}

async function seedSeats(aircraft: Aircraft[]): Promise<void> {
  for (const ac of aircraft) {
    const existing = await prisma.seat.count({ where: { aircraftId: ac.id } });
    if (existing > 0) continue;

    // Shared with the API's seat-map generator — never fork the layout here.
    const seats = generateSeatMap(ac.capacity);
    await prisma.seat.createMany({
      data: seats.map((s) => ({ ...s, aircraftId: ac.id, features: {} })),
    });
  }
}

async function seedRoutes(airports: Airport[]): Promise<Route[]> {
  const pairs = [
    { origin: 'FRA', dest: 'JFK', distanceKm: 6201, durationMinutes: 505 },
    { origin: 'FRA', dest: 'LAX', distanceKm: 9324, durationMinutes: 700 },
    { origin: 'FRA', dest: 'SIN', distanceKm: 10278, durationMinutes: 740 },
    { origin: 'FRA', dest: 'DXB', distanceKm: 4843, durationMinutes: 375 },
    { origin: 'MUC', dest: 'LHR', distanceKm: 942, durationMinutes: 120 },
    { origin: 'MUC', dest: 'CDG', distanceKm: 840, durationMinutes: 110 },
    { origin: 'HAM', dest: 'AMS', distanceKm: 379, durationMinutes: 65 },
    { origin: 'JFK', dest: 'LAX', distanceKm: 3983, durationMinutes: 355 },
  ];

  const created: Route[] = [];
  for (const pair of pairs) {
    const origin = airports.find((a) => a.iataCode === pair.origin)!;
    const dest = airports.find((a) => a.iataCode === pair.dest)!;
    const route = await prisma.route.upsert({
      where: {
        originAirportId_destinationAirportId: {
          originAirportId: origin.id,
          destinationAirportId: dest.id,
        },
      },
      // Reference-data correction (Phase 2): existing rows predate the distance fields.
      update: { distanceKm: pair.distanceKm, durationMinutes: pair.durationMinutes },
      create: {
        originAirportId: origin.id,
        destinationAirportId: dest.id,
        distanceKm: pair.distanceKm,
        durationMinutes: pair.durationMinutes,
        status: RouteStatus.ACTIVE,
      },
    });
    created.push(route);
  }
  return created;
}

export interface CatalogSeedResult {
  airports: Airport[];
  aircraft: Aircraft[];
  routes: Route[];
}

/** Catalog: airports, aircraft, their seat maps, and routes. */
export async function seedCatalog(): Promise<CatalogSeedResult> {
  const airports = await seedAirports();
  const aircraft = await seedAircraft();
  await seedSeats(aircraft);
  const routes = await seedRoutes(airports);
  return { airports, aircraft, routes };
}
