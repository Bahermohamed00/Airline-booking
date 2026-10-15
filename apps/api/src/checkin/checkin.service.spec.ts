import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CheckinService } from './checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BaggageService } from '../baggage/baggage.service';

const user = { userId: 'user-1', email: 'customer@example.com', roles: ['Customer'], permissions: [] };

const SEGMENT_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';
const BP1_ID = '33333333-3333-4333-8333-333333333333';
const BP2_ID = '44444444-4444-4444-8444-444444444444';

const flightFixture = (departureTime: Date) => ({
  id: 'flight-1',
  flightNumber: 'NV100',
  departureTime,
  arrivalTime: new Date(departureTime.getTime() + 505 * 60000),
  route: {
    originAirport: { iataCode: 'FRA', city: 'Frankfurt' },
    destinationAirport: { iataCode: 'JFK', city: 'New York' },
  },
  segments: [{ id: SEGMENT_ID, segmentNumber: 1 }],
});

const passengerFixture = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  passengerType: 'ADULT',
  passenger: { firstName: 'Lena', lastName: 'Hoffmann' },
  seats: [{ flightSegmentId: SEGMENT_ID, seatNumber: '12A' }],
  checkIns: [],
  baggage: [],
  ...overrides,
});

const bookingFixture = (departureTime: Date, overrides: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  bookingReference: 'NV8K4P2',
  userId: user.userId,
  status: 'CONFIRMED',
  contactEmail: user.email,
  fareRulesSnapshot: { cabinClass: 'ECONOMY' },
  bookedAt: new Date(),
  bookingPassengers: [passengerFixture(BP1_ID)],
  bookingExtras: [] as unknown[],
  seatHolds: [{ flight: flightFixture(departureTime) }],
  ...overrides,
});

/** A purchased extras line (BookingExtra) with its live catalog row joined. */
const extraLineFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'be-1',
  bookingId: BOOKING_ID,
  extraServiceId: 'es-bag23',
  bookingPassengerId: BP1_ID,
  quantity: 2,
  category: 'BAGGAGE',
  extraService: { id: 'es-bag23', code: 'BAG_23KG', metadata: { bagWeightKg: 23 } },
  ...overrides,
});

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['booking_passenger_id', 'flight_segment_id'] },
  });

const createMockPrisma = () => {
  const tx = {
    checkIn: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    boardingPass: { upsert: vi.fn() },
    booking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    booking: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ status: 'CHECKED_IN' }),
    },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

