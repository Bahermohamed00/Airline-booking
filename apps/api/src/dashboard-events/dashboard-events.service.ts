import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';

/** Operational domain events that invalidate dashboard statistics. */
export type DashboardEventType =
  | 'flight.created'
  | 'flight.updated'
  | 'flight.status.changed'
  | 'flight.cancelled'
  | 'schedule-rule.created'
  | 'schedule-rule.updated'
  | 'schedule-rule.status.changed'
  | 'airport.created'
  | 'airport.updated'
  | 'aircraft.created'
  | 'aircraft.updated'
  | 'route.created'
  | 'route.updated';

export interface DashboardEvent {
  type: DashboardEventType;
  /** ISO timestamp — informational only; statistics always come from the DB via REST. */
  at: string;
}

const CHANNEL = 'dashboard.events';

/**
 * Dashboard event bus. Events are invalidation notifications only — never
 * authoritative data. Two transports:
 *
 * - REDIS_URL configured → Redis Pub/Sub: every NestJS instance publishes to
 *   and subscribes to the same channel, so a mutation on instance #1 reaches
 *   WebSocket clients of instance #2 (multi-instance scaling).
 * - Otherwise → in-process EventEmitter (single instance; used by tests and
 *   local dev without Redis).
 *
 * If a Redis publish fails at runtime, the event still fans out locally so a
 * single degraded instance never loses its own notifications.
 */
@Injectable()
export class DashboardEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(DashboardEventsService.name);
  private readonly local = new EventEmitter();
  private redisPub?: Redis;
  private redisSub?: Redis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) return;
    this.redisPub = new Redis(url, { lazyConnect: true });
    this.redisSub = new Redis(url, { lazyConnect: true });
    this.redisPub.on('error', (err) => this.logger.warn(`dashboard events redis pub error: ${String(err)}`));
    this.redisSub.on('error', (err) => this.logger.warn(`dashboard events redis sub error: ${String(err)}`));
    // A rejected subscribe (Redis down at boot with lazyConnect) must not crash
    // the process as an unhandled rejection — the service degrades to local mode.
    void this.redisSub.subscribe(CHANNEL).catch((err: unknown) => {
      this.logger.warn(`dashboard events redis subscribe failed, local-only mode: ${String(err)}`);
    });
    this.redisSub.on('message', (_channel: string, message: string) => {
      try {
        this.local.emit('event', JSON.parse(message) as DashboardEvent);
      } catch {
        this.logger.warn('dashboard events: dropped malformed redis message');
      }
    });
  }

  /** Multi-instance fan-out via Redis when configured; otherwise (or on Redis failure) in-process. */
  async publish(type: DashboardEventType): Promise<void> {
    const event: DashboardEvent = { type, at: new Date().toISOString() };
    if (this.redisPub) {
      try {
        await this.redisPub.publish(CHANNEL, JSON.stringify(event));
        return;
      } catch (error) {
        this.logger.warn(`redis publish failed, falling back to local fan-out: ${String(error)}`);
      }
    }
    this.local.emit('event', event);
  }

  /** Local subscription point — receives both in-process and Redis-fanned-in events. */
  subscribe(handler: (event: DashboardEvent) => void): () => void {
    this.local.on('event', handler);
    return () => this.local.off('event', handler);
  }

  async onModuleDestroy(): Promise<void> {
    this.local.removeAllListeners();
    await this.redisPub?.quit().catch(() => undefined);
    await this.redisSub?.quit().catch(() => undefined);
  }
}
