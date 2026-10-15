import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationDeliveryService } from './notification-delivery.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_ADAPTER } from '../mail/mail.adapter';

/**
 * Post-claim fixture: attempts was already incremented by the batch claim,
 * so attempts:1 is the first delivery attempt.
 */
const candidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'notif-1',
  channel: 'EMAIL',
  status: 'RETRYING',
  attempts: 1,
  nextRetryAt: new Date(Date.now() + 60_000),
  title: 'Booking confirmed',
  content: 'Your booking NVAB12 is confirmed.',
  createdAt: new Date(),
  user: { email: 'account@example.com' },
  booking: { contactEmail: 'booking-contact@example.com' },
  ...overrides,
});

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;
  let tx: {
    $queryRaw: ReturnType<typeof vi.fn>;
    notification: { updateMany: ReturnType<typeof vi.fn> };
  };
  let prisma: {
    notification: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let mail: { send: ReturnType<typeof vi.fn> };

  /** Wires the claim batch to return the given candidates' ids and the
   *  post-claim fetch to return the candidates themselves. */
  const claimOf = (candidates: Record<string, unknown>[]) => {
    tx.$queryRaw.mockResolvedValue(candidates.map((c) => ({ id: c['id'] })));
    tx.notification.updateMany.mockResolvedValue({ count: candidates.length });
    prisma.notification.findMany.mockResolvedValue(candidates);
  };

  beforeEach(async () => {
    tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      notification: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    mail = { send: vi.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: MAIL_ADAPTER, useValue: mail },
        {
          provide: ConfigService,
          useValue: { get: vi.fn((key: string, fallback: string) => fallback) },
        },
      ],
    }).compile();
    service = module.get(NotificationDeliveryService);
  });

  it('claims via FOR UPDATE SKIP LOCKED with bounded params and a provisional backoff', async () => {
    await service.sweepPendingEmails();

    const [sql, ...params] = tx.$queryRaw.mock.calls[0]!;
    expect(String(sql.join?.(' ') ?? sql)).toContain('FOR UPDATE SKIP LOCKED');
    // params: maxAttempts, now, batchSize
    expect(params[0]).toBe(5);
    expect(params[1]).toBeInstanceOf(Date);
    expect(params[2]).toBe(20);
  });

  it('an empty claim batch sends nothing', async () => {
    const result = await service.sweepPendingEmails();

    expect(result).toEqual({ sent: 0, failed: 0, terminal: 0 });
    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('the claim flips rows to RETRYING, increments attempts, and sets a provisional backoff (crash hot-loop protection)', async () => {
    claimOf([candidate()]);

    await service.sweepPendingEmails();

    const claimData = tx.notification.updateMany.mock.calls[0]![0];
    expect(claimData.where).toEqual({ id: { in: ['notif-1'] } });
    expect(claimData.data.status).toBe('RETRYING');
    expect(claimData.data.attempts).toEqual({ increment: 1 });
    const provisional = claimData.data.nextRetryAt.getTime() - Date.now();
    expect(provisional).toBeGreaterThan(50_000);
    expect(provisional).toBeLessThanOrEqual(65_000);
  });

  it('sends successfully and finalizes as SENT, preferring the booking contact email', async () => {
    claimOf([candidate()]);

    const result = await service.sweepPendingEmails();

    expect(result).toEqual({ sent: 1, failed: 0, terminal: 0 });
    expect(mail.send).toHaveBeenCalledWith({
      to: 'booking-contact@example.com',
      subject: 'Booking confirmed',
      text: 'Your booking NVAB12 is confirmed.',
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'SENT',
        sentAt: expect.any(Date),
        error: null,
        nextRetryAt: null,
      },
    });
  });

  it('falls back to the account email when no booking contact exists', async () => {
    claimOf([candidate({ booking: null })]);

    await service.sweepPendingEmails();

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'account@example.com' }),
    );
  });

  it('schedules a bounded exponential backoff on provider failure and records a sanitized error', async () => {
    claimOf([candidate({ attempts: 2 })]);
    mail.send.mockRejectedValue(new Error('SMTP connection timeout'));

    const result = await service.sweepPendingEmails();

    expect(result).toEqual({ sent: 0, failed: 1, terminal: 0 });
    const finalize = prisma.notification.update.mock.calls[0]![0];
    expect(finalize.data.status).toBe('RETRYING');
    expect(finalize.data.error).toBe('SMTP connection timeout');
    // attempt 2 → base 60s * 2^(2-1) = 120s.
    const delay = finalize.data.nextRetryAt.getTime() - Date.now();
    expect(delay).toBeGreaterThan(100_000);
    expect(delay).toBeLessThanOrEqual(130_000);
  });

  it('marks the record FAILED (terminal) when the attempt budget is exhausted', async () => {
    claimOf([candidate({ attempts: 5 })]);
    mail.send.mockRejectedValue(new Error('550 rejected'));

    const result = await service.sweepPendingEmails();

    expect(result).toEqual({ sent: 0, failed: 0, terminal: 1 });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: 'FAILED', error: '550 rejected', nextRetryAt: null },
    });
  });

  it('terminally fails rows with no resolvable recipient — without sending or retrying', async () => {
    claimOf([candidate({ booking: null, user: null })]);

    const result = await service.sweepPendingEmails();

    expect(mail.send).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0, terminal: 1 });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('one record’s failure never aborts the batch', async () => {
    claimOf([candidate({ id: 'notif-1' }), candidate({ id: 'notif-2' })]);
    mail.send
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(undefined);

    const result = await service.sweepPendingEmails();

    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 1, failed: 1, terminal: 0 });
  });

  it('truncates long provider errors instead of persisting raw payloads', async () => {
    claimOf([candidate()]);
    mail.send.mockRejectedValue(new Error('x'.repeat(2000)));

    await service.sweepPendingEmails();

    const finalize = prisma.notification.update.mock.calls[0]![0];
    expect(finalize.data.error.length).toBeLessThanOrEqual(500);
  });

  it('overlapping cron ticks never run a concurrent sweep in-process', async () => {
    let release!: () => void;
    prisma.$transaction.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve([]))),
    );

    const first = service.deliverScheduledEmails();
    await Promise.resolve();
    await service.deliverScheduledEmails(); // must no-op while the first runs
    release();
    await first;

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
