import {
  PrismaClient,
  CabinClass,
  UserStatus,
  AircraftStatus,
  AirportStatus,
  RouteStatus,
  BookingStatus,
  PaymentStatus,
  LoyaltyTier,
  Weekday,
  ScheduleRuleStatus,
  OfferStatus,
  Role,
  Permission,
  User,
  Aircraft,
  Airport,
  Route,
  ScheduleRule,
  Offer,
} from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import { pathToFileURL } from 'node:url';
import {
  generateFlights,
  operatingDateOfFlight,
} from '../apps/api/src/flights/flight-generator.js';
import { generateSeatMap } from '../apps/api/src/aircraft/seat-map.js';
import { generateBookingReference } from '../apps/api/src/bookings/booking-reference.js';
import { refundPolicyFromFareRules } from '../apps/api/src/payments/refund-policy.js';

const prisma = new PrismaClient();

/** Fictional airline identity for all seeded operational identifiers. */
export const AIRLINE_CODE = 'NV';

/** NovaAir fleet — fictional registrations; models/capacities are the locked fleet definition. */
export const AIRCRAFT_DEFS: Array<Pick<Aircraft, 'registration' | 'model' | 'capacity'>> = [
  { registration: 'NV-320A', model: 'Airbus A320-200', capacity: 180 },
  { registration: 'NV-321B', model: 'Airbus A321-200', capacity: 220 },
  { registration: 'NV-748X', model: 'Boeing 747-8', capacity: 364 },
  { registration: 'NV-359Y', model: 'Airbus A350-900', capacity: 319 },
];

/** One daily flight number per seeded route: NV100..NV1xx in route order. */
export function seededFlightNumbers(routeCount: number): string[] {
  return Array.from({ length: routeCount }, (_, i) => `${AIRLINE_CODE}${100 + i}`);
}

/** Fictional NovaAir loyalty member number: airline code + 8 digits. */
export function generateLoyaltyMemberNumber(): string {
  return `${AIRLINE_CODE}${Math.floor(10000000 + Math.random() * 90000000)}`;
}

