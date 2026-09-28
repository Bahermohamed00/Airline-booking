import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Automatic seat-hold expiration. Expiring a hold only flips its status —
 * bookings and full hold history are preserved; freed seats become available
 * because the (flight, seat) partial unique index covers ACTIVE rows only.
 */
@Injectable()
export class SeatHoldsService {
  private readonly logger = new Logger(SeatHoldsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /** Expires every ACTIVE hold whose expiresAt has passed. Returns the count. */
  async expireStaleHolds(now = new Date()): Promise<number> {
    const result = await this.prisma.seatHold.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      try {
        await this.auditService.log({
          actorType: 'System',
          action: 'SEAT_HOLD_EXPIRED',
          targetType: 'SeatHold',
          metadata: { holdCount: result.count },
        });
      } catch (error) {
        this.logger.warn(`audit log failed for SEAT_HOLD_EXPIRED: ${String(error)}`);
      }
    }
    return result.count;
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
