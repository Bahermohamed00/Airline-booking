import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Thrown inside the confirmation transaction when the PENDING→CONFIRMED compare-and-set loses a concurrent race. */
export class BookingNotPendingError extends Error {}

export interface BookingConfirmationDetails {
  seatNumbers: string[];
  holdCount: number;
}

/**
 * Atomically (inside the caller's transaction): compare-and-set the booking
 * PENDING→CONFIRMED, self-heal stale holds, convert ACTIVE holds to
 * CONVERTED, and create BookingSeat rows for every flight segment.
 *
 * Shared by the synchronous payment flow, the BR-14 admin exception flow, and
 * the Stripe webhook finalization — every path that turns a pending booking
 * into a confirmed one goes through exactly this transition.
 *
 * Seat↔passenger pairing is deterministic: holds sorted by seat number,
 * passengers sorted by (lastName, firstName, id). The persisted schema has
 * no hold→passenger link, so a stable documented ordering is used (the API
 * never exposed a per-passenger seat association).
 */
export async function confirmBookingInTransaction(
  tx: Tx,
  bookingId: string,
): Promise<BookingConfirmationDetails> {
  const now = new Date();
  // Self-heal stale holds (same pattern as booking creation); only ACTIVE
  // rows are protected by the partial unique index.
  await tx.seatHold.updateMany({
    where: { bookingId, status: 'ACTIVE', expiresAt: { lte: now } },
    data: { status: 'EXPIRED' },
  });

  // Atomic compare-and-set: concurrent confirmations serialize on the
  // booking row lock; the loser observes count 0 after the winner commits.
  const cas = await tx.booking.updateMany({
    where: { id: bookingId, status: 'PENDING' },
    data: { status: 'CONFIRMED' },
  });
  if (cas.count !== 1) {
    throw new BookingNotPendingError();
  }

  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      bookingPassengers: { include: { passenger: true } },
      seatHolds: { include: { seat: true } },
    },
  });

  const activeHolds = booking.seatHolds.filter((h) => h.status === 'ACTIVE');
  if (
    activeHolds.length === 0 ||
    activeHolds.length !== booking.bookingPassengers.length
  ) {
    throw new ConflictException(
      'Seat holds for this booking have expired — cancel it and create a new booking',
    );
  }

  const flightId = activeHolds[0]!.flightId;
  const segments = await tx.flightSegment.findMany({
    where: { flightId },
    orderBy: { segmentNumber: 'asc' },
    select: { id: true },
  });
  if (segments.length === 0) {
    throw new ConflictException(
      'Flight has no segments — seats cannot be assigned',
    );
  }

  const converted = await tx.seatHold.updateMany({
    where: { bookingId, status: 'ACTIVE' },
    data: { status: 'CONVERTED' },
  });
  if (converted.count !== activeHolds.length) {
    throw new ConflictException(
      'Seat holds changed concurrently — please retry the payment',
    );
  }

  const holdsSorted = [...activeHolds].sort((a, b) =>
    a.seat.seatNumber.localeCompare(b.seat.seatNumber),
  );
  const passengersSorted = [...booking.bookingPassengers].sort((a, b) =>
    `${a.passenger.lastName}${a.passenger.firstName}${a.passenger.id}`.localeCompare(
      `${b.passenger.lastName}${b.passenger.firstName}${b.passenger.id}`,
    ),
  );

  for (let i = 0; i < holdsSorted.length; i++) {
    const hold = holdsSorted[i]!;
    const bookingPassenger = passengersSorted[i]!;
    for (const segment of segments) {
      try {
        await tx.bookingSeat.create({
          data: {
            bookingPassengerId: bookingPassenger.id,
            flightSegmentId: segment.id,
            seatId: hold.seatId,
            seatNumber: hold.seat.seatNumber,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // @@unique([flightSegmentId, seatId]) is the authoritative guard.
          throw new ConflictException(
            `Seat ${hold.seat.seatNumber} is no longer available`,
          );
        }
        throw error;
      }
    }
  }

  return {
    seatNumbers: holdsSorted.map((h) => h.seat.seatNumber),
    holdCount: holdsSorted.length,
  };
}