async function hash(password: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id (its Algorithm const enum breaks isolatedModules)
  return argonHash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

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

const PERMISSIONS: Array<Pick<Permission, 'resource' | 'action' | 'description'>> = [
  { resource: 'users', action: 'read', description: 'View user accounts' },
  { resource: 'users', action: 'create', description: 'Create user accounts' },
  { resource: 'users', action: 'update', description: 'Update user accounts' },
  { resource: 'users', action: 'delete', description: 'Deactivate user accounts' },
  { resource: 'staff', action: 'manage', description: 'Manage staff accounts' },
  { resource: 'roles', action: 'manage', description: 'Manage roles and permissions' },
  { resource: 'flights', action: 'read', description: 'View flights' },
  { resource: 'flights', action: 'manage', description: 'Create/update flights' },
  { resource: 'airports', action: 'manage', description: 'Manage airports' },
  { resource: 'aircraft', action: 'manage', description: 'Manage aircraft' },
  { resource: 'routes', action: 'manage', description: 'Manage routes' },
  { resource: 'bookings', action: 'read', description: 'View bookings' },
  { resource: 'bookings', action: 'manage', description: 'Manage bookings' },
  { resource: 'payments', action: 'read', description: 'View payments' },
  { resource: 'payments', action: 'refund', description: 'Process refunds' },
  { resource: 'baggage', action: 'manage', description: 'Manage baggage records' },
  { resource: 'checkin', action: 'manage', description: 'Manage check-in and boarding' },
  { resource: 'loyalty', action: 'manage', description: 'Manage loyalty accounts' },
  { resource: 'notifications', action: 'manage', description: 'Manage notifications' },
  { resource: 'reports', action: 'read', description: 'View and export reports' },
  { resource: 'audit', action: 'read', description: 'View audit logs' },
  { resource: 'dashboard', action: 'read', description: 'View operations dashboard' },
  { resource: 'settings', action: 'manage', description: 'Manage system settings' },
  { resource: 'offers', action: 'read', description: 'View offer catalog' },
  { resource: 'offers', action: 'manage', description: 'Manage offers' },
];

const ROLE_DEFS: Array<{
  name: string;
  description: string;
  permissions: Array<{ resource: string; action: string }>;
  isSuperAdmin?: boolean;
}> = [
  {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: [],
    isSuperAdmin: true,
  },
  {
    name: 'Administrator',
    description: 'Access to assigned administrative modules',
    permissions: [
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'update' },
      { resource: 'users', action: 'delete' },
      { resource: 'bookings', action: 'read' },
      { resource: 'bookings', action: 'manage' },
      { resource: 'reports', action: 'read' },
      { resource: 'audit', action: 'read' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Flight Manager',
    description: 'Manages flight operations',
    permissions: [
      { resource: 'flights', action: 'read' },
      { resource: 'flights', action: 'manage' },
      { resource: 'airports', action: 'manage' },
      { resource: 'aircraft', action: 'manage' },
      { resource: 'routes', action: 'manage' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Booking Manager',
    description: 'Manages reservations',
    permissions: [
      { resource: 'bookings', action: 'read' },
      { resource: 'bookings', action: 'manage' },
      { resource: 'users', action: 'read' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Finance Staff',
    description: 'Views payments and refunds',
    permissions: [
      { resource: 'payments', action: 'read' },
      { resource: 'payments', action: 'refund' },
      { resource: 'reports', action: 'read' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Support Staff',
    description: 'Customer and booking support',
    permissions: [
      { resource: 'users', action: 'read' },
      { resource: 'bookings', action: 'read' },
      { resource: 'baggage', action: 'manage' },
      { resource: 'checkin', action: 'manage' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
];

async function seedPermissions(): Promise<Permission[]> {
  const created: Permission[] = [];
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: {},
      create: p,
    });
    created.push(perm);
  }
  return created;
}

async function seedRoles(allPermissions: Permission[]): Promise<Role[]> {
  const created: Role[] = [];
  for (const def of ROLE_DEFS) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: {
        description: def.description,
        isSuperAdmin: def.isSuperAdmin ?? false,
      },
      create: {
        name: def.name,
        description: def.description,
        isSuperAdmin: def.isSuperAdmin ?? false,
      },
    });

    if (!def.isSuperAdmin) {
      for (const wanted of def.permissions) {
        const perm = allPermissions.find(
          (p) => p.resource === wanted.resource && p.action === wanted.action,
        );
        if (perm) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
            update: {},
            create: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }
    created.push(role);
  }
  return created;
}

async function seedUsers(superAdminRole: Role): Promise<{ admin: User; customer: User }> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@airline.local' },
    update: {},
    create: {
      email: 'admin@airline.local',
      passwordHash: await hash('Admin123!'),
      firstName: 'System',
      lastName: 'Administrator',
      emailVerified: true,
      status: UserStatus.ACTIVE,
      userRoles: {
        create: { roleId: superAdminRole.id },
      },
    },
  });

  const customerRole = await prisma.role.upsert({
    where: { name: 'Customer' },
    update: {},
    create: { name: 'Customer', description: 'Default customer role' },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: await hash('Customer123!'),
      firstName: 'Demo',
      lastName: 'Customer',
      emailVerified: true,
      status: UserStatus.ACTIVE,
      userRoles: {
        create: { roleId: customerRole.id },
      },
    },
  });

  return { admin, customer };
}

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

const ALL_DAYS: Weekday[] = [
  Weekday.MON,
  Weekday.TUE,
  Weekday.WED,
  Weekday.THU,
  Weekday.FRI,
  Weekday.SAT,
  Weekday.SUN,
];
const WEEKDAYS: Weekday[] = [Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI];

interface ScheduleRuleDef {
  flightNumber: string;
  origin: string;
  destination: string;
  aircraftRegistration: string;
  departureTimeLocal: string;
  operatingDays: Weekday[];
}

/**
 * NovaAir schedule rules — the single source of truth for generated flights.
 * NV100–NV107 are the daily base rotations (they adopt the Phase 1 flights);
 * NV200+ are additional weekday-pattern frequencies on existing routes.
 */
export const SCHEDULE_RULE_DEFS: ScheduleRuleDef[] = [
  {
    flightNumber: 'NV100',
    origin: 'FRA',
    destination: 'JFK',
    aircraftRegistration: 'NV-359Y',
    departureTimeLocal: '08:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV101',
    origin: 'FRA',
    destination: 'LAX',
    aircraftRegistration: 'NV-748X',
    departureTimeLocal: '09:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV102',
    origin: 'FRA',
    destination: 'SIN',
    aircraftRegistration: 'NV-748X',
    departureTimeLocal: '10:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV103',
    origin: 'FRA',
    destination: 'DXB',
    aircraftRegistration: 'NV-321B',
    departureTimeLocal: '11:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV104',
    origin: 'MUC',
    destination: 'LHR',
    aircraftRegistration: 'NV-320A',
    departureTimeLocal: '12:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV105',
    origin: 'MUC',
    destination: 'CDG',
    aircraftRegistration: 'NV-321B',
    departureTimeLocal: '13:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV106',
    origin: 'HAM',
    destination: 'AMS',
    aircraftRegistration: 'NV-320A',
    departureTimeLocal: '14:00',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV107',
    origin: 'JFK',
    destination: 'LAX',
    aircraftRegistration: 'NV-321B',
    departureTimeLocal: '15:30',
    operatingDays: ALL_DAYS,
  },
  {
    flightNumber: 'NV200',
    origin: 'FRA',
    destination: 'JFK',
    aircraftRegistration: 'NV-359Y',
    departureTimeLocal: '18:30',
    operatingDays: [Weekday.MON, Weekday.WED, Weekday.FRI, Weekday.SUN],
  },
  {
    flightNumber: 'NV201',
    origin: 'FRA',
    destination: 'SIN',
    aircraftRegistration: 'NV-748X',
    departureTimeLocal: '22:15',
    operatingDays: [Weekday.TUE, Weekday.THU, Weekday.SAT],
  },
  {
    flightNumber: 'NV202',
    origin: 'MUC',
    destination: 'LHR',
    aircraftRegistration: 'NV-320A',
    departureTimeLocal: '07:15',
    operatingDays: WEEKDAYS,
  },
];

async function seedScheduleRules(
  routes: Route[],
  aircraft: Aircraft[],
  airports: Airport[],
): Promise<ScheduleRule[]> {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const effectiveFrom = new Date(baseDate);
  effectiveFrom.setDate(effectiveFrom.getDate() - 7);
  const effectiveTo = new Date(baseDate);
  effectiveTo.setDate(effectiveTo.getDate() + 358);

  const routeByPair = (origin: string, destination: string): Route => {
    const o = airports.find((a) => a.iataCode === origin)!;
    const d = airports.find((a) => a.iataCode === destination)!;
    return routes.find((r) => r.originAirportId === o.id && r.destinationAirportId === d.id)!;
  };

  const rules: ScheduleRule[] = [];
  for (const def of SCHEDULE_RULE_DEFS) {
    const route = routeByPair(def.origin, def.destination);
    const ac = aircraft.find((a) => a.registration === def.aircraftRegistration)!;
    rules.push(
      await prisma.scheduleRule.upsert({
        where: { flightNumber: def.flightNumber },
        update: {
          routeId: route.id,
          aircraftId: ac.id,
          departureTimeLocal: def.departureTimeLocal,
          operatingDays: def.operatingDays,
          effectiveFrom,
          effectiveTo,
          status: ScheduleRuleStatus.ACTIVE,
        },
        create: {
          flightNumber: def.flightNumber,
          routeId: route.id,
          aircraftId: ac.id,
          departureTimeLocal: def.departureTimeLocal,
          operatingDays: def.operatingDays,
          effectiveFrom,
          effectiveTo,
          status: ScheduleRuleStatus.ACTIVE,
        },
      }),
    );
  }
  return rules;
}

/** Links pre-Phase-3 flights to their schedule rule by (flightNumber, route). */
async function adoptExistingFlights(rules: ScheduleRule[]): Promise<number> {
  const unlinked = await prisma.flight.findMany({
    where: { scheduleRuleId: null },
    include: { route: { include: { originAirport: true } } },
  });
  let adopted = 0;
  for (const flight of unlinked) {
    const rule = rules.find(
      (r) => r.flightNumber === flight.flightNumber && r.routeId === flight.routeId,
    );
    if (!rule) continue;
    const operatingDate = operatingDateOfFlight(
      flight.departureTime,
      flight.route.originAirport.timezone,
    );
    await prisma.flight.update({
      where: { id: flight.id },
      data: { scheduleRuleId: rule.id, operatingDate: new Date(`${operatingDate}T00:00:00Z`) },
    });
    adopted++;
  }
  return adopted;
}

const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Generates the rolling 14-day flight window from the active schedule rules. */
async function seedGenerateFlights(): Promise<void> {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 13);
  const summary = await generateFlights(prisma, isoLocal(from), isoLocal(to));
  // eslint-disable-next-line no-console
  console.log(
    `Flights ${isoLocal(from)} → ${isoLocal(to)}: ${summary.flightsCreated} created, ${summary.flightsUpdated} updated; ` +
      `fares ${summary.faresCreated} created, ${summary.faresUpdated} updated; skipped rules: ${summary.skippedRules.length}`,
  );
}

/**
 * Demo CONFIRMED booking for the demo customer: full fare total (base + tax +
 * fee), a matching SUCCESS payment, a fare-rules snapshot, and BookingSeat rows
 * on every segment — the same invariants the real payment flow produces.
 */
async function seedDemoBooking(customer: User): Promise<void> {
  const existing = await prisma.booking.findFirst({ where: { userId: customer.id } });
  if (existing) return;

  const flight = await prisma.flight.findFirst({
    where: { status: 'SCHEDULED', departureTime: { gt: new Date() } },
    orderBy: { departureTime: 'asc' },
    include: {
      fares: { where: { cabinClass: CabinClass.ECONOMY } },
      segments: { orderBy: { segmentNumber: 'asc' } },
    },
  });
  const fare = flight?.fares[0];
  if (!flight || !fare || flight.segments.length === 0) return;

  // First economy seat not already occupied by another booking on this flight.
  const seat = await prisma.seat.findFirst({
    where: {
      aircraftId: flight.aircraftId,
      cabinClass: CabinClass.ECONOMY,
      bookingSeats: { none: { flightSegment: { flightId: flight.id } } },
    },
    orderBy: { seatNumber: 'asc' },
  });
  if (!seat) return;

  const perPassenger = {
    basePrice: Number(fare.basePrice),
    taxAmount: Number(fare.taxAmount),
    feeAmount: Number(fare.feeAmount),
  };
  const totalAmount = perPassenger.basePrice + perPassenger.taxAmount + perPassenger.feeAmount;
  const refundPolicy = refundPolicyFromFareRules(fare.fareRules);

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        bookingReference: generateBookingReference(),
        userId: customer.id,
        status: BookingStatus.CONFIRMED,
        totalAmount,
        currency: fare.currency,
        contactEmail: customer.email,
        fareRulesSnapshot: {
          cabinClass: CabinClass.ECONOMY,
          perPassenger: { ...perPassenger, total: totalAmount },
          passengerCount: 1,
          refundPolicy: refundPolicy
            ? {
                refundable: refundPolicy.refundable,
                cancellationFeePercent: refundPolicy.cancellationFeePercent,
              }
            : null,
        },
      },
    });
    const passenger = await tx.passenger.create({
      data: { userId: customer.id, firstName: customer.firstName, lastName: customer.lastName },
    });
    const bookingPassenger = await tx.bookingPassenger.create({
      data: { bookingId: booking.id, passengerId: passenger.id, passengerType: 'ADULT' },
    });
    for (const segment of flight.segments) {
      await tx.bookingSeat.create({
        data: {
          bookingPassengerId: bookingPassenger.id,
          flightSegmentId: segment.id,
          seatId: seat.id,
          seatNumber: seat.seatNumber,
        },
      });
    }
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: totalAmount,
        currency: fare.currency,
        status: PaymentStatus.SUCCESS,
        provider: 'mock',
        providerReference: `mock_seed_${booking.bookingReference}`,
        paidAt: new Date(),
      },
    });
  });
}

