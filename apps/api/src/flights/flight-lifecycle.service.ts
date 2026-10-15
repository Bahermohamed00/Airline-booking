import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FlightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service.js';

interface LifecycleStage {
  from: FlightStatus;
  to: FlightStatus;
  /** True when a flight with these times is eligible at `now`. */
  eligible: (times: { departureTime: Date; arrivalTime: Date }, now: Date) => boolean;
}

/**
 * Automatic flight lifecycle progression:
 * SCHEDULED → BOARDING → DEPARTED → ARRIVED → COMPLETED.
 *
 * - Compares `now` (UTC) directly against the stored UTC departure/arrival
 *   instants — no timezone math needed here.
 * - Every transition is a compare-and-set (`where: { id, status: <source> }`),
 *   so concurrent runs and manual status changes can never be overwritten or
 *   downgraded; a CAS that matches nothing is skipped silently (no audit).
 * - Stages run in forward order, so a flight that is overdue across multiple
 *   stages (e.g. after server downtime) cascades through all of them in one
 *   run, with one audit entry per actual transition.
 * - Terminal (CANCELLED/COMPLETED) and legacy (ACTIVE/DELAYED) statuses are
 *   never touched.
 * - Horizontal scaling note: a single Nest instance runs this job today; with
 *   multiple API instances a distributed/advisory lock strategy is required
 *   (deliberately not implemented yet).
 */
@Injectable()
export class FlightLifecycleService {
  private readonly logger = new Logger(FlightLifecycleService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DashboardEventsService) private readonly dashboardEvents: DashboardEventsService,
  ) {}

  async advanceLifecycle(now: Date): Promise<void> {
    for (const stage of this.stages()) {
      const candidates = await this.prisma.flight.findMany({
        where: { status: stage.from },
        select: { id: true, departureTime: true, arrivalTime: true },
      });
      for (const flight of candidates) {
        if (!stage.eligible(flight, now)) continue;
        const cas = await this.prisma.flight.updateMany({
          where: { id: flight.id, status: stage.from },
          data: { status: stage.to },
        });
        if (cas.count === 1) {
          await this.auditTransition(flight.id, stage.from, stage.to);
          await this.dashboardEvents.publish('flight.status.changed');
        }
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async advanceLifecycleJob(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    await this.advanceLifecycle(new Date());
  }

  private stages(): LifecycleStage[] {
    const boardingWindowMs = this.configMinutes('FLIGHT_BOARDING_WINDOW_MINUTES', 45) * 60_000;
    const completionGraceMs = this.configMinutes('FLIGHT_COMPLETION_GRACE_MINUTES', 120) * 60_000;
    return [
      {
        from: 'SCHEDULED',
        to: 'BOARDING',
        eligible: (t, now) => now.getTime() >= t.departureTime.getTime() - boardingWindowMs,
      },
      {
        from: 'BOARDING',
        to: 'DEPARTED',
        eligible: (t, now) => now.getTime() >= t.departureTime.getTime(),
      },
      {
        from: 'DEPARTED',
        to: 'ARRIVED',
        eligible: (t, now) => now.getTime() >= t.arrivalTime.getTime(),
      },
      {
        from: 'ARRIVED',
        to: 'COMPLETED',
        eligible: (t, now) => now.getTime() >= t.arrivalTime.getTime() + completionGraceMs,
      },
    ];
  }

  private configMinutes(key: string, fallback: number): number {
    return Number(this.config.get<string>(key) ?? fallback);
  }

  private async auditTransition(flightId: string, from: FlightStatus, to: FlightStatus): Promise<void> {
    try {
      await this.auditService.log({
        actorType: 'System',
        action: 'FLIGHT_STATUS_CHANGED',
        targetType: 'Flight',
        targetId: flightId,
        metadata: { previousStatus: from, newStatus: to },
      });
    } catch (error) {
      this.logger.warn(`audit log failed for FLIGHT_STATUS_CHANGED ${flightId}: ${String(error)}`);
    }
  }
}
