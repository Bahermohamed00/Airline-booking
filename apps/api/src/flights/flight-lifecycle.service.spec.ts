import { describe, it, expect, vi } from 'vitest';
import { FlightLifecycleService } from './flight-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';

interface TestFlight {
  id: string;
  status: string;
  departureTime: Date;
  arrivalTime: Date;
}

const DEPARTURE = new Date('2026-10-05T12:00:00Z');
const ARRIVAL = new Date('2026-10-05T14:00:00Z');

function flight(status: string, overrides: Partial<TestFlight> = {}): TestFlight {
  return { id: `f-${status}`, status, departureTime: DEPARTURE, arrivalTime: ARRIVAL, ...overrides };
}

/** In-memory flight table honoring the CAS semantics of updateMany. */
function createHarness(
  flights: TestFlight[],
  options: { casFails?: boolean; config?: Record<string, string> } = {},
) {
  const db = flights.map((f) => ({ ...f }));
  const prisma = {
    flight: {
      findMany: vi.fn(({ where }: { where: { status: string } }) =>
        Promise.resolve(
          db
            .filter((f) => f.status === where.status)
            .map((f) => ({ id: f.id, departureTime: f.departureTime, arrivalTime: f.arrivalTime })),
        ),
      ),
      updateMany: vi.fn(({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
        if (options.casFails) return Promise.resolve({ count: 0 });
        const target = db.find((f) => f.id === where.id && f.status === where.status);
        if (!target) return Promise.resolve({ count: 0 });
        target.status = data.status;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const audit = { log: vi.fn().mockResolvedValue({}) };
  const events = { publish: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn((key: string) => options.config?.[key]) }; // absent keys fall back to defaults
  const service = new FlightLifecycleService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
    events as never,
  );
  return { service, audit, db, prisma, events };
}

const at = (iso: string) => new Date(iso);

describe('FlightLifecycleService.advanceLifecycle', () => {
  it('advances SCHEDULED → BOARDING exactly at the boarding threshold (departure − 45 min)', async () => {
    const { service, db } = createHarness([flight('SCHEDULED')]);
    await service.advanceLifecycle(at('2026-10-05T11:15:00Z'));
    expect(db[0]!.status).toBe('BOARDING');
  });

  it('leaves SCHEDULED untouched before the boarding threshold', async () => {
    const { service, db, audit } = createHarness([flight('SCHEDULED')]);
    await service.advanceLifecycle(at('2026-10-05T11:14:59Z'));
    expect(db[0]!.status).toBe('SCHEDULED');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('advances BOARDING → DEPARTED exactly at departure time', async () => {
    const { service, db } = createHarness([flight('BOARDING')]);
    await service.advanceLifecycle(at('2026-10-05T12:00:00Z'));
    expect(db[0]!.status).toBe('DEPARTED');
  });

  it('advances DEPARTED → ARRIVED exactly at arrival time', async () => {
    const { service, db } = createHarness([flight('DEPARTED')]);
    await service.advanceLifecycle(at('2026-10-05T14:00:00Z'));
    expect(db[0]!.status).toBe('ARRIVED');
  });

  it('advances ARRIVED → COMPLETED exactly at the completion threshold (arrival + 120 min)', async () => {
    const { service, db } = createHarness([flight('ARRIVED')]);
    await service.advanceLifecycle(at('2026-10-05T16:00:00Z'));
    expect(db[0]!.status).toBe('COMPLETED');
  });

  it.each(['CANCELLED', 'COMPLETED', 'ACTIVE', 'DELAYED'] as const)(
    'never touches %s flights, however overdue',
    async (status) => {
      const { service, db, audit, prisma } = createHarness([
        flight(status, {
          departureTime: at('2026-10-01T12:00:00Z'),
          arrivalTime: at('2026-10-01T14:00:00Z'),
        }),
      ]);
      await service.advanceLifecycle(at('2026-10-06T00:00:00Z'));
      expect(db[0]!.status).toBe(status);
      expect(prisma.flight.updateMany).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    },
  );

  it('cascades an overdue flight through every stage in one run, auditing each transition', async () => {
    const { service, db, audit } = createHarness([
      flight('SCHEDULED', {
        id: 'f-overdue',
        departureTime: at('2026-10-04T12:00:00Z'),
        arrivalTime: at('2026-10-04T14:00:00Z'),
      }),
    ]);

    await service.advanceLifecycle(at('2026-10-05T00:00:00Z'));

    expect(db[0]!.status).toBe('COMPLETED');
    expect(audit.log.mock.calls.map((c) => (c[0] as { metadata: unknown }).metadata)).toEqual([
      { previousStatus: 'SCHEDULED', newStatus: 'BOARDING' },
      { previousStatus: 'BOARDING', newStatus: 'DEPARTED' },
      { previousStatus: 'DEPARTED', newStatus: 'ARRIVED' },
      { previousStatus: 'ARRIVED', newStatus: 'COMPLETED' },
    ]);
  });

  it('audits with actorType System and flight target on a real transition', async () => {
    const { service, audit } = createHarness([flight('BOARDING')]);
    await service.advanceLifecycle(at('2026-10-05T12:00:00Z'));
    expect(audit.log).toHaveBeenCalledWith({
      actorType: 'System',
      action: 'FLIGHT_STATUS_CHANGED',
      targetType: 'Flight',
      targetId: 'f-BOARDING',
      metadata: { previousStatus: 'BOARDING', newStatus: 'DEPARTED' },
    });
  });

  it('publishes flight.status.changed per actual transition and nothing on a no-op run', async () => {
    const { service, events } = createHarness([flight('BOARDING')]);
    await service.advanceLifecycle(at('2026-10-05T11:00:00Z')); // not yet departure → no-op
    expect(events.publish).not.toHaveBeenCalled();

    await service.advanceLifecycle(at('2026-10-05T12:00:00Z'));
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith('flight.status.changed');
  });

  it('creates no audit entry when the compare-and-set matches nothing (concurrent change)', async () => {
    const { service, audit } = createHarness([flight('BOARDING')], { casFails: true });
    await expect(service.advanceLifecycle(at('2026-10-05T12:00:00Z'))).resolves.toBeUndefined();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run changes and audits nothing', async () => {
    const { service, db, audit } = createHarness([flight('SCHEDULED')]);
    const now = at('2026-10-05T11:15:00Z');

    await service.advanceLifecycle(now);
    expect(db[0]!.status).toBe('BOARDING');
    expect(audit.log).toHaveBeenCalledTimes(1);

    await service.advanceLifecycle(now);
    expect(db[0]!.status).toBe('BOARDING');
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('honors configured thresholds over the defaults', async () => {
    const { service, db } = createHarness([flight('SCHEDULED')], {
      config: { FLIGHT_BOARDING_WINDOW_MINUTES: '30' },
    });
    // 30 min before departure: within a 30-min window, outside the 45-min default.
    await service.advanceLifecycle(at('2026-10-05T11:30:00Z'));
    expect(db[0]!.status).toBe('BOARDING');
  });
});