/**
 * Phase 4 sample: one deterministic PENDING booking for the demo customer with
 * one passenger and one ACTIVE seat hold — deliberately no payment row.
 * Payments arrive in a later phase; this booking must stay pre-payment.
 */
async function seedPendingBooking(customer: User): Promise<void> {
  const reference = 'NVPEND01';
  const existing = await prisma.booking.findUnique({ where: { bookingReference: reference } });
  if (existing) return;

  const flight = await prisma.flight.findFirst({
    where: { status: 'SCHEDULED', departureTime: { gt: new Date() } },
    orderBy: { departureTime: 'asc' },
    include: { fares: { where: { cabinClass: CabinClass.ECONOMY } } },
  });
  const fare = flight?.fares[0];
  if (!flight || !fare) return;

  // First economy seat not already occupied on this flight — the demo CONFIRMED
  // booking may sit on the same flight (it is seeded first).
  const seat = await prisma.seat.findFirst({
    where: {
      aircraftId: flight.aircraftId,
      cabinClass: CabinClass.ECONOMY,
      bookingSeats: { none: { flightSegment: { flightId: flight.id } } },
    },
    orderBy: { seatNumber: 'asc' },
  });
  if (!seat) return;

  const totalAmount = Number(fare.basePrice) + Number(fare.taxAmount) + Number(fare.feeAmount);
  const perPassenger = {
    basePrice: Number(fare.basePrice),
    taxAmount: Number(fare.taxAmount),
    feeAmount: Number(fare.feeAmount),
    total: totalAmount,
  };
  const refundPolicy = refundPolicyFromFareRules(fare.fareRules);

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        bookingReference: reference,
        userId: customer.id,
        status: BookingStatus.PENDING,
        totalAmount,
        currency: fare.currency,
        contactEmail: customer.email,
        fareRulesSnapshot: {
          cabinClass: CabinClass.ECONOMY,
          perPassenger,
          passengerCount: 1,
          refundPolicy: refundPolicy
            ? {
                refundable: refundPolicy.refundable,
                cancellationFeePercent: refundPolicy.cancellationFeePercent,
              }
            : null,
        },
      },
    });
    const passenger = await tx.passenger.create({
      data: { userId: customer.id, firstName: customer.firstName, lastName: customer.lastName },
    });
    await tx.bookingPassenger.create({
      data: { bookingId: booking.id, passengerId: passenger.id, passengerType: 'ADULT' },
    });
    await tx.seatHold.create({
      data: {
        flightId: flight.id,
        seatId: seat.id,
        userId: customer.id,
        bookingId: booking.id,
        status: 'ACTIVE',
        // Demo hold stays payable on the seed day; real checkout holds use SEAT_HOLD_MINUTES.
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
    });
  });
}

