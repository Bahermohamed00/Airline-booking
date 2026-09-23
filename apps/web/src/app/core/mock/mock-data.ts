// Realistic mock data shaped after the Prisma entities. Stable UUIDs and
// real timestamps — replaceable by the NestJS API without changing shapes.

import type {
  Airport, Aircraft, Route, Seat, Flight, Fare, Booking, Passenger,
  ExtraService, LoyaltyAccount, NotificationItem, AuditLog, Baggage,
  CheckIn, User, Role, CabinClass, FlightStatus, BookingStatus, Payment,
} from '../models/domain.model';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function iso(d: Date): string {
  return d.toISOString();
}
function dayAt(offsetDays: number, hour: number, minute = 0): Date {
  const d = new Date(now + offsetDays * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ---------- Airports ----------

export const AIRPORTS: Airport[] = [
  { id: 'a1000000-0000-4000-8000-000000000001', iataCode: 'FRA', icaoCode: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000002', iataCode: 'MUC', icaoCode: 'EDDM', name: 'Munich Airport', city: 'Munich', country: 'Germany', timezone: 'Europe/Berlin', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000003', iataCode: 'HAM', icaoCode: 'EDDH', name: 'Hamburg Airport', city: 'Hamburg', country: 'Germany', timezone: 'Europe/Berlin', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000004', iataCode: 'LHR', icaoCode: 'EGLL', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', timezone: 'Europe/London', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000005', iataCode: 'JFK', icaoCode: 'KJFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', timezone: 'America/New_York', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000006', iataCode: 'LAX', icaoCode: 'KLAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', timezone: 'America/Los_Angeles', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000007', iataCode: 'CDG', icaoCode: 'LFPG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', timezone: 'Europe/Paris', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000008', iataCode: 'AMS', icaoCode: 'EHAM', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000009', iataCode: 'SIN', icaoCode: 'WSSS', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore', status: 'ACTIVE' },
  { id: 'a1000000-0000-4000-8000-000000000010', iataCode: 'DXB', icaoCode: 'OMDB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai', status: 'ACTIVE' },
];

export function airportByCode(code: string): Airport {
  const a = AIRPORTS.find((x) => x.iataCode === code);
  if (!a) throw new Error(`Unknown airport ${code}`);
  return a;
}

// ---------- Aircraft & seats ----------

function buildSeats(aircraftId: string, capacity: number): Seat[] {
  const seats: Seat[] = [];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  const totalRows = Math.ceil(capacity / 6);
  let count = 0;
  for (let row = 1; row <= totalRows && count < capacity; row++) {
    for (const col of cols) {
      if (count >= capacity) break;
      const cabin: CabinClass =
        row <= 2 && capacity >= 300 ? 'FIRST' : row <= 6 && capacity >= 220 ? 'BUSINESS' : 'ECONOMY';
      seats.push({
        id: `${aircraftId.slice(0, 8)}-s${row}${col}`,
        aircraftId,
        seatNumber: `${row}${col}`,
        cabinClass: cabin,
        seatRow: row,
        seatColumn: col,
        isExitRow: row === 12 || row === 25,
        features: {},
      });
      count++;
    }
  }
  return seats;
}

function makeAircraft(id: string, registration: string, model: string, capacity: number): Aircraft {
  return { id, registration, model, capacity, status: 'ACTIVE', seats: buildSeats(id, capacity) };
}

export const AIRCRAFT: Aircraft[] = [
  makeAircraft('c1000000-0000-4000-8000-000000000001', 'NA-320A', 'Airbus A320-200', 180),
  makeAircraft('c1000000-0000-4000-8000-000000000002', 'NA-321B', 'Airbus A321-200', 220),
  makeAircraft('c1000000-0000-4000-8000-000000000003', 'NA-748X', 'Boeing 747-8', 364),
  makeAircraft('c1000000-0000-4000-8000-000000000004', 'NA-359Y', 'Airbus A350-900', 319),
];

// ---------- Routes ----------

function makeRoute(num: number, originCode: string, destCode: string, km: number, mins: number): Route {
  return {
    id: `b1000000-0000-4000-8000-${String(num).padStart(12, '0')}`,
    originAirportId: airportByCode(originCode).id,
    destinationAirportId: airportByCode(destCode).id,
    origin: airportByCode(originCode),
    destination: airportByCode(destCode),
    distanceKm: km,
    durationMinutes: mins,
    status: 'ACTIVE',
  };
}

export const ROUTES: Route[] = [
  makeRoute(1, 'FRA', 'JFK', 6201, 505),
  makeRoute(2, 'FRA', 'LAX', 9324, 700),
  makeRoute(3, 'FRA', 'SIN', 10278, 740),
  makeRoute(4, 'FRA', 'DXB', 4843, 375),
  makeRoute(5, 'MUC', 'LHR', 942, 120),
  makeRoute(6, 'MUC', 'CDG', 840, 110),
  makeRoute(7, 'HAM', 'AMS', 379, 65),
  makeRoute(8, 'JFK', 'LAX', 3983, 355),
  makeRoute(9, 'FRA', 'LHR', 656, 95),
  makeRoute(10, 'FRA', 'MUC', 300, 55),
];

// ---------- Fares ----------

function makeFare(flightId: string, cabin: CabinClass, base: number, available: number, flexible: boolean): Fare {
  const rules = flexible
    ? {
        refundable: true, changeAllowed: true, changeFee: 0, cancellationFeePercent: 0,
        checkedBaggagePieces: 2, checkedBaggageWeightKg: 32, carryOnPieces: 2,
        seatSelectionFee: 0, priorityBoarding: true, loungeAccess: true,
        description: 'Fully flexible fare with free changes and refunds.',
      }
    : cabin === 'ECONOMY'
      ? {
          refundable: false, changeAllowed: true, changeFee: 90, cancellationFeePercent: 100,
          checkedBaggagePieces: 1, checkedBaggageWeightKg: 23, carryOnPieces: 1,
          seatSelectionFee: 15, priorityBoarding: false, loungeAccess: false,
          description: 'Economy Light — changes for a fee, non-refundable.',
        }
      : {
          refundable: true, changeAllowed: true, changeFee: 0, cancellationFeePercent: 10,
          checkedBaggagePieces: 2, checkedBaggageWeightKg: 32, carryOnPieces: 2,
          seatSelectionFee: 0, priorityBoarding: true, loungeAccess: true,
          description: 'Premium fare with included seat selection and lounge access.',
        };
  return {
    id: `${flightId}-fare-${cabin.toLowerCase()}`,
    flightId,
    cabinClass: cabin,
    basePrice: base,
    taxAmount: Math.round(base * 0.16 * 100) / 100,
    feeAmount: Math.round(base * 0.04 * 100) / 100,
    currency: 'EUR',
    availableCount: available,
    rules,
  };
}

// ---------- Flights ----------

const FLIGHT_NUMBER_PREFIX = 'NV';

function makeFlight(num: number, route: Route, aircraft: Aircraft, dayOffset: number, hour: number, minute: number, status: FlightStatus, flightNo: number): Flight {
  const dep = dayAt(dayOffset, hour, minute);
  const arr = new Date(dep.getTime() + (route.durationMinutes ?? 120) * 60000);
  const id = `f1000000-0000-4000-8000-${String(num).padStart(12, '0')}`;
  const longHaul = (route.distanceKm ?? 0) > 3000;
  const econBase = longHaul ? 349 + num * 3 : 89 + num * 4;
  return {
    id,
    flightNumber: `${FLIGHT_NUMBER_PREFIX}${flightNo}`,
    routeId: route.id,
    route,
    aircraftId: aircraft.id,
    aircraft,
    departureTime: iso(dep),
    arrivalTime: iso(arr),
    status,
    scheduleStatus: status === 'DELAYED' ? 'DELAYED' : status === 'CANCELLED' ? 'CANCELLED' : 'ONTIME',
    segments: [
      {
        id: `${id}-seg1`,
        flightId: id,
        segmentNumber: 1,
        originAirportId: route.originAirportId,
        origin: route.origin,
        destinationAirportId: route.destinationAirportId,
        destination: route.destination,
        departureTime: iso(dep),
        arrivalTime: iso(arr),
      },
    ],
    fares: [
      makeFare(id, 'ECONOMY', econBase, 24, false),
      makeFare(id, 'ECONOMY', Math.round(econBase * 1.6), 9, true),
      ...(aircraft.capacity >= 220 ? [makeFare(id, 'BUSINESS', econBase * 4, 6, false)] : []),
    ],
  };
}

export const FLIGHTS: Flight[] = [
  // today
  makeFlight(1, ROUTES[0], AIRCRAFT[3], 0, 8, 30, 'COMPLETED', 100),
  makeFlight(2, ROUTES[0], AIRCRAFT[2], 0, 13, 15, 'ACTIVE', 102),
  makeFlight(3, ROUTES[3], AIRCRAFT[0], 0, 10, 45, 'DELAYED', 220),
  makeFlight(4, ROUTES[4], AIRCRAFT[0], 0, 15, 30, 'SCHEDULED', 340),
  makeFlight(5, ROUTES[6], AIRCRAFT[1], 0, 18, 5, 'CANCELLED', 410),
  // tomorrow
  makeFlight(6, ROUTES[0], AIRCRAFT[3], 1, 9, 0, 'SCHEDULED', 100),
  makeFlight(7, ROUTES[1], AIRCRAFT[2], 1, 11, 30, 'SCHEDULED', 150),
  makeFlight(8, ROUTES[2], AIRCRAFT[3], 1, 14, 20, 'SCHEDULED', 170),
  makeFlight(9, ROUTES[4], AIRCRAFT[0], 1, 7, 45, 'SCHEDULED', 340),
  makeFlight(10, ROUTES[8], AIRCRAFT[0], 1, 16, 10, 'SCHEDULED', 360),
  // +2 days
  makeFlight(11, ROUTES[0], AIRCRAFT[3], 2, 8, 30, 'SCHEDULED', 100),
  makeFlight(12, ROUTES[5], AIRCRAFT[1], 2, 9, 55, 'SCHEDULED', 510),
  makeFlight(13, ROUTES[7], AIRCRAFT[2], 2, 12, 40, 'SCHEDULED', 610),
  makeFlight(14, ROUTES[9], AIRCRAFT[0], 2, 17, 25, 'SCHEDULED', 700),
  // +3..7 days across routes for search breadth
  makeFlight(15, ROUTES[1], AIRCRAFT[2], 3, 10, 5, 'SCHEDULED', 150),
  makeFlight(16, ROUTES[3], AIRCRAFT[0], 3, 19, 30, 'SCHEDULED', 220),
  makeFlight(17, ROUTES[8], AIRCRAFT[0], 4, 8, 15, 'SCHEDULED', 360),
  makeFlight(18, ROUTES[0], AIRCRAFT[3], 5, 13, 15, 'SCHEDULED', 102),
  makeFlight(19, ROUTES[2], AIRCRAFT[3], 6, 15, 45, 'SCHEDULED', 170),
  makeFlight(20, ROUTES[7], AIRCRAFT[2], 7, 11, 20, 'SCHEDULED', 610),
];

// ---------- Extras ----------

export const EXTRAS: ExtraService[] = [
  { id: 'e1000000-0000-4000-8000-000000000001', code: 'BAG23', name: 'Extra checked bag (23 kg)', description: 'One additional checked bag up to 23 kg.', price: 65, currency: 'EUR', category: 'BAGGAGE' },
  { id: 'e1000000-0000-4000-8000-000000000002', code: 'MEAL', name: 'Premium meal', description: 'Chef-curated hot meal with drinks.', price: 24, currency: 'EUR', category: 'MEAL' },
  { id: 'e1000000-0000-4000-8000-000000000003', code: 'LOUNGE', name: 'Lounge access', description: 'Airport lounge access at departure.', price: 39, currency: 'EUR', category: 'LOUNGE' },
  { id: 'e1000000-0000-4000-8000-000000000004', code: 'PRIO', name: 'Priority boarding', description: 'Board among the first groups.', price: 12, currency: 'EUR', category: 'PRIORITY' },
  { id: 'e1000000-0000-4000-8000-000000000005', code: 'INSURE', name: 'Travel insurance', description: 'Trip cancellation and medical cover.', price: 29, currency: 'EUR', category: 'INSURANCE' },
];

// ---------- Users, roles, passengers ----------

export const ROLES: Role[] = [
  { id: 'd1000000-0000-4000-8000-000000000001', name: 'Super Admin', description: 'Full system access', isSuperAdmin: true, permissions: ['super_admin'] },
  { id: 'd1000000-0000-4000-8000-000000000002', name: 'Flight Manager', description: 'Flight operations', isSuperAdmin: false, permissions: ['flights:read', 'flights:manage', 'airports:manage', 'aircraft:manage', 'routes:manage'] },
  { id: 'd1000000-0000-4000-8000-000000000003', name: 'Booking Manager', description: 'Reservations', isSuperAdmin: false, permissions: ['bookings:read', 'bookings:manage', 'users:read'] },
  { id: 'd1000000-0000-4000-8000-000000000004', name: 'Finance Staff', description: 'Payments & refunds', isSuperAdmin: false, permissions: ['payments:read', 'payments:refund', 'reports:read'] },
  { id: 'd1000000-0000-4000-8000-000000000005', name: 'Support Staff', description: 'Customer support', isSuperAdmin: false, permissions: ['users:read', 'bookings:read', 'baggage:manage', 'checkin:manage'] },
  { id: 'd1000000-0000-4000-8000-000000000006', name: 'Customer', description: 'Traveller account', isSuperAdmin: false, permissions: [] },
];

export const DEMO_CUSTOMER: User = {
  id: '90000000-0000-4000-8000-000000000001',
  email: 'customer@example.com',
  firstName: 'Lena',
  lastName: 'Hoffmann',
  phone: '+49 170 1234567',
  emailVerified: true,
  mfaEnabled: false,
  status: 'ACTIVE',
  roles: ['Customer'],
  permissions: [],
};

export const STAFF_USERS: User[] = [
  { id: '91000000-0000-4000-8000-000000000001', email: 'admin@novaair.dev', firstName: 'Marcus', lastName: 'Steiner', emailVerified: true, mfaEnabled: true, status: 'ACTIVE', roles: ['Super Admin'], permissions: ['super_admin'] },
  { id: '91000000-0000-4000-8000-000000000002', email: 'ops@novaair.dev', firstName: 'Aisha', lastName: 'Rahman', emailVerified: true, mfaEnabled: true, status: 'ACTIVE', roles: ['Flight Manager'], permissions: ROLES[1].permissions },
  { id: '91000000-0000-4000-8000-000000000003', email: 'bookings@novaair.dev', firstName: 'Tom', lastName: 'Becker', emailVerified: true, mfaEnabled: false, status: 'ACTIVE', roles: ['Booking Manager'], permissions: ROLES[2].permissions },
  { id: '91000000-0000-4000-8000-000000000004', email: 'finance@novaair.dev', firstName: 'Priya', lastName: 'Nair', emailVerified: true, mfaEnabled: false, status: 'ACTIVE', roles: ['Finance Staff'], permissions: ROLES[3].permissions },
];

export const PASSENGERS: Passenger[] = [
  { id: '92000000-0000-4000-8000-000000000001', userId: DEMO_CUSTOMER.id, firstName: 'Lena', lastName: 'Hoffmann', dateOfBirth: '1992-04-18', passportNumber: 'C01X00T47', nationality: 'Germany' },
  { id: '92000000-0000-4000-8000-000000000002', userId: DEMO_CUSTOMER.id, firstName: 'Jonas', lastName: 'Hoffmann', dateOfBirth: '2016-09-02', passportNumber: 'C01X00T48', nationality: 'Germany' },
];

// ---------- Demo bookings ----------

function makePayment(id: string, bookingId: string, amount: number, currency: string, createdDaysAgo: number): Payment {
  return {
    id,
    bookingId,
    amount,
    currency,
    status: 'SUCCESS',
    provider: 'mockpay',
    providerReference: `mp_${id.slice(0, 8)}`,
    paidAt: iso(dayAt(-createdDaysAgo, 12, 0)),
    createdAt: iso(dayAt(-createdDaysAgo, 12, 0)),
  };
}

export const BOOKINGS: Booking[] = [
  {
    id: '93000000-0000-4000-8000-000000000001',
    bookingReference: 'NVA7K2',
    userId: DEMO_CUSTOMER.id,
    status: 'CONFIRMED',
    totalAmount: 763.34,
    currency: 'EUR',
    bookedAt: iso(dayAt(-12, 14, 22)),
    contactEmail: DEMO_CUSTOMER.email,
    contactPhone: DEMO_CUSTOMER.phone ?? null,
    flightId: FLIGHTS[6].id,
    flight: FLIGHTS[6],
    passengers: [
      { id: '93000000-0000-4000-8000-00000000b001', passengerId: PASSENGERS[0].id, passenger: PASSENGERS[0], passengerType: 'ADULT' },
      { id: '93000000-0000-4000-8000-00000000b002', passengerId: PASSENGERS[1].id, passenger: PASSENGERS[1], passengerType: 'CHILD' },
    ],
    seats: [
      { id: '93000000-0000-4000-8000-00000000c001', bookingPassengerId: '93000000-0000-4000-8000-00000000b001', flightSegmentId: FLIGHTS[6].segments[0].id, seatId: FLIGHTS[6].aircraft.seats[83].id, seatNumber: '14C' },
      { id: '93000000-0000-4000-8000-00000000c002', bookingPassengerId: '93000000-0000-4000-8000-00000000b002', flightSegmentId: FLIGHTS[6].segments[0].id, seatId: FLIGHTS[6].aircraft.seats[84].id, seatNumber: '14D' },
    ],
    extras: [
      { id: '93000000-0000-4000-8000-00000000e001', extraServiceId: EXTRAS[0].id, extraService: EXTRAS[0], quantity: 1, price: 65 },
    ],
    payments: [makePayment('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 763.34, 'EUR', 12)],
    refunds: [],
  },
  {
    id: '93000000-0000-4000-8000-000000000002',
    bookingReference: 'NVM3P8',
    userId: DEMO_CUSTOMER.id,
    status: 'CONFIRMED',
    totalAmount: 402.9,
    currency: 'EUR',
    bookedAt: iso(dayAt(-5, 9, 41)),
    contactEmail: DEMO_CUSTOMER.email,
    contactPhone: null,
    flightId: FLIGHTS[9].id,
    flight: FLIGHTS[9],
    passengers: [
      { id: '93000000-0000-4000-8000-00000000b003', passengerId: PASSENGERS[0].id, passenger: PASSENGERS[0], passengerType: 'ADULT' },
    ],
    seats: [
      { id: '93000000-0000-4000-8000-00000000c003', bookingPassengerId: '93000000-0000-4000-8000-00000000b003', flightSegmentId: FLIGHTS[9].segments[0].id, seatId: FLIGHTS[9].aircraft.seats[41].id, seatNumber: '7C' },
    ],
    extras: [],
    payments: [makePayment('94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', 402.9, 'EUR', 5)],
    refunds: [],
  },
  {
    id: '93000000-0000-4000-8000-000000000003',
    bookingReference: 'NVQ1W9',
    userId: DEMO_CUSTOMER.id,
    status: 'CANCELLED',
    totalAmount: 189.0,
    currency: 'EUR',
    bookedAt: iso(dayAt(-40, 16, 3)),
    contactEmail: DEMO_CUSTOMER.email,
    contactPhone: null,
    flightId: FLIGHTS[0].id,
    flight: FLIGHTS[0],
    passengers: [
      { id: '93000000-0000-4000-8000-00000000b004', passengerId: PASSENGERS[0].id, passenger: PASSENGERS[0], passengerType: 'ADULT' },
    ],
    seats: [],
    extras: [],
    payments: [{ ...makePayment('94000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003', 189.0, 'EUR', 40), status: 'REFUNDED' }],
    refunds: [
      { id: '95000000-0000-4000-8000-000000000001', paymentId: '94000000-0000-4000-8000-000000000003', bookingId: '93000000-0000-4000-8000-000000000003', amount: 170.1, currency: 'EUR', status: 'PROCESSED', reason: 'Customer cancellation', processedAt: iso(dayAt(-38, 10, 0)), createdAt: iso(dayAt(-39, 11, 30)) },
    ],
  },
];

// ---------- Baggage ----------

export const BAGGAGE: Baggage[] = [
  {
    id: '96000000-0000-4000-8000-000000000001',
    bookingPassengerId: '93000000-0000-4000-8000-00000000b001',
    type: 'CHECKED',
    weightKg: 21,
    pieces: 1,
    tagNumber: 'NV400123456',
    status: 'IN_TRANSIT',
    events: [
      { id: '96000000-0000-4000-8000-00000000e001', baggageId: '96000000-0000-4000-8000-000000000001', eventType: 'CHECKED_IN', location: 'FRA Terminal 1', occurredAt: iso(dayAt(0, 6, 40)) },
      { id: '96000000-0000-4000-8000-00000000e002', baggageId: '96000000-0000-4000-8000-000000000001', eventType: 'LOADED', location: 'FRA Ramp B12', occurredAt: iso(dayAt(0, 8, 5)) },
      { id: '96000000-0000-4000-8000-00000000e003', baggageId: '96000000-0000-4000-8000-000000000001', eventType: 'IN_TRANSIT', location: 'En route to JFK', occurredAt: iso(dayAt(0, 8, 45)) },
    ],
  },
];

// ---------- Check-in ----------

export const CHECK_INS: CheckIn[] = [];

// ---------- Loyalty ----------

export const LOYALTY: LoyaltyAccount = {
  id: '97000000-0000-4000-8000-000000000001',
  userId: DEMO_CUSTOMER.id,
  memberNumber: 'NV20468135',
  tier: 'SILVER',
  balance: 12480,
  transactions: [
    { id: '97000000-0000-4000-8000-00000000e001', loyaltyAccountId: '97000000-0000-4000-8000-000000000001', bookingId: BOOKINGS[0].id, amount: 1240, type: 'EARN', description: 'Flight NV100 FRA→JFK (2 pax)', createdAt: iso(dayAt(-12, 15, 0)) },
    { id: '97000000-0000-4000-8000-00000000e002', loyaltyAccountId: '97000000-0000-4000-8000-000000000001', bookingId: BOOKINGS[1].id, amount: 420, type: 'EARN', description: 'Flight NV340 MUC→LHR', createdAt: iso(dayAt(-5, 10, 0)) },
    { id: '97000000-0000-4000-8000-00000000e003', loyaltyAccountId: '97000000-0000-4000-8000-000000000001', amount: -2000, type: 'BURN', description: 'Redeemed: lounge voucher', createdAt: iso(dayAt(-30, 12, 0)) },
    { id: '97000000-0000-4000-8000-00000000e004', loyaltyAccountId: '97000000-0000-4000-8000-000000000001', amount: 500, type: 'ADJUSTMENT', description: 'Service recovery credit', createdAt: iso(dayAt(-60, 9, 0)) },
  ],
};

// ---------- Notifications ----------

export const NOTIFICATIONS: NotificationItem[] = [
  { id: '98000000-0000-4000-8000-000000000001', userId: DEMO_CUSTOMER.id, bookingId: BOOKINGS[0].id, channel: 'EMAIL', status: 'DELIVERED', subject: 'Booking confirmed — NVA7K2', content: 'Your booking NVA7K2 for NV100 FRA→JFK is confirmed. Online check-in opens 24 h before departure.', sentAt: iso(dayAt(-12, 14, 25)), createdAt: iso(dayAt(-12, 14, 24)) },
  { id: '98000000-0000-4000-8000-000000000002', userId: DEMO_CUSTOMER.id, bookingId: BOOKINGS[1].id, channel: 'EMAIL', status: 'SENT', subject: 'Check-in opens tomorrow — NVM3P8', content: 'Online check-in for your flight NV340 MUC→LHR opens 24 hours before departure.', sentAt: iso(dayAt(0, 7, 0)), createdAt: iso(dayAt(0, 7, 0)) },
  { id: '98000000-0000-4000-8000-000000000003', userId: DEMO_CUSTOMER.id, channel: 'IN_APP', status: 'DELIVERED', subject: 'Schedule change on NV220', content: 'Flight NV220 FRA→DXB today is delayed by approximately 45 minutes.', sentAt: iso(dayAt(0, 8, 30)), createdAt: iso(dayAt(0, 8, 30)) },
];

// ---------- Audit log ----------

export const AUDIT_LOGS: AuditLog[] = [
  { id: '99000000-0000-4000-8000-000000000001', actorId: STAFF_USERS[0].id, actorType: 'Staff', actorName: 'Marcus Steiner', action: 'USER_CREATED', targetType: 'User', targetId: DEMO_CUSTOMER.id, metadata: { source: 'seed' }, createdAt: iso(dayAt(-90, 10, 0)) },
  { id: '99000000-0000-4000-8000-000000000002', actorId: STAFF_USERS[1].id, actorType: 'Staff', actorName: 'Aisha Rahman', action: 'FLIGHT_RESCHEDULED', targetType: 'Flight', targetId: FLIGHTS[2].id, metadata: { previousDeparture: iso(dayAt(0, 10, 0)), newDeparture: iso(dayAt(0, 10, 45)) }, createdAt: iso(dayAt(0, 7, 55)) },
  { id: '99000000-0000-4000-8000-000000000003', actorId: STAFF_USERS[3].id, actorType: 'Staff', actorName: 'Priya Nair', action: 'REFUND_PROCESSED', targetType: 'Refund', targetId: '95000000-0000-4000-8000-000000000001', metadata: { amount: 170.1, currency: 'EUR' }, createdAt: iso(dayAt(-38, 10, 0)) },
];

export function flightById(id: string): Flight | undefined {
  return FLIGHTS.find((f) => f.id === id);
}
export function bookingByReference(ref: string): Booking | undefined {
  return BOOKINGS.find((b) => b.bookingReference.toUpperCase() === ref.toUpperCase());
}
