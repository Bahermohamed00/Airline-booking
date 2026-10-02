import { CabinClass, BookingStatus, PaymentStatus, User } from '@prisma/client';
import { generateBookingReference } from '../../apps/api/src/bookings/booking-reference.js';
import { refundPolicyFromFareRules } from '../../apps/api/src/payments/refund-policy.js';
import { prisma } from './shared.js';

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

/** Booking samples: the demo CONFIRMED and PENDING bookings for the customer. */
export async function seedBookings(customer: User): Promise<void> {
  await seedDemoBooking(customer);
  await seedPendingBooking(customer);
}