/**
 * Fictional NovaAir marketing offers (Phase 5). Deterministic and idempotent
 * via upsert on the unique title; validity windows roll with the seed date.
 * Marketing data only — no connection to fares, bookings, or pricing.
 */
async function seedOffers(): Promise<number> {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const validFrom = new Date(baseDate);
  validFrom.setDate(validFrom.getDate() - 7);
  const validUntil = new Date(baseDate);
  validUntil.setDate(validUntil.getDate() + 60);

  const active = { status: OfferStatus.ACTIVE, validFrom, validUntil };
  const defs: Array<
    Pick<
      Offer,
      | 'title'
      | 'description'
      | 'badge'
      | 'destination'
      | 'offerValue'
      | 'terms'
      | 'imageUrl'
      | 'status'
      | 'validFrom'
      | 'validUntil'
    >
  > = [
    {
      title: 'Transatlantic Business',
      description:
        'Fully flat seats, lounge access, and priority everything on our flagship route to New York.',
      badge: '−30% Business',
      destination: 'Frankfurt → New York',
      offerValue: 'from €1,899',
      terms:
        'One-way Business Class fare, taxes included. Subject to availability on NV100/NV200 departures.',
      imageUrl: 'assets/img/dest-nyc.jpg',
      ...active,
    },
    {
      title: 'London City Break',
      description: 'Weekend-ready fares with hand baggage included — hourly shuttle every weekday.',
      badge: 'City break',
      destination: 'Frankfurt → London',
      offerValue: 'from €89',
      terms:
        'One-way Economy Light fare, hand baggage only. Weekend departures until the end of the season.',
      imageUrl: 'assets/img/dest-london.jpg',
      ...active,
    },
    {
      title: 'Winter Sun in Dubai',
      description:
        'Trade the cold for the coast — daily nonstop flights and a free date change on this fare.',
      badge: 'Winter sun',
      destination: 'Frankfurt → Dubai',
      offerValue: 'from €349',
      terms:
        'One-way Economy fare, taxes included. Free one-time date change up to 7 days before departure.',
      imageUrl: 'assets/img/dest-dubai.jpg',
      ...active,
    },
    {
      title: 'Paris Weekend Escape',
      description: 'One hour in the air, a weekend in the City of Light — up to six flights a day.',
      badge: 'City break',
      destination: 'Frankfurt → Paris',
      offerValue: 'from €99',
      terms: 'One-way Economy Light fare, hand baggage only. Year-round departures.',
      imageUrl: 'assets/img/dest-paris.jpg',
      ...active,
    },
    {
      title: 'Singapore Early Bird',
      description: 'Night flights and our newest cabin, nonstop to Changi — book early and save.',
      badge: 'Early bird',
      destination: 'Frankfurt → Singapore',
      offerValue: 'from €549',
      terms: 'One-way Economy fare with extra 10 kg baggage allowance. Booking window limited.',
      imageUrl: 'assets/img/dest-singapore.jpg',
      ...active,
    },
    {
      title: 'West Coast Family Getaway',
      description: 'Golden-hour arrivals on our afternoon nonstop service to Los Angeles.',
      badge: 'Family fare',
      destination: 'Frankfurt → Los Angeles',
      offerValue: 'from €329',
      terms: 'One-way Economy fare, free standard seat selection for families of 3+.',
      imageUrl: 'assets/img/dest-la.jpg',
      ...active,
    },
    {
      title: 'Summer 2027 Sneak Preview',
      description: 'Something is taking off next summer. Watch this space.',
      badge: 'Coming soon',
      destination: 'NovaAir network',
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: OfferStatus.DRAFT,
      validFrom,
      validUntil,
    },
    {
      title: 'Autumn Flash Sale',
      description: 'A short-lived flash sale that has already ended.',
      badge: 'Ended',
      destination: 'NovaAir network',
      offerValue: 'was −25%',
      terms: null,
      imageUrl: null,
      status: OfferStatus.EXPIRED,
      validFrom: new Date(baseDate.getTime() - 90 * 86_400_000),
      validUntil: new Date(baseDate.getTime() - 60 * 86_400_000),
    },
  ];

  for (const def of defs) {
    await prisma.offer.upsert({
      where: { title: def.title },
      update: { ...def },
      create: { ...def },
    });
  }
  return defs.length;
}

