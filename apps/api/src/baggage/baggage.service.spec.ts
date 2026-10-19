import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaggageService } from './baggage.service';
import { BAG_TAG_PATTERN, MAX_TAG_ATTEMPTS } from './bag-tag';

const bagRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'bag-1',
  bookingPassengerId: 'bp-1',
  type: 'CHECKED',
  weightKg: 22,
  pieces: 1,
  tagNumber: 'NV00000001',
  status: 'LOADED',
  events: [
    { id: 'e1', baggageId: 'bag-1', eventType: 'CHECKED_IN', location: 'FRA Terminal 1', occurredAt: new Date('2026-10-14T08:00:00Z') },
    { id: 'e2', baggageId: 'bag-1', eventType: 'LOADED', location: 'FRA Ramp B', occurredAt: new Date('2026-10-14T10:00:00Z') },
  ],
  ...overrides,
});

describe('BaggageService.trackByTag', () => {
  let prisma: { baggage: { findUnique: ReturnType<typeof vi.fn> } };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: BaggageService;

  beforeEach(() => {
    prisma = { baggage: { findUnique: vi.fn() } };
    audit = { log: vi.fn() };
    service = new BaggageService(prisma as never, audit as never);
  });

  it('returns the PII-free tracking view for a known tag', async () => {
    prisma.baggage.findUnique.mockResolvedValue(bagRow());
    const view = await service.trackByTag('NV00000001');

    expect(prisma.baggage.findUnique).toHaveBeenCalledWith({
      where: { tagNumber: 'NV00000001' },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
    expect(view).toEqual({
      tagNumber: 'NV00000001',
      type: 'CHECKED',
      pieces: 1,
      weightKg: 22,
      status: 'LOADED',
      events: [
        { eventType: 'CHECKED_IN', location: 'FRA Terminal 1', occurredAt: new Date('2026-10-14T08:00:00Z') },
        { eventType: 'LOADED', location: 'FRA Ramp B', occurredAt: new Date('2026-10-14T10:00:00Z') },
      ],
    });
    // Never leak booking/passenger identity or internal ids.
    expect(JSON.stringify(view)).not.toContain('bp-1');
    expect(view).not.toHaveProperty('id');
  });

  it('throws 404 BAGGAGE_NOT_FOUND for an unknown tag', async () => {
    prisma.baggage.findUnique.mockResolvedValue(null);
    await expect(service.trackByTag('NV99999999')).rejects.toBeInstanceOf(NotFoundException);
    await service.trackByTag('NV99999999').catch((e) => {
      expect(e.response).toMatchObject({ code: 'BAGGAGE_NOT_FOUND' });
    });
  });

  it('never audits public reads', async () => {
    prisma.baggage.findUnique.mockResolvedValue(bagRow());
    await service.trackByTag('NV00000001');
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('BaggageService.issueCheckedBags', () => {
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: BaggageService;
  let tx: {
    baggage: { create: ReturnType<typeof vi.fn> };
    baggageEvent: { create: ReturnType<typeof vi.fn> };
  };

  const tagP2002 = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`tag_number`)', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['tag_number'] },
    });

  beforeEach(() => {
    audit = { log: vi.fn() };
    service = new BaggageService({} as never, audit as never);
    tx = {
      baggage: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: `bag-${data.tagNumber}`, ...data })),
      },
      baggageEvent: { create: vi.fn().mockResolvedValue({ id: 'ev-1' }) },
    };
  });

  it('creates one bag + initial CHECKED_IN event per declared bag, in the caller transaction', async () => {
    const bags = await service.issueCheckedBags(tx as never, 'bp-1', 2, 'FRA online check-in');

    expect(bags).toHaveLength(2);
    for (const call of tx.baggage.create.mock.calls) {
      const data = call[0].data;
      expect(data.bookingPassengerId).toBe('bp-1');
      expect(data.type).toBe('CHECKED');
      expect(data.pieces).toBe(1);
      expect(data.status).toBe('CHECKED_IN');
      expect(data.tagNumber).toMatch(BAG_TAG_PATTERN);
    }
    // Each bag got exactly one initial event in the same transaction.
    expect(tx.baggageEvent.create).toHaveBeenCalledTimes(2);
    for (const [i, call] of tx.baggageEvent.create.mock.calls.entries()) {
      expect(call[0].data).toMatchObject({
        baggageId: (bags[i] as { id: string }).id,
        eventType: 'CHECKED_IN',
        location: 'FRA online check-in',
      });
    }
    // Issued tags are unique within the batch.
    expect(new Set(bags.map((b) => b.tagNumber)).size).toBe(2);
  });

  it('persists the configured per-piece weight when provided — overflow bags stay unweighted', async () => {
    await service.issueCheckedBags(tx as never, 'bp-1', 3, 'FRA online check-in', [23, 20]);

    const weights = tx.baggage.create.mock.calls.map((call) => call[0].data.weightKg);
    expect(weights).toEqual([23, 20, null]);
  });

  it('defaults weightKg to null when no purchased allowance is provided — never a fabricated value', async () => {
    await service.issueCheckedBags(tx as never, 'bp-1', 1, 'FRA online check-in');
    expect(tx.baggage.create.mock.calls[0]![0].data.weightKg).toBeNull();
  });

  it('count 0 creates nothing; negative/non-integer counts are rejected', async () => {
    expect(await service.issueCheckedBags(tx as never, 'bp-1', 0, 'FRA online check-in')).toEqual([]);
    expect(tx.baggage.create).not.toHaveBeenCalled();
    await expect(service.issueCheckedBags(tx as never, 'bp-1', -1, 'x')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.issueCheckedBags(tx as never, 'bp-1', 1.5, 'x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retries recognized tag collisions with a fresh tag and succeeds', async () => {
    tx.baggage.create
      .mockRejectedValueOnce(tagP2002())
      .mockImplementation(({ data }) => Promise.resolve({ id: 'bag-1', ...data }));

    const bags = await service.issueCheckedBags(tx as never, 'bp-1', 1, 'FRA online check-in');

    expect(bags).toHaveLength(1);
    expect(tx.baggage.create).toHaveBeenCalledTimes(2);
    // The retried attempt used a different generated tag.
    const tags = tx.baggage.create.mock.calls.map((c) => c[0].data.tagNumber);
    expect(tags[0]).not.toBe(tags[1]);
  });

  it('does NOT retry non-tag P2002s or unrelated errors', async () => {
    const otherP2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['booking_passenger_id'] },
    });
    tx.baggage.create.mockRejectedValue(otherP2002);
    await expect(service.issueCheckedBags(tx as never, 'bp-1', 1, 'x')).rejects.toThrow('dup');
    expect(tx.baggage.create).toHaveBeenCalledTimes(1);
  });

  it('exhausted collision retries fail safely with BAG_TAG_ISSUANCE_FAILED and create no event', async () => {
    tx.baggage.create.mockRejectedValue(tagP2002());

    await expect(service.issueCheckedBags(tx as never, 'bp-1', 1, 'x')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BAG_TAG_ISSUANCE_FAILED' }),
    });
    await expect(service.issueCheckedBags(tx as never, 'bp-1', 1, 'x')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(tx.baggage.create).toHaveBeenCalledTimes(MAX_TAG_ATTEMPTS * 2);
    expect(tx.baggageEvent.create).not.toHaveBeenCalled();
  });

  it('an event-creation failure propagates so the caller transaction rolls back (no partial bag)', async () => {
    tx.baggageEvent.create.mockRejectedValue(new Error('disk full'));

    await expect(service.issueCheckedBags(tx as never, 'bp-1', 1, 'x')).rejects.toThrow('disk full');
    // The bag INSERT happened inside the caller's tx, which the caller now
    // rolls back — the error must propagate rather than swallow.
    expect(tx.baggage.create).toHaveBeenCalledTimes(1);
  });
});
