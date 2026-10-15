import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

let subscribeBehavior: () => Promise<unknown> = () => Promise.resolve(undefined);

const redisInstances: Array<{
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  handlers: Record<string, (...args: unknown[]) => void>;
}> = [];

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => {
    const instance = {
      publish: vi.fn().mockResolvedValue(1),
      subscribe: vi.fn(() => subscribeBehavior()),
      quit: vi.fn().mockResolvedValue('OK'),
      handlers: {} as Record<string, (...args: unknown[]) => void>,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        instance.handlers[event] = handler;
      }),
    };
    redisInstances.push(instance);
    return instance;
  }),
}));

import { DashboardEventsService } from './dashboard-events.service';

const configWith = (redisUrl?: string) =>
  ({ get: vi.fn((key: string) => (key === 'REDIS_URL' ? redisUrl : undefined)) }) as unknown as ConfigService;

describe('DashboardEventsService', () => {
  beforeEach(() => {
    redisInstances.splice(0);
    subscribeBehavior = () => Promise.resolve(undefined);
  });

  it('survives a rejected Redis subscribe at startup instead of crashing on an unhandled rejection', async () => {
    subscribeBehavior = () => Promise.reject(new Error('redis down at boot'));
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    let bus: DashboardEventsService | undefined;
    expect(() => {
      bus = new DashboardEventsService(configWith('redis://localhost:6379'));
    }).not.toThrow();

    // Let the rejected promise settle into the .catch handler.
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('subscribe failed'));
    });
    warn.mockRestore();

    // Local fan-out still works in degraded mode.
    const received: string[] = [];
    bus!.subscribe((e) => received.push(e.type));
    redisInstances[0]!.publish.mockRejectedValue(new Error('down'));
    await bus!.publish('flight.created');
    expect(received).toEqual(['flight.created']);
  });

  it('fans out locally when REDIS_URL is not configured (single-instance/test mode)', async () => {
    const bus = new DashboardEventsService(configWith(undefined));
    const received: string[] = [];
    const unsubscribe = bus.subscribe((e) => received.push(e.type));

    await bus.publish('flight.created');

    expect(received).toEqual(['flight.created']);
    expect(redisInstances).toHaveLength(0); // no Redis connections without REDIS_URL
    unsubscribe();
  });

  it('publishes via Redis Pub/Sub when REDIS_URL is configured (multi-instance fan-out)', async () => {
    const bus = new DashboardEventsService(configWith('redis://localhost:6379'));

    expect(redisInstances).toHaveLength(2); // one pub + one sub connection
    const [, sub] = redisInstances;
    expect(sub!.subscribe).toHaveBeenCalledWith('dashboard.events');

    await bus.publish('flight.cancelled');
    const [pub] = redisInstances;
    expect(pub!.publish).toHaveBeenCalledWith(
      'dashboard.events',
      expect.stringContaining('"type":"flight.cancelled"'),
    );
    await bus.onModuleDestroy();
  });

  it('routes inbound Redis messages (from other instances) to local subscribers', async () => {
    const bus = new DashboardEventsService(configWith('redis://localhost:6379'));
    const received: string[] = [];
    bus.subscribe((e) => received.push(e.type));

    const [, sub] = redisInstances;
    // Simulate instance #2's event arriving on this instance's subscription.
    sub!.handlers['message']!('dashboard.events', JSON.stringify({ type: 'schedule-rule.created', at: '2026-10-07T00:00:00Z' }));

    expect(received).toEqual(['schedule-rule.created']);
    await bus.onModuleDestroy();
  });

  it('falls back to local fan-out when the Redis publish fails', async () => {
    const bus = new DashboardEventsService(configWith('redis://localhost:6379'));
    const [pub] = redisInstances;
    pub!.publish.mockRejectedValue(new Error('redis down'));
    const received: string[] = [];
    bus.subscribe((e) => received.push(e.type));

    await bus.publish('flight.updated');

    expect(received).toEqual(['flight.updated']);
    await bus.onModuleDestroy();
  });

  it('drops malformed Redis messages instead of crashing', async () => {
    const bus = new DashboardEventsService(configWith('redis://localhost:6379'));
    const received: string[] = [];
    bus.subscribe((e) => received.push(e.type));

    const [, sub] = redisInstances;
    sub!.handlers['message']!('dashboard.events', 'not json');

    expect(received).toEqual([]);
    await bus.onModuleDestroy();
  });
});
