import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Automatic seat-hold expiration. Expiring a hold only flips its status —
 * bookings and full hold history are preserved; freed seats become available
 * because the (flight, seat) partial unique index covers ACTIVE rows only.
 *
 * The same sweep also cancels PENDING bookings that no longer have any ACTIVE
 * hold: payment requires a live hold per passenger, so such bookings can never
 * be paid and would otherwise accumulate as dead weight. Cancellation is a
 * status compare-and-set inside the expiry transaction, so confirmed or
 * already-cancelled bookings — and bookings confirmed concurrently — are never
 * touched.
 */
@Injectable()
export class SeatHoldsService {
  private readonly logger = new Logger(SeatHoldsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Expires every ACTIVE hold whose expiresAt has passed and cancels PENDING
   * bookings with no remaining ACTIVE hold. Returns the expired-hold count.
   * Idempotent: expired holds stay EXPIRED and cancellation re-checks
   * status='PENDING', so repeats neither re-expire nor re-cancel.
   */
  async expireStaleHolds(now = new Date()): Promise<number> {
    const { expiredCount, cancelledBookings } = await this.prisma.$transaction(async (tx) => {
      const expired = await tx.seatHold.updateMany({
        where: { status: 'ACTIVE', expiresAt: { lt: now } },
        data: { status: 'EXPIRED' },
      });

      const orphaned = await tx.booking.findMany({
        where: { status: 'PENDING', seatHolds: { none: { status: 'ACTIVE' } } },
        select: { id: true, bookingReference: true },
      });
      const cancelledBookings: typeof orphaned = [];
      for (const booking of orphaned) {
        // Compare-and-set: a booking confirmed or cancelled concurrently after
        // the candidate read is skipped instead of being overwritten.
        const cas = await tx.booking.updateMany({
          where: { id: booking.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (cas.count === 1) {
          cancelledBookings.push(booking);
        }
      }
      return { expiredCount: expired.count, cancelledBookings };
    });

    if (expiredCount > 0) {
      try {
        await this.auditService.log({
          actorType: 'System',
          action: 'SEAT_HOLD_EXPIRED',
          targetType: 'SeatHold',
          metadata: { holdCount: expiredCount },
        });
      } catch (error) {
        this.logger.warn(`audit log failed for SEAT_HOLD_EXPIRED: ${String(error)}`);
      }
    }
    for (const booking of cancelledBookings) {
      try {
        await this.auditService.log({
          actorType: 'System',
          action: 'BOOKING_CANCELLED',
          targetType: 'Booking',
          targetId: booking.id,
          bookingId: booking.id,
          metadata: {
            bookingReference: booking.bookingReference,
            reason: 'Seat holds expired before payment — cancelled automatically',
          },
        });
      } catch (error) {
        this.logger.warn(`audit log failed for BOOKING_CANCELLED ${booking.bookingReference}: ${String(error)}`);
      }
    }
    return expiredCount;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleHoldsJob(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    const expired = await this.expireStaleHolds();
    if (expired > 0) {
      this.logger.log(`Expired ${expired} seat hold(s)`);
    }
  }
}
