import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OffersService } from './offers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const actor = { userId: 'admin-1', email: 'admin@novaair.dev', roles: ['Super Admin'], permissions: ['super_admin'] };

const createMockPrisma = () => ({
  offer: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  route: {
    findUnique: vi.fn(),
  },
  booking: {
    count: vi.fn(),
  },
});

describe('OffersService', () => {
  let service: OffersService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let auditLog: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    auditLog = vi.fn();
    const module = await Test.createTestingModule({
      providers: [OffersService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: { log: auditLog } }],
    }).compile();
    service = module.get(OffersService);
  });

  const dto = {
    title: 'Winter Sun in Dubai',
    description: 'Trade the cold for the coast — daily nonstop flights.',
    badge: 'Winter sun',
    destination: 'Frankfurt → Dubai',
    offerValue: 'from €349',
    validFrom: '2026-10-01',
    validUntil: '2026-12-31',
  };

  // ---------- Customer visibility ----------

  it('customer list queries only ACTIVE offers inside the validity window', async () => {
    prisma.offer.findMany.mockResolvedValue([]);
    await service.findPublic();
    const where = prisma.offer.findMany.mock.calls[0]![0]!.where!;
    expect(where.status).toBe('ACTIVE');
    expect(where.validFrom).toEqual({ lte: expect.any(Date) });
    expect(where.validUntil).toEqual({ gte: expect.any(Date) });
  });

  it('keeps an offer visible through its whole final day (date-typed validity)', async () => {
    prisma.offer.findMany.mockResolvedValue([]);
    await service.findPublic();
    const where = prisma.offer.findMany.mock.calls[0]![0]!.where!;
    const now = new Date();
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    // validUntil (a date column at UTC midnight) must compare against the
    // start of today, not the current timestamp.
    expect((where.validUntil as { gte: Date }).gte.getTime()).toBe(todayStart);
    // validFrom still excludes future offers at the current instant.
    expect((where.validFrom as { lte: Date }).lte.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('customer detail applies the same eligibility filter and 404s otherwise', async () => {
    prisma.offer.findFirst.mockResolvedValue(null);
    await expect(service.findPublicOne('id-1')).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.offer.findFirst.mock.calls[0]![0]!.where!;
    expect(where.status).toBe('ACTIVE');
  });

  it('customer view contains no admin internals (status, timestamps)', async () => {
    prisma.offer.findMany.mockResolvedValue([
      {
        id: 'o1',
        title: 'T',
        description: 'D',
        badge: null,
        destination: null,
        offerValue: null,
        terms: null,
        imageUrl: null,
        status: 'ACTIVE',
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validUntil: new Date('2026-12-31T00:00:00Z'),
        discountType: null,
        discountValue: null,
        routeId: null,
        cabinClass: null,
        route: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const [view] = await service.findPublic();
    expect(view).not.toHaveProperty('status');
    expect(view).not.toHaveProperty('createdAt');
    expect(view).not.toHaveProperty('updatedAt');
  });

  it('customer view exposes bookable discount and eligibility for bookable offers only', async () => {
    const base = {
      id: 'o1',
      title: 'T',
      description: 'D',
      badge: null,
      destination: null,
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: 'ACTIVE',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
      routeId: null,
      cabinClass: null,
      route: null,
    };
    prisma.offer.findMany.mockResolvedValue([
      {
        ...base,
        discountType: 'PERCENT',
        discountValue: 15,
        routeId: 'r1',
        cabinClass: 'ECONOMY',
        route: { originAirport: { iataCode: 'FRA' }, destinationAirport: { iataCode: 'JFK' } },
      },
      { ...base, id: 'o2', discountType: null, discountValue: null },
    ]);
    const [bookable, marketing] = await service.findPublic();
    expect(bookable.bookable).toBe(true);
    expect(bookable.discount).toEqual({ type: 'PERCENT', value: 15 });
    expect(bookable.eligibility).toEqual({ routeId: 'r1', originIata: 'FRA', destinationIata: 'JFK', cabinClass: 'ECONOMY' });
    expect(marketing.bookable).toBe(false);
    expect(marketing.discount).toBeNull();
    expect(marketing.eligibility).toBeNull();
  });

  it('never advertises an offer whose discount terms booking would reject', async () => {
    // A row written straight to the database bypasses assertValidDiscount().
    // The public view must apply the same ranges assertBookable() enforces, so
    // the customer is never shown a "Book now" that turns into a 409 at checkout.
    const base = {
      id: 'o1',
      title: 'T',
      description: 'D',
      badge: null,
      destination: null,
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: 'ACTIVE',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
      routeId: 'r1',
      cabinClass: 'ECONOMY',
      route: { originAirport: { iataCode: 'FRA' }, destinationAirport: { iataCode: 'JFK' } },
    };
    prisma.offer.findMany.mockResolvedValue([
      { ...base, id: 'pct0', discountType: 'PERCENT', discountValue: 0 },
      { ...base, id: 'pct101', discountType: 'PERCENT', discountValue: 101 },
      { ...base, id: 'pctNeg', discountType: 'PERCENT', discountValue: -10 },
      { ...base, id: 'fix0', discountType: 'FIXED_AMOUNT', discountValue: 0 },
      { ...base, id: 'fixNeg', discountType: 'FIXED_AMOUNT', discountValue: -5 },
      { ...base, id: 'typeOnly', discountType: 'PERCENT', discountValue: null },
      { ...base, id: 'valueOnly', discountType: null, discountValue: 50 },
    ]);

    const views = await service.findPublic();
    expect(views.map((v) => v.bookable)).toEqual([false, false, false, false, false, false, false]);
    // discount/eligibility stay in lockstep with bookable — no half-applied terms.
    for (const v of views) {
      expect(v.discount).toBeNull();
      expect(v.eligibility).toBeNull();
    }
  });

  it('keeps bookable true at the valid discount boundaries', async () => {
    const base = {
      title: 'T',
      description: 'D',
      badge: null,
      destination: null,
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: 'ACTIVE',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
      routeId: null,
      cabinClass: null,
      route: null,
    };
    prisma.offer.findMany.mockResolvedValue([
      { ...base, id: 'pct100', discountType: 'PERCENT', discountValue: 100 },
      { ...base, id: 'pctSmall', discountType: 'PERCENT', discountValue: 0.01 },
      { ...base, id: 'fixSmall', discountType: 'FIXED_AMOUNT', discountValue: 0.01 },
    ]);

    const views = await service.findPublic();
    expect(views.map((v) => v.bookable)).toEqual([true, true, true]);
    expect(views.map((v) => v.discount)).toEqual([
      { type: 'PERCENT', value: 100 },
      { type: 'PERCENT', value: 0.01 },
      { type: 'FIXED_AMOUNT', value: 0.01 },
    ]);
  });

  it('keeps expired offers out of the customer list and 404s them on detail', async () => {
    const DAY = 86_400_000;
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'o1',
      title: 'T',
      description: 'D',
      badge: null,
      destination: null,
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: 'ACTIVE',
      validFrom: new Date(Date.now() - 10 * DAY),
      validUntil: new Date(Date.now() + DAY),
      discountType: 'PERCENT',
      discountValue: 15,
      routeId: null,
      cabinClass: null,
      route: null,
      ...over,
    });

    // ACTIVE in the database but the window has closed: still bookable terms,
    // yet invisible to customers — the admin list is where it stays manageable.
    prisma.offer.findMany.mockResolvedValue([row({ id: 'live' })]);
    const views = await service.findPublic();
    expect(views.map((v) => v.id)).toEqual(['live']);
    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE', validUntil: expect.anything() }),
      }),
    );

    prisma.offer.findFirst.mockResolvedValue(null);
    await expect(service.findPublicOne('gone')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------- Admin listing: lifecycle + bookability ----------
  describe('findAllAdmin', () => {
    const DAY = 86_400_000;
    const adminRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'o1',
      title: 'T',
      description: 'D',
      badge: null,
      destination: null,
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: 'ACTIVE',
      validFrom: new Date(Date.now() - DAY),
      validUntil: new Date(Date.now() + DAY),
      discountType: null,
      discountValue: null,
      routeId: null,
      cabinClass: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('returns every offer with no validity filter, so expired rows stay manageable', async () => {
      const expired = adminRow({ id: 'expired', validUntil: new Date(Date.now() - DAY) });
      const draft = adminRow({ id: 'draft', status: 'DRAFT' });
      prisma.offer.findMany.mockResolvedValue([expired, draft]);

      const rows = await service.findAllAdmin({});

      expect(rows).toHaveLength(2);
      // The query itself must not exclude anything by date.
      expect(prisma.offer.findMany).toHaveBeenCalledWith({
        where: { status: undefined },
        include: expect.anything(),
        orderBy: [{ status: 'asc' }, { validFrom: 'desc' }],
      });
    });

    it('derives lifecycle from the stored status and validity window', async () => {
      prisma.offer.findMany.mockResolvedValue([
        adminRow({ id: 'live' }),
        adminRow({ id: 'timeExpired', validUntil: new Date(Date.now() - DAY) }),
        adminRow({ id: 'future', validFrom: new Date(Date.now() + DAY) }),
        adminRow({ id: 'draft', status: 'DRAFT' }),
        adminRow({ id: 'inactive', status: 'INACTIVE' }),
        adminRow({ id: 'storedExpired', status: 'EXPIRED' }),
      ]);

      const rows = await service.findAllAdmin({});
      expect(rows.map((r) => r.lifecycleStatus)).toEqual([
        'ACTIVE',
        'EXPIRED', // stored status is still ACTIVE — window has closed
        'SCHEDULED', // ACTIVE but validFrom has not arrived
        'DRAFT',
        'INACTIVE',
        'EXPIRED',
      ]);
      // The raw stored status is never rewritten.
      expect(rows.map((r) => r.status)).toEqual([
        'ACTIVE',
        'ACTIVE',
        'ACTIVE',
        'DRAFT',
        'INACTIVE',
        'EXPIRED',
      ]);
    });

    it('keeps an offer visible through its whole final day (same UTC rule as publicWhere)', async () => {
      const todayEnd = new Date();
      const endOfTodayUtc = new Date(
        Date.UTC(todayEnd.getUTCFullYear(), todayEnd.getUTCMonth(), todayEnd.getUTCDate(), 23, 59, 59),
      );
      prisma.offer.findMany.mockResolvedValue([adminRow({ validUntil: endOfTodayUtc })]);
      const [row] = await service.findAllAdmin({});
      expect(row.lifecycleStatus).toBe('ACTIVE');
    });

    it('does not reinterpret stored DRAFT, INACTIVE or EXPIRED because of dates', async () => {
      prisma.offer.findMany.mockResolvedValue([
        adminRow({ id: 'd', status: 'DRAFT', validFrom: new Date(Date.now() - 10 * DAY) }),
        adminRow({ id: 'i', status: 'INACTIVE', validUntil: new Date(Date.now() - DAY) }),
        adminRow({ id: 'e', status: 'EXPIRED', validFrom: new Date(Date.now() + DAY) }),
      ]);
      const rows = await service.findAllAdmin({});
      expect(rows.map((r) => r.lifecycleStatus)).toEqual(['DRAFT', 'INACTIVE', 'EXPIRED']);
    });

    it('reports bookable independently of lifecycle — expired terms are not a live offer', async () => {
      prisma.offer.findMany.mockResolvedValue([
        adminRow({ id: 'liveBookable', discountType: 'PERCENT', discountValue: 15 }),
        adminRow({ id: 'expiredBookable', discountType: 'PERCENT', discountValue: 15, validUntil: new Date(Date.now() - DAY) }),
        adminRow({ id: 'marketing' }),
        adminRow({ id: 'badTerms', discountType: 'PERCENT', discountValue: 0 }),
      ]);

      const rows = await service.findAllAdmin({});
      // bookable == "valid discount terms exist", exactly as in the public view.
      expect(rows.map((r) => r.bookable)).toEqual([true, true, false, false]);
      // …but only the live one is bookable *now*; the client combines the two.
      expect(rows.filter((r) => r.bookable && r.lifecycleStatus === 'ACTIVE').map((r) => r.id)).toEqual([
        'liveBookable',
      ]);
    });

    it('exposes the real discount and eligibility for a configured offer', async () => {
      prisma.offer.findMany.mockResolvedValue([
        adminRow({
          discountType: 'PERCENT',
          discountValue: 15,
          routeId: 'route-1',
          cabinClass: 'BUSINESS',
          route: { originAirport: { iataCode: 'FRA' }, destinationAirport: { iataCode: 'JFK' } },
        }),
      ]);

      const [row] = await service.findAllAdmin({});

      // The edit form initialises from these — they must be real, not absent.
      expect(row.bookable).toBe(true);
      expect(row.discount).toEqual({ type: 'PERCENT', value: 15 });
      expect(row.eligibility).toEqual({
        routeId: 'route-1',
        originIata: 'FRA',
        destinationIata: 'JFK',
        cabinClass: 'BUSINESS',
      });
      // Raw persisted columns stay authoritative alongside the derived view.
      expect(row.discountType).toBe('PERCENT');
      expect(row.discountValue).toBe(15);
      expect(row.routeId).toBe('route-1');
      expect(row.cabinClass).toBe('BUSINESS');
    });

    it('exposes explicit absent terms for a marketing-only offer', async () => {
      prisma.offer.findMany.mockResolvedValue([adminRow()]);

      const [row] = await service.findAllAdmin({});

      expect(row.bookable).toBe(false);
      expect(row.discount).toBeNull();
      expect(row.eligibility).toBeNull();
    });

    it('never fabricates terms for a half-configured or out-of-range pair', async () => {
      prisma.offer.findMany.mockResolvedValue([
        adminRow({ id: 'typeOnly', discountType: 'PERCENT', discountValue: null }),
        adminRow({ id: 'pctZero', discountType: 'PERCENT', discountValue: 0 }),
        adminRow({ id: 'pctHigh', discountType: 'PERCENT', discountValue: 101 }),
        adminRow({ id: 'fixZero', discountType: 'FIXED_AMOUNT', discountValue: 0 }),
      ]);

      const rows = await service.findAllAdmin({});
      expect(rows.map((r) => r.bookable)).toEqual([false, false, false, false]);
      for (const row of rows) {
        expect(row.discount).toBeNull();
        expect(row.eligibility).toBeNull();
      }
      // Raw columns are reported untouched so the form can surface the problem.
      expect(rows.map((r) => r.discountType)).toEqual(['PERCENT', 'PERCENT', 'PERCENT', 'FIXED_AMOUNT']);
    });

    it('reports explicit nulls for an unrestricted offer that has no route relation', async () => {
      prisma.offer.findMany.mockResolvedValue([
        adminRow({ discountType: 'FIXED_AMOUNT', discountValue: 50, cabinClass: 'ECONOMY', routeId: null }),
      ]);

      const [row] = await service.findAllAdmin({});
      expect(row.discount).toEqual({ type: 'FIXED_AMOUNT', value: 50 });
      expect(row.eligibility).toEqual({
        routeId: null,
        originIata: null,
        destinationIata: null,
        cabinClass: 'ECONOMY',
      });
    });

    it('still filters on the stored status when the query param is set', async () => {
      prisma.offer.findMany.mockResolvedValue([adminRow({ status: 'ACTIVE' })]);
      await service.findAllAdmin({ status: 'ACTIVE' });
      expect(prisma.offer.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: expect.anything(),
        orderBy: [{ status: 'asc' }, { validFrom: 'desc' }],
      });
    });
  });

  // ---------- Admin mutations ----------

  it('rejects an inverted validity range on create', async () => {
    await expect(service.create({ ...dto, validFrom: '2026-12-31', validUntil: '2026-10-01' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate title on create with 409', async () => {
    prisma.offer.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('creates an offer as DRAFT by default and audits it', async () => {
    prisma.offer.findUnique.mockResolvedValue(null);
    prisma.offer.create.mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data }));
    const offer = await service.create(dto, actor);
    expect(offer.status).toBe('DRAFT');
    expect(offer.validFrom.toISOString()).toContain('2026-10-01');
  });

  it('rejects an update that inverts the range', async () => {
    prisma.offer.findUnique.mockResolvedValue({
      id: 'o1',
      title: 'T',
      validFrom: new Date('2026-10-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
    });
    await expect(service.update('o1', { validUntil: '2026-09-01' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.offer.update).not.toHaveBeenCalled();
  });

  it('delete deactivates (INACTIVE) instead of hard-deleting and is 409 when already inactive', async () => {
    prisma.offer.findUnique.mockResolvedValue({ id: 'o1', title: 'T', status: 'ACTIVE' });
    prisma.offer.update.mockResolvedValue({ id: 'o1', status: 'INACTIVE' });
    const offer = await service.deactivate('o1', actor);
    expect(offer.status).toBe('INACTIVE');
    expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'INACTIVE' } });

    prisma.offer.findUnique.mockResolvedValue({ id: 'o1', title: 'T', status: 'INACTIVE' });
    await expect(service.deactivate('o1', actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws 404 for a nonexistent offer on admin detail/update/delete', async () => {
    prisma.offer.findUnique.mockResolvedValue(null);
    await expect(service.findOneAdmin('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('missing', { title: 'X' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deactivate('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------- Bookable discount validation ----------

  it('accepts valid PERCENT and FIXED_AMOUNT discounts on create', async () => {
    prisma.offer.findUnique.mockResolvedValue(null);
    prisma.offer.create.mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data }));
    const percent = await service.create({ ...dto, discountType: 'PERCENT', discountValue: 15 }, actor);
    expect(percent.discountType).toBe('PERCENT');
    const fixed = await service.create({ ...dto, title: 'Another Valid Title', discountType: 'FIXED_AMOUNT', discountValue: 40.5 }, actor);
    expect(fixed.discountValue).toBe(40.5);
  });

  it('rejects out-of-range discount values on create', async () => {
    for (const [discountType, discountValue] of [
      ['PERCENT', 0],
      ['PERCENT', 100.01],
      ['PERCENT', -5],
      ['FIXED_AMOUNT', 0],
      ['FIXED_AMOUNT', -1],
    ] as const) {
      await expect(service.create({ ...dto, discountType, discountValue }, actor)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('rejects discountType without discountValue and vice versa', async () => {
    await expect(service.create({ ...dto, discountType: 'PERCENT' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ ...dto, discountValue: 20 }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown routeId and accepts an existing one', async () => {
    prisma.route.findUnique.mockResolvedValue(null);
    await expect(service.create({ ...dto, routeId: 'missing-route' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.offer.create).not.toHaveBeenCalled();

    prisma.offer.findUnique.mockResolvedValue(null);
    prisma.route.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.offer.create.mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data }));
    const offer = await service.create({ ...dto, routeId: 'r1', cabinClass: 'ECONOMY' }, actor);
    expect(offer.routeId).toBe('r1');
  });

  it('update merges discount fields with existing values before validating', async () => {
    prisma.offer.findUnique.mockResolvedValue({
      id: 'o1',
      title: 'T',
      validFrom: new Date('2026-10-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
      discountType: 'PERCENT',
      discountValue: 15,
      routeId: null,
      cabinClass: null,
    });
    // Existing PERCENT + new value 150 → combined result is out of range.
    await expect(service.update('o1', { discountValue: 150 }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.offer.update).not.toHaveBeenCalled();

    // Type-only change keeps the existing value 15 → valid FIXED_AMOUNT.
    prisma.offer.update.mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data }));
    const updated = await service.update('o1', { discountType: 'FIXED_AMOUNT' }, actor);
    expect(updated.discountType).toBe('FIXED_AMOUNT');
  });

  // ---------- Update: explicit null clears nullable commercial fields ----------

  describe('update: clearing nullable fields with explicit null', () => {
    const existingBookable = {
      id: 'o1',
      title: 'T',
      validFrom: new Date('2026-10-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
      discountType: 'PERCENT',
      discountValue: 15,
      routeId: 'r1',
      cabinClass: 'ECONOMY',
    };

    beforeEach(() => {
      prisma.offer.findUnique.mockResolvedValue(existingBookable);
      prisma.route.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.offer.update.mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data }));
    });

    it('clears the discount pair when discountType is null (marketing-only)', async () => {
      await service.update('o1', { discountType: null }, actor);
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: expect.objectContaining({ discountType: null, discountValue: null }),
      });
    });

    it('clears the discount pair when discountValue is null alone', async () => {
      await service.update('o1', { discountValue: null }, actor);
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: expect.objectContaining({ discountType: null, discountValue: null }),
      });
    });

    it('clears routeId and cabinClass with explicit null', async () => {
      await service.update('o1', { routeId: null, cabinClass: null }, actor);
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: expect.objectContaining({ routeId: null, cabinClass: null }),
      });
    });

    it('keeps existing values for omitted fields', async () => {
      await service.update('o1', { badge: 'Last seats' }, actor);
      const data = prisma.offer.update.mock.calls[0]![0]!.data!;
      expect(data.discountType).toBeUndefined();
      expect(data.discountValue).toBeUndefined();
      expect(data.routeId).toBeUndefined();
      expect(data.cabinClass).toBeUndefined();
      expect(data.badge).toBe('Last seats');
    });

    it('400s on a contradictory request (null on one member, value on the other)', async () => {
      await expect(service.update('o1', { discountType: null, discountValue: 10 }, actor)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.update('o1', { discountType: 'PERCENT', discountValue: null }, actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('treats clearing an already marketing-only offer as a harmless no-op', async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...existingBookable, discountType: null, discountValue: null });
      await service.update('o1', { discountType: null }, actor);
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: expect.objectContaining({ discountType: null, discountValue: null }),
      });
    });

    it('still enforces pair and range rules when setting values', async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...existingBookable, discountType: null, discountValue: null });
      await expect(service.update('o1', { discountType: 'PERCENT' }, actor)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.update('o1', { discountType: 'PERCENT', discountValue: 150 }, actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.offer.update).not.toHaveBeenCalled();

      await service.update('o1', { discountType: 'PERCENT', discountValue: 20 }, actor);
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: expect.objectContaining({ discountType: 'PERCENT', discountValue: 20 }),
      });
    });

    it('validates the merged target state after clearing', async () => {
      // Clearing routeId skips the route-existence check entirely.
      prisma.route.findUnique.mockResolvedValue(null);
      await service.update('o1', { routeId: null }, actor);
      expect(prisma.route.findUnique).not.toHaveBeenCalled();
      expect(prisma.offer.update).toHaveBeenCalled();
    });
  });

  // ---------- assertBookable ----------

  describe('assertBookable', () => {
    const context = { routeId: 'route-1', cabinClass: 'ECONOMY' as const };
    const bookableOffer = (overrides: Record<string, unknown> = {}) => ({
      id: 'o1',
      title: 'T',
      status: 'ACTIVE',
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 86_400_000),
      discountType: 'PERCENT',
      discountValue: 15,
      routeId: null,
      cabinClass: null,
      ...overrides,
    });
    const expectUnavailable = async (offer: unknown) => {
      prisma.offer.findUnique.mockResolvedValue(offer);
      const err = await service.assertBookable('o1', context).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'OFFER_NOT_AVAILABLE' });
    };

    it('404s with OFFER_NOT_FOUND for a missing offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      const err = await service.assertBookable('missing', context).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({ code: 'OFFER_NOT_FOUND' });
    });

    it('409s for DRAFT, INACTIVE and EXPIRED statuses', async () => {
      await expectUnavailable(bookableOffer({ status: 'DRAFT' }));
      await expectUnavailable(bookableOffer({ status: 'INACTIVE' }));
      await expectUnavailable(bookableOffer({ status: 'EXPIRED' }));
    });

    it('409s outside the validity window (same semantics as publicWhere)', async () => {
      await expectUnavailable(bookableOffer({ validUntil: new Date(Date.now() - 86_400_000) }));
      await expectUnavailable(
        bookableOffer({ validFrom: new Date(Date.now() + 86_400_000), validUntil: new Date(Date.now() + 2 * 86_400_000) }),
      );
    });

    it('409s for marketing-only offers and invalid discount terms', async () => {
      await expectUnavailable(bookableOffer({ discountType: null, discountValue: null }));
      await expectUnavailable(bookableOffer({ discountType: 'PERCENT', discountValue: 0 }));
      await expectUnavailable(bookableOffer({ discountType: 'PERCENT', discountValue: 101 }));
      await expectUnavailable(bookableOffer({ discountType: 'FIXED_AMOUNT', discountValue: 0 }));
    });

    it('accepts the same boundaries the public view treats as bookable', async () => {
      // Guards the shared rule: if the public view says bookable, booking must
      // not 409 on the discount terms alone.
      for (const overrides of [
        { discountType: 'PERCENT', discountValue: 100 },
        { discountType: 'PERCENT', discountValue: 0.01 },
        { discountType: 'FIXED_AMOUNT', discountValue: 0.01 },
      ]) {
        const offer = bookableOffer(overrides);
        prisma.offer.findUnique.mockResolvedValue(offer);
        await expect(service.assertBookable('o1', context)).resolves.toBe(offer);
      }
    });

    it('409s on route or cabin mismatch and AND-combines both', async () => {
      await expectUnavailable(bookableOffer({ routeId: 'route-2' }));
      await expectUnavailable(bookableOffer({ cabinClass: 'BUSINESS' }));
      await expectUnavailable(bookableOffer({ routeId: 'route-1', cabinClass: 'BUSINESS' }));
      await expectUnavailable(bookableOffer({ routeId: 'route-2', cabinClass: 'ECONOMY' }));
    });

    it('returns the offer for a valid bookable offer matching the context', async () => {
      const offer = bookableOffer({ routeId: 'route-1', cabinClass: 'ECONOMY' });
      prisma.offer.findUnique.mockResolvedValue(offer);
      await expect(service.assertBookable('o1', context)).resolves.toBe(offer);
    });

    it('uses the transaction client when provided', async () => {
      const offer = bookableOffer();
      const tx = { offer: { findUnique: vi.fn().mockResolvedValue(offer) } };
      await expect(service.assertBookable('o1', context, tx as never)).resolves.toBe(offer);
      expect(tx.offer.findUnique).toHaveBeenCalledWith({ where: { id: 'o1' } });
      expect(prisma.offer.findUnique).not.toHaveBeenCalled();
    });
  });

  // ---------- Permanent delete ----------

  describe('deletePermanent', () => {
    it('hard-deletes an unused offer and audits OFFER_HARD_DELETED', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 'o1', title: 'T' });
      prisma.booking.count.mockResolvedValue(0);
      prisma.offer.delete.mockResolvedValue({ id: 'o1', title: 'T' });
      await service.deletePermanent('o1', actor);
      expect(prisma.offer.delete).toHaveBeenCalledWith({ where: { id: 'o1' } });
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OFFER_HARD_DELETED', targetType: 'Offer', targetId: 'o1', metadata: { title: 'T' } }),
      );
    });

    it('409s with OFFER_IN_USE and the booking count when referenced by bookings', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 'o1', title: 'T' });
      prisma.booking.count.mockResolvedValue(2);
      const err = await service.deletePermanent('o1', actor).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'OFFER_IN_USE', bookingCount: 2 });
      expect(prisma.offer.delete).not.toHaveBeenCalled();
    });

    it('404s for a nonexistent offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.deletePermanent('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.booking.count).not.toHaveBeenCalled();
    });
  });
});