describe('CheckinService', () => {
  let service: CheckinService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let auditLog: ReturnType<typeof vi.fn>;
  let baggage: { issueCheckedBags: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    auditLog = vi.fn().mockResolvedValue(undefined);
    baggage = { issueCheckedBags: vi.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: BaggageService, useValue: baggage },
      ],
    }).compile();
    service = module.get(CheckinService);
  });

  // ---------- Lookup ----------

  it('lookup by reference returns only the caller\'s matching booking, case-insensitive', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));

    const result = await service.lookupBookings(user as never, { reference: ' nv8k4p2 ' } as never);

    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.userId, bookingReference: { equals: ' nv8k4p2 ', mode: 'insensitive' } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: BOOKING_ID,
      bookingReference: 'NV8K4P2',
      status: 'CONFIRMED',
      contactEmail: user.email,
      flight: {
        flightNumber: 'NV100',
        route: { originIata: 'FRA', destinationIata: 'JFK', originCity: 'Frankfurt', destinationCity: 'New York' },
      },
      segments: [{ id: SEGMENT_ID, segmentNumber: 1 }],
      passengers: [
        {
          bookingPassengerId: BP1_ID,
          firstName: 'Lena',
          lastName: 'Hoffmann',
          passengerType: 'ADULT',
          seatNumber: '12A',
          checkedIn: false,
        },
      ],
    });
    // No payment data, no totals.
    expect(result[0]).not.toHaveProperty('totalAmount');
    expect(result[0]).not.toHaveProperty('currency');
  });

  it('lookup by reference 404s when the booking is missing or belongs to someone else', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(service.lookupBookings(user as never, { reference: 'NVXXXXXX' } as never)).rejects.toThrow(NotFoundException);
    await service.lookupBookings(user as never, { reference: 'NVXXXXXX' } as never).catch((e) => {
      expect(e.getResponse()).toMatchObject({ code: 'BOOKING_NOT_FOUND' });
    });
  });

  it('lookup by email returns all of the caller\'s bookings when it matches the account email', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findMany.mockResolvedValue([bookingFixture(departure), bookingFixture(departure, { id: 'b-2' })]);

    const result = await service.lookupBookings(user as never, { email: 'Customer@Example.com' } as never);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.userId } }),
    );
    expect(result).toHaveLength(2);
  });

  it('lookup by email 400s EMAIL_MISMATCH when it differs from the account email', async () => {
    await expect(service.lookupBookings(user as never, { email: 'other@example.com' } as never)).rejects.toThrow(
      BadRequestException,
    );
    await service.lookupBookings(user as never, { email: 'other@example.com' } as never).catch((e) => {
      expect(e.getResponse()).toMatchObject({ code: 'EMAIL_MISMATCH' });
    });
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('lookup 400s when neither or both of reference/email are supplied', async () => {
    await expect(service.lookupBookings(user as never, {} as never)).rejects.toThrow(BadRequestException);
    await expect(
      service.lookupBookings(user as never, { reference: 'NV8K4P2', email: user.email } as never),
    ).rejects.toThrow(BadRequestException);
  });

  // ---------- Completion ----------

  const mockCompleteTx = () => {
    prisma.__tx.checkIn.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'ci-1',
        ...data,
        checkInTime: new Date(),
        status: 'COMPLETED',
      }),
    );
    prisma.__tx.boardingPass.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: 'bp-1', ...create, gate: null, qrCode: null, issuedAt: new Date() }),
    );
  };

  it('completes check-in: creates CheckIn + BoardingPass with cabin group and seat, returns the view', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    mockCompleteTx();

    const result = await service.completeCheckIn(user as never, {
      bookingId: BOOKING_ID,
      bookingPassengerId: BP1_ID,
    } as never);

    expect(prisma.__tx.checkIn.create).toHaveBeenCalledWith({
      data: { bookingPassengerId: BP1_ID, flightSegmentId: SEGMENT_ID },
    });
    expect(prisma.__tx.boardingPass.upsert).toHaveBeenCalledWith({
      where: { checkInId: 'ci-1' },
      create: { checkInId: 'ci-1', boardingGroup: 'C', seatNumber: '12A' },
      update: expect.objectContaining({ boardingGroup: 'C', seatNumber: '12A' }),
    });
    expect(result.checkIns).toHaveLength(1);
    expect(result.checkIns[0]).toMatchObject({
      id: 'ci-1',
      bookingPassengerId: BP1_ID,
      flightSegmentId: SEGMENT_ID,
      status: 'COMPLETED',
      boardingPass: { id: 'bp-1', boardingGroup: 'C', seatNumber: '12A', gate: null },
    });
    expect(result.bookingStatus).toBe('CHECKED_IN');
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CHECK_IN_COMPLETED', bookingId: BOOKING_ID }));
  });

  it('assigns boarding groups by cabin: FIRST/BUSINESS → A, PREMIUM_ECONOMY → B, ECONOMY → C', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    mockCompleteTx();

    for (const [cabinClass, group] of [
      ['FIRST', 'A'],
      ['BUSINESS', 'A'],
      ['PREMIUM_ECONOMY', 'B'],
      ['ECONOMY', 'C'],
    ] as const) {
      prisma.__tx.boardingPass.upsert.mockClear();
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture(departure, { fareRulesSnapshot: { cabinClass } }),
      );
      await service.completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never);
      expect(prisma.__tx.boardingPass.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ boardingGroup: group }),
        }),
      );
    }
  });

  it('flips CONFIRMED→CHECKED_IN via status-predicated CAS when all passengers are checked in', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    mockCompleteTx();
    prisma.__tx.checkIn.count.mockResolvedValue(1); // 1 of 1 passengers done

    await service.completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never);

    expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: 'CONFIRMED' },
      data: { status: 'CHECKED_IN' },
    });
  });

  it('leaves the booking CONFIRMED while other passengers are not checked in yet', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(
      bookingFixture(departure, { bookingPassengers: [passengerFixture(BP1_ID), passengerFixture(BP2_ID)] }),
    );
    mockCompleteTx();
    prisma.__tx.checkIn.count.mockResolvedValue(1); // 1 of 2 passengers done
    prisma.booking.findUniqueOrThrow.mockResolvedValue({ status: 'CONFIRMED' });

    const result = await service.completeCheckIn(user as never, {
      bookingId: BOOKING_ID,
      bookingPassengerId: BP1_ID,
    } as never);

    expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
    expect(result.bookingStatus).toBe('CONFIRMED');
  });

  it('404s BOOKING_NOT_FOUND for a missing or foreign booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(
      service.completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('404s PASSENGER_NOT_FOUND when the passenger belongs to another booking', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    await expect(
      service.completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP2_ID } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('409s CHECKIN_NOT_ELIGIBLE for PENDING and CANCELLED bookings', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    for (const status of ['PENDING', 'CANCELLED']) {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure, { status }));
      await service
        .completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never)
        .catch((e) => {
          expect(e).toBeInstanceOf(ConflictException);
          expect(e.getResponse()).toMatchObject({ code: 'CHECKIN_NOT_ELIGIBLE' });
        });
    }
  });

  it('409s CHECKIN_NOT_OPEN before departure−24h and allows the exact open boundary', async () => {
    // 48h out — not open yet.
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(new Date(Date.now() + 48 * 3_600_000)));
    await service
      .completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never)
      .catch((e) => {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse()).toMatchObject({ code: 'CHECKIN_NOT_OPEN' });
      });

    // Exactly 24h out — the boundary itself is eligible.
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(new Date(Date.now() + 24 * 3_600_000)));
    mockCompleteTx();
    const result = await service.completeCheckIn(user as never, {
      bookingId: BOOKING_ID,
      bookingPassengerId: BP1_ID,
    } as never);
    expect(result.checkIns).toHaveLength(1);
  });

  it('409s CHECKIN_CLOSED after departure−1h', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(new Date(Date.now() + 30 * 60_000)));
    await service
      .completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never)
      .catch((e) => {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse()).toMatchObject({ code: 'CHECKIN_CLOSED' });
      });
  });

  it('409s ALREADY_CHECKED_IN when a completed check-in exists, and on P2002 from the unique index', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(
      bookingFixture(departure, {
        bookingPassengers: [passengerFixture(BP1_ID, { checkIns: [{ status: 'COMPLETED' }] })],
      }),
    );
    await service
      .completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never)
      .catch((e) => {
        expect(e.getResponse()).toMatchObject({ code: 'ALREADY_CHECKED_IN' });
      });

    // Concurrent double-submit: the read shows no check-in but the unique index fires.
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    prisma.__tx.checkIn.create.mockRejectedValue(p2002());
    await service
      .completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never)
      .catch((e) => {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse()).toMatchObject({ code: 'ALREADY_CHECKED_IN' });
      });
  });

  // ---------- Baggage issuance at check-in ----------

  it('issues exactly the declared checked bags for the verified booking passenger and returns their tags', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    mockCompleteTx();
    baggage.issueCheckedBags.mockResolvedValue([
      { id: 'bag-1', tagNumber: 'NV48291037', status: 'CHECKED_IN' },
      { id: 'bag-2', tagNumber: 'NV01736485', status: 'CHECKED_IN' },
    ]);

    const result = await service.completeCheckIn(user as never, {
      bookingId: BOOKING_ID,
      bookingPassengerId: BP1_ID,
      checkedBagCount: 2,
    } as never);

    // Issuance runs inside the check-in transaction, scoped to the booking's
    // own booking-passenger row (never a client-trusted id) at the origin.
    // No purchased baggage allowance → no configured weights.
    expect(baggage.issueCheckedBags).toHaveBeenCalledWith(
      prisma.__tx,
      BP1_ID,
      2,
      'FRA online check-in',
      [],
    );
    expect(result.baggage).toEqual([
      { tagNumber: 'NV48291037', status: 'CHECKED_IN' },
      { tagNumber: 'NV01736485', status: 'CHECKED_IN' },
    ]);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CHECK_IN_COMPLETED', metadata: expect.objectContaining({ bagCount: 2 }) }),
    );
  });

  it('issues no baggage when none is declared (default) and never assumes a bag', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    mockCompleteTx();

    const result = await service.completeCheckIn(user as never, {
      bookingId: BOOKING_ID,
      bookingPassengerId: BP1_ID,
    } as never);

    expect(baggage.issueCheckedBags).not.toHaveBeenCalled();
    expect(result.baggage).toEqual([]);
  });

  it('a repeated/already-completed check-in never re-issues bags', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(
      bookingFixture(departure, {
        bookingPassengers: [passengerFixture(BP1_ID, { checkIns: [{ status: 'COMPLETED' }] })],
      }),
    );
    await service
      .completeCheckIn(user as never, {
        bookingId: BOOKING_ID,
        bookingPassengerId: BP1_ID,
        checkedBagCount: 2,
      } as never)
      .catch((e) => {
        expect(e.getResponse()).toMatchObject({ code: 'ALREADY_CHECKED_IN' });
      });
    expect(baggage.issueCheckedBags).not.toHaveBeenCalled();
  });

  it('a tag-issuance failure fails the whole check-in (transaction rolls back)', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    mockCompleteTx();
    baggage.issueCheckedBags.mockRejectedValue(
      new Error('BAG_TAG_ISSUANCE_FAILED'),
    );

    await expect(
      service.completeCheckIn(user as never, {
        bookingId: BOOKING_ID,
        bookingPassengerId: BP1_ID,
        checkedBagCount: 1,
      } as never),
    ).rejects.toThrow('BAG_TAG_ISSUANCE_FAILED');
  });

  it('cross-booking passenger ids are rejected before any issuance', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
    await service
      .completeCheckIn(user as never, {
        bookingId: BOOKING_ID,
        bookingPassengerId: BP2_ID,
        checkedBagCount: 1,
      } as never)
      .catch((e) => {
        expect(e.getResponse()).toMatchObject({ code: 'PASSENGER_NOT_FOUND' });
      });
    expect(baggage.issueCheckedBags).not.toHaveBeenCalled();
  });

  // ---------- Boarding passes ----------

  it('boardingPasses returns completed check-ins with passenger names and the flight summary', async () => {
    const departure = new Date(Date.now() + 12 * 3_600_000);
    const checkIn = {
      id: 'ci-1',
      bookingPassengerId: BP1_ID,
      flightSegmentId: SEGMENT_ID,
      checkInTime: new Date(),
      status: 'COMPLETED',
      boardingPass: { id: 'bp-1', boardingGroup: 'C', seatNumber: '12A', gate: null, issuedAt: new Date() },
    };
    prisma.booking.findFirst.mockResolvedValue(
      bookingFixture(departure, {
        status: 'CHECKED_IN',
        bookingPassengers: [
          passengerFixture(BP1_ID, {
            checkIns: [checkIn],
            baggage: [{ id: 'bag-1', tagNumber: 'NV48291037', status: 'CHECKED_IN' }],
          }),
        ],
      }),
    );

    const result = await service.boardingPasses(user as never, BOOKING_ID);

    expect(result).toMatchObject({
      id: BOOKING_ID,
      bookingReference: 'NV8K4P2',
      status: 'CHECKED_IN',
      flight: { flightNumber: 'NV100', route: { originIata: 'FRA', destinationIata: 'JFK' } },
    });
    expect(result.checkIns).toHaveLength(1);
    expect(result.checkIns[0]).toMatchObject({
      id: 'ci-1',
      passenger: { firstName: 'Lena', lastName: 'Hoffmann' },
      boardingPass: { boardingGroup: 'C', seatNumber: '12A', gate: null },
      // Issued bag tags travel with the owner's boarding-pass view.
      baggage: [{ tagNumber: 'NV48291037', status: 'CHECKED_IN' }],
    });
  });

  it('boardingPasses 404s for a missing or foreign booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(service.boardingPasses(user as never, BOOKING_ID)).rejects.toThrow(NotFoundException);
  });

  // ---------- Staff operations (admin check-in) ----------

  const staffUser = {
    userId: 'staff-1',
    email: 'ops@novaair.example',
    roles: ['Support Staff'],
    permissions: ['checkin:manage'],
  };

  const operationalBooking = (
    departure: Date,
    overrides: Record<string, unknown> = {},
  ) =>
    bookingFixture(departure, {
      seatHolds: [{ flight: { ...flightFixture(departure), status: 'SCHEDULED' } }],
      ...overrides,
    });

  describe('findOperationalList', () => {
    it('queries real confirmed/checked-in bookings with departures within the operational window', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const result = await service.findOperationalList();
      expect(result).toEqual([]);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
            seatHolds: { some: { flight: { departureTime: { gte: expect.any(Date) } } } },
          }),
        }),
      );
    });

    it('maps real check-in aggregates and the server-computed window state — sorted by departure', async () => {
      const openDep = new Date(Date.now() + 12 * 3_600_000); // inside the window
      const laterDep = new Date(Date.now() + 30 * 3_600_000); // not open yet
      prisma.booking.findMany.mockResolvedValue([
        operationalBooking(laterDep, { id: 'b-later', bookingReference: 'NVLATE' }),
        operationalBooking(openDep, {
          bookingPassengers: [
            passengerFixture(BP1_ID, { checkIns: [{ status: 'COMPLETED' }] }),
            passengerFixture(BP2_ID, { checkIns: [{ status: 'CANCELLED' }] }),
          ],
        }),
      ]);

      const result = await service.findOperationalList();

      expect(result).toHaveLength(2);
      // Sorted by departure time, soonest first.
      expect(result[0]).toMatchObject({
        bookingReference: 'NV8K4P2',
        status: 'CONFIRMED',
        passengersTotal: 2,
        checkedInCount: 1,
        invalidatedCount: 1,
        windowState: 'OPEN',
        flight: { flightNumber: 'NV100', status: 'SCHEDULED' },
      });
      expect(result[1]).toMatchObject({
        bookingReference: 'NVLATE',
        windowState: 'NOT_OPEN',
        checkedInCount: 0,
        invalidatedCount: 0,
      });
    });

    it('marks departures within 1h as CLOSED', async () => {
      const closedDep = new Date(Date.now() + 30 * 60_000);
      prisma.booking.findMany.mockResolvedValue([operationalBooking(closedDep)]);
      const result = await service.findOperationalList();
      expect(result[0].windowState).toBe('CLOSED');
    });

    it('a passenger invalidated then re-checked-in counts as checked in, not invalidated', async () => {
      const dep = new Date(Date.now() + 12 * 3_600_000);
      prisma.booking.findMany.mockResolvedValue([
        operationalBooking(dep, {
          bookingPassengers: [
            passengerFixture(BP1_ID, {
              checkIns: [{ status: 'CANCELLED' }, { status: 'COMPLETED' }],
            }),
          ],
        }),
      ]);
      const result = await service.findOperationalList();
      expect(result[0]).toMatchObject({ checkedInCount: 1, invalidatedCount: 0 });
    });
  });

  describe('invalidateBoardingPasses', () => {
    it('CAS-cancels active check-ins, falls the booking back to CONFIRMED, and audits the action', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue(
        operationalBooking(departure, { status: 'CHECKED_IN' }),
      );
      prisma.__tx.checkIn.updateMany.mockResolvedValue({ count: 1 });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ status: 'CONFIRMED' });

      const result = await service.invalidateBoardingPasses(staffUser as never, BOOKING_ID);

      expect(prisma.__tx.checkIn.updateMany).toHaveBeenCalledWith({
        where: { bookingPassenger: { bookingId: BOOKING_ID }, status: 'COMPLETED' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: BOOKING_ID, status: 'CHECKED_IN' },
        data: { status: 'CONFIRMED' },
      });
      expect(result).toEqual({
        bookingId: BOOKING_ID,
        invalidatedCount: 1,
        bookingStatus: 'CONFIRMED',
      });
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'staff-1',
          actorType: 'Staff',
          action: 'BOARDING_PASSES_INVALIDATED',
          bookingId: BOOKING_ID,
          metadata: expect.objectContaining({ invalidatedCount: 1 }),
        }),
      );
    });

    it('404s for an unknown booking', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.invalidateBoardingPasses(staffUser as never, BOOKING_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('409s when the booking is not in a check-in state (e.g. CANCELLED)', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue(
        operationalBooking(departure, { status: 'CANCELLED' }),
      );
      await expect(
        service.invalidateBoardingPasses(staffUser as never, BOOKING_ID),
      ).rejects.toMatchObject({ response: { code: 'CHECKIN_NOT_ELIGIBLE' } });
    });

    it('409s NO_ACTIVE_CHECKIN when nothing active exists — no write, no audit', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue(operationalBooking(departure));
      prisma.__tx.checkIn.updateMany.mockResolvedValue({ count: 0 }); // CAS lost / nothing active

      await expect(
        service.invalidateBoardingPasses(staffUser as never, BOOKING_ID),
      ).rejects.toMatchObject({ response: { code: 'NO_ACTIVE_CHECKIN' } });
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BOARDING_PASSES_INVALIDATED' }),
      );
    });
  });

  describe('re-check-in after invalidation (revival)', () => {
    it('revives a CANCELLED check-in in place, refreshes the pass, and never re-issues bags', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      // Read path: only a CANCELLED check-in exists → no ALREADY_CHECKED_IN.
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture(departure, {
          bookingPassengers: [
            passengerFixture(BP1_ID, { checkIns: [{ status: 'CANCELLED' }] }),
          ],
        }),
      );
      prisma.__tx.checkIn.create.mockRejectedValue(p2002());
      prisma.__tx.checkIn.findUnique.mockResolvedValue({ id: 'ci-old', status: 'CANCELLED' });
      prisma.__tx.checkIn.update.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'ci-old',
          bookingPassengerId: BP1_ID,
          flightSegmentId: SEGMENT_ID,
          ...data,
        }),
      );
      prisma.__tx.boardingPass.upsert.mockImplementation(({ create }) =>
        Promise.resolve({ id: 'bp-1', ...create, gate: null, qrCode: null, issuedAt: new Date() }),
      );

      const result = await service.completeCheckIn(user as never, {
        bookingId: BOOKING_ID,
        bookingPassengerId: BP1_ID,
        checkedBagCount: 2,
      } as never);

      // Revived in place — no new CheckIn row identity.
      expect(prisma.__tx.checkIn.update).toHaveBeenCalledWith({
        where: { id: 'ci-old', status: 'CANCELLED' },
        data: { status: 'COMPLETED', checkInTime: expect.any(Date) },
      });
      expect(result.checkIns[0]).toMatchObject({ id: 'ci-old', status: 'COMPLETED' });
      // Duplicate-issuance safety: revival never issues baggage again.
      expect(baggage.issueCheckedBags).not.toHaveBeenCalled();
      expect(result.baggage).toEqual([]);
    });

    it('still 409s when the unique-index row is COMPLETED (true double-submit)', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue(bookingFixture(departure));
      prisma.__tx.checkIn.create.mockRejectedValue(p2002());
      prisma.__tx.checkIn.findUnique.mockResolvedValue({ id: 'ci-1', status: 'COMPLETED' });

      await service
        .completeCheckIn(user as never, { bookingId: BOOKING_ID, bookingPassengerId: BP1_ID } as never)
        .catch((e) => {
          expect(e).toBeInstanceOf(ConflictException);
          expect(e.getResponse()).toMatchObject({ code: 'ALREADY_CHECKED_IN' });
        });
      expect(prisma.__tx.checkIn.update).not.toHaveBeenCalled();
    });
  });

  // ---------- Purchased baggage allowance → issuance weight ----------

  describe('baggage allowance from purchased extras', () => {
    const checkInWithBags = async (
      booking: unknown,
      checkedBagCount: number,
    ): Promise<void> => {
      prisma.booking.findFirst.mockResolvedValue(booking);
      mockCompleteTx();
      await service.completeCheckIn(user as never, {
        bookingId: BOOKING_ID,
        bookingPassengerId: BP1_ID,
        checkedBagCount,
      } as never);
    };

    const weightsArg = (): (number | null)[] =>
      baggage.issueCheckedBags.mock.calls[0]![4] as (number | null)[];

    it('assigns the configured per-piece weight to each purchased piece (2 × 23 kg declared and purchased)', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, { bookingExtras: [extraLineFixture()] }),
        2,
      );

      expect(baggage.issueCheckedBags).toHaveBeenCalledWith(
        prisma.__tx,
        BP1_ID,
        2,
        'FRA online check-in',
        [23, 23],
      );
    });

    it('purchase covers only the first declared bags — declared-beyond-purchase stays unweighted', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, { bookingExtras: [extraLineFixture()] }), // 2 purchased
        3,
      );

      expect(weightsArg()).toEqual([23, 23]); // bag 3 gets null inside issuance
    });

    it('ignores non-baggage extras entirely (a meal never creates weight or bags)', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, {
          bookingExtras: [
            extraLineFixture({
              category: 'MEAL',
              quantity: 1,
              extraService: { id: 'es-meal', code: 'MEAL_HOT', metadata: { dietaryTags: ['vegetarian'] } },
            }),
          ],
        }),
        1,
      );

      expect(weightsArg()).toEqual([]);
    });

    it('assigns allowance only to the passenger who purchased it', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, {
          bookingExtras: [extraLineFixture({ bookingPassengerId: BP2_ID })], // other passenger
        }),
        1,
      );

      expect(weightsArg()).toEqual([]);
    });

    it('does not attribute booking-scoped baggage lines (null passenger) to anyone', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, {
          bookingExtras: [extraLineFixture({ bookingPassengerId: null })],
        }),
        1,
      );

      expect(weightsArg()).toEqual([]);
    });

    it('a purchased piece with missing/invalid metadata weight stays honestly unrecorded', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, {
          bookingExtras: [
            extraLineFixture({
              quantity: 1,
              extraService: { id: 'es-legacy', code: 'BAG_LEGACY', metadata: null },
            }),
          ],
        }),
        1,
      );

      expect(weightsArg()).toEqual([null]);
    });

    it('quantities accumulate across multiple purchased lines', async () => {
      const departure = new Date(Date.now() + 12 * 3_600_000);
      await checkInWithBags(
        bookingFixture(departure, {
          bookingExtras: [
            extraLineFixture({ quantity: 1 }),
            extraLineFixture({
              id: 'be-2',
              extraServiceId: 'es-bag20',
              quantity: 1,
              extraService: { id: 'es-bag20', code: 'BAG_20KG', metadata: { bagWeightKg: 20 } },
            }),
          ],
        }),
        2,
      );

      expect(weightsArg()).toEqual([23, 20]);
    });
  });
});