async function seedLoyalty(customer: User): Promise<void> {
  await prisma.loyaltyAccount.upsert({
    where: { userId: customer.id },
    update: {},
    create: {
      userId: customer.id,
      memberNumber: generateLoyaltyMemberNumber(),
      tier: LoyaltyTier.SILVER,
      balance: 12500,
    },
  });
}

async function seedSystemSettings(): Promise<void> {
  const settings = [
    {
      key: 'seat_hold_minutes',
      value: '15',
      category: 'booking',
      isPublic: true,
      description: 'Minutes a seat hold stays active during checkout',
    },
    {
      key: 'check_in_opens_hours',
      value: '24',
      category: 'operations',
      isPublic: true,
      description: 'Hours before departure when online check-in opens',
    },
    {
      key: 'default_currency',
      value: 'EUR',
      category: 'localization',
      isPublic: true,
      description: 'Default currency for new bookings',
    },
    {
      key: 'cancellation_fee_percent',
      value: '10',
      category: 'finance',
      isPublic: false,
      description: 'Default cancellation fee percentage',
    },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
}

async function main(): Promise<void> {
  const permissions = await seedPermissions();
  const roles = await seedRoles(permissions);
  const superAdminRole = roles.find((r) => r.name === 'Super Admin')!;
  const { admin, customer } = await seedUsers(superAdminRole);
  const airports = await seedAirports();
  const aircraft = await seedAircraft();
  await seedSeats(aircraft);
  const routes = await seedRoutes(airports);
  const scheduleRules = await seedScheduleRules(routes, aircraft, airports);
  const adopted = await adoptExistingFlights(scheduleRules);
  await seedGenerateFlights();
  await seedDemoBooking(customer);
  await seedPendingBooking(customer);
  await seedLoyalty(customer);
  const offers = await seedOffers();
  await seedSystemSettings();

  // eslint-disable-next-line no-console
  console.log(
    `Seeded: ${permissions.length} permissions, ${roles.length} roles, ${airports.length} airports, ${aircraft.length} aircraft, ${routes.length} routes, ${scheduleRules.length} schedule rules (${adopted} flights adopted), ${offers} offers`,
  );
  // eslint-disable-next-line no-console
  console.log(`Users: admin=${admin.email} / customer=${customer.email}`);
}

// Only run when executed directly (e.g. `tsx prisma/seed.ts`); importing this
// file for its constants/helpers must not touch the database.
const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
