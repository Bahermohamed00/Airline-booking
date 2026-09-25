import { PrismaClient, CabinClass, UserStatus, AircraftStatus, AirportStatus, RouteStatus, FlightStatus, BookingStatus, PaymentStatus, LoyaltyTier, Role, Permission, User, Aircraft, Airport, Route, Flight, Fare } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function hash(password: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id (its Algorithm const enum breaks isolatedModules)
  return argonHash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

const AIRPORTS: Array<Pick<Airport, 'iataCode' | 'icaoCode' | 'name' | 'city' | 'country' | 'timezone' | 'latitude' | 'longitude'>> = [
  { iataCode: 'FRA', icaoCode: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin', latitude: 50.0379, longitude: 8.5622 },
  { iataCode: 'MUC', icaoCode: 'EDDM', name: 'Munich Airport', city: 'Munich', country: 'Germany', timezone: 'Europe/Berlin', latitude: 48.3538, longitude: 11.7861 },
  { iataCode: 'HAM', icaoCode: 'EDDH', name: 'Hamburg Airport', city: 'Hamburg', country: 'Germany', timezone: 'Europe/Berlin', latitude: 53.6304, longitude: 9.9882 },
  { iataCode: 'LHR', icaoCode: 'EGLL', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', timezone: 'Europe/London', latitude: 51.47, longitude: -0.4614 },
  { iataCode: 'JFK', icaoCode: 'KJFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', timezone: 'America/New_York', latitude: 40.6413, longitude: -73.7781 },
  { iataCode: 'LAX', icaoCode: 'KLAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', timezone: 'America/Los_Angeles', latitude: 33.9416, longitude: -118.4085 },
  { iataCode: 'CDG', icaoCode: 'LFPG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', timezone: 'Europe/Paris', latitude: 49.0097, longitude: 2.5479 },
  { iataCode: 'AMS', icaoCode: 'EHAM', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam', latitude: 52.3105, longitude: 4.7683 },
  { iataCode: 'SIN', icaoCode: 'WSSS', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore', latitude: 1.3644, longitude: 103.9915 },
  { iataCode: 'DXB', icaoCode: 'OMDB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai', latitude: 25.2532, longitude: 55.3657 },
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
  { resource: 'settings', action: 'manage', description: 'Manage system settings' },
];

const ROLE_DEFS: Array<{ name: string; description: string; permissions: Array<{ resource: string; action: string }>; isSuperAdmin?: boolean }> = [
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
    ],
  },
  {
    name: 'Booking Manager',
    description: 'Manages reservations',
    permissions: [
      { resource: 'bookings', action: 'read' },
      { resource: 'bookings', action: 'manage' },
      { resource: 'users', action: 'read' },
    ],
  },
  {
    name: 'Finance Staff',
    description: 'Views payments and refunds',
    permissions: [
      { resource: 'payments', action: 'read' },
      { resource: 'payments', action: 'refund' },
      { resource: 'reports', action: 'read' },
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
        const perm = allPermissions.find((p) => p.resource === wanted.resource && p.action === wanted.action);
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
  const defs = [
    { registration: 'D-AIRA', model: 'Airbus A320-200', capacity: 180 },
    { registration: 'D-AIRB', model: 'Airbus A321-200', capacity: 220 },
    { registration: 'D-ABYA', model: 'Boeing 747-8', capacity: 364 },
    { registration: 'D-AIXA', model: 'Airbus A350-900', capacity: 319 },
  ];

  const created: Aircraft[] = [];
  for (const d of defs) {
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

    const seats: Array<{ seatNumber: string; cabinClass: CabinClass; seatRow: number; seatColumn: string; isExitRow: boolean }> = [];
    const totalRows = Math.ceil(ac.capacity / 6);
    let count = 0;
    for (let row = 1; row <= totalRows && count < ac.capacity; row++) {
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
        if (count >= ac.capacity) break;
        const cabinClass = row <= 2 && ac.capacity >= 300 ? CabinClass.FIRST : row <= 6 && ac.capacity >= 220 ? CabinClass.BUSINESS : CabinClass.ECONOMY;
        seats.push({
          seatNumber: `${row}${col}`,
          cabinClass,
          seatRow: row,
          seatColumn: col,
          isExitRow: row === 12 || row === 25,
        });
        count++;
      }
    }

    await prisma.seat.createMany({ data: seats.map((s) => ({ ...s, aircraftId: ac.id, features: {} })) });
  }
}

async function seedRoutes(airports: Airport[]): Promise<Route[]> {
  const pairs = [
    { origin: 'FRA', dest: 'JFK' },
    { origin: 'FRA', dest: 'LAX' },
    { origin: 'FRA', dest: 'SIN' },
    { origin: 'FRA', dest: 'DXB' },
    { origin: 'MUC', dest: 'LHR' },
    { origin: 'MUC', dest: 'CDG' },
    { origin: 'HAM', dest: 'AMS' },
    { origin: 'JFK', dest: 'LAX' },
  ];

  const created: Route[] = [];
  for (const pair of pairs) {
    const origin = airports.find((a) => a.iataCode === pair.origin)!;
    const dest = airports.find((a) => a.iataCode === pair.dest)!;
    const route = await prisma.route.upsert({
      where: { originAirportId_destinationAirportId: { originAirportId: origin.id, destinationAirportId: dest.id } },
      update: {},
      create: {
        originAirportId: origin.id,
        destinationAirportId: dest.id,
        status: RouteStatus.ACTIVE,
      },
    });
    created.push(route);
  }
  return created;
}

async function seedFlights(routes: Route[], aircraft: Aircraft[]): Promise<Flight[]> {
  const existing = await prisma.flight.count();
  if (existing > 0) {
    return prisma.flight.findMany();
  }

  const flights: Flight[] = [];
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  for (let day = 0; day < 14; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + day);

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const ac = aircraft[i % aircraft.length];
      const departure = new Date(date);
      departure.setHours(8 + (i % 12), (i % 2) * 30, 0, 0);
      const arrival = new Date(departure.getTime() + (8 + (i % 5)) * 60 * 60 * 1000);

      const flight = await prisma.flight.create({
        data: {
          flightNumber: `LH${100 + i}`,
          routeId: route.id,
          aircraftId: ac.id,
          departureTime: departure,
          arrivalTime: arrival,
          status: FlightStatus.SCHEDULED,
        },
      });

      const origin = await prisma.route.findUnique({ where: { id: route.id }, include: { originAirport: true, destinationAirport: true } });
      if (origin) {
        await prisma.flightSegment.create({
          data: {
            flightId: flight.id,
            segmentNumber: 1,
            originAirportId: origin.originAirportId,
            destinationAirportId: origin.destinationAirportId,
            departureTime: departure,
            arrivalTime: arrival,
          },
        });
      }

      await prisma.fare.createMany({
        data: [
          { flightId: flight.id, cabinClass: CabinClass.ECONOMY, basePrice: 299 + i * 10, taxAmount: 45, feeAmount: 10, currency: 'EUR', availableCount: ac.capacity - 20 },
          { flightId: flight.id, cabinClass: CabinClass.BUSINESS, basePrice: 1299 + i * 50, taxAmount: 120, feeAmount: 50, currency: 'EUR', availableCount: 20 },
        ],
      });

      flights.push(flight);
    }
  }

  return flights;
}

async function seedDemoBooking(customer: User): Promise<void> {
  const existing = await prisma.booking.findFirst({ where: { userId: customer.id } });
  if (existing) return;

  const flight = await prisma.flight.findFirst({
    include: { route: { include: { originAirport: true, destinationAirport: true } }, fares: true, aircraft: true },
  });
  if (!flight) return;

  const fare = flight.fares.find((f) => f.cabinClass === CabinClass.ECONOMY) ?? flight.fares[0];

  await prisma.booking.create({
    data: {
      bookingReference: generateBookingReference(),
      userId: customer.id,
      status: BookingStatus.CONFIRMED,
      totalAmount: fare.basePrice,
      currency: fare.currency,
      contactEmail: customer.email,
      bookingPassengers: {
        create: [
          {
            passenger: {
              create: {
                userId: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
              },
            },
            passengerType: 'ADULT',
          },
        ],
      },
      payments: {
        create: {
          amount: fare.basePrice,
          currency: fare.currency,
          status: PaymentStatus.SUCCESS,
          provider: 'mock',
          providerReference: `mock_${generateBookingReference()}`,
          paidAt: new Date(),
        },
      },
    },
  });
}

async function seedLoyalty(customer: User): Promise<void> {
  await prisma.loyaltyAccount.upsert({
    where: { userId: customer.id },
    update: {},
    create: {
      userId: customer.id,
      memberNumber: `LH${Math.floor(10000000 + Math.random() * 90000000)}`,
      tier: LoyaltyTier.SILVER,
      balance: 12500,
    },
  });
}

async function seedSystemSettings(): Promise<void> {
  const settings = [
    { key: 'seat_hold_minutes', value: '15', category: 'booking', isPublic: true, description: 'Minutes a seat hold stays active during checkout' },
    { key: 'check_in_opens_hours', value: '24', category: 'operations', isPublic: true, description: 'Hours before departure when online check-in opens' },
    { key: 'default_currency', value: 'EUR', category: 'localization', isPublic: true, description: 'Default currency for new bookings' },
    { key: 'cancellation_fee_percent', value: '10', category: 'finance', isPublic: false, description: 'Default cancellation fee percentage' },
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
  await seedFlights(routes, aircraft);
  await seedDemoBooking(customer);
  await seedLoyalty(customer);
  await seedSystemSettings();

  // eslint-disable-next-line no-console
  console.log(`Seeded: ${permissions.length} permissions, ${roles.length} roles, ${airports.length} airports, ${aircraft.length} aircraft, ${routes.length} routes`);
  // eslint-disable-next-line no-console
  console.log(`Users: admin=${admin.email} / customer=${customer.email}`);
}

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
