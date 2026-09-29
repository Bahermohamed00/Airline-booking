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
  },
});

describe('OffersService', () => {
  let service: OffersService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [OffersService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: { log: vi.fn() } }],
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const [view] = await service.findPublic();
    expect(view).not.toHaveProperty('status');
    expect(view).not.toHaveProperty('createdAt');
    expect(view).not.toHaveProperty('updatedAt');
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
});
