import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { SAFE_USER_OMIT, SUPPORT_RESTRICTED_USER_OMIT } from './safe-user';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const createMockPrisma = () => {
  const tx = {
    user: { update: vi.fn().mockResolvedValue({ id: 'staff-1', status: 'DEACTIVATED' }) },
    userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    role: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    userRole: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
    __tx: tx,
  };
};

const adminActor = { userId: 'admin-1', roles: ['Administrator'], permissions: [] } as unknown as AuthUser;
const supportActor = { userId: 'support-1', roles: ['Support Staff'], permissions: [] } as unknown as AuthUser;

const emailWhere = { email: { contains: 'alice', mode: 'insensitive' as const } };

describe('UsersService.findAll', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: {} },
        { provide: AuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('legacy bare-array path (no page/limit)', () => {
    it('returns findMany directly without a transaction or ordering', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      const result = await service.findAll({ where: emailWhere }, adminActor, {});
      expect(result).toEqual([{ id: 'u1' }]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.count).not.toHaveBeenCalled();
      const call = prisma.user.findMany.mock.calls[0]![0];
      expect(call.where).toEqual(emailWhere);
      expect(call.omit).toEqual(SAFE_USER_OMIT);
      expect(call.orderBy).toBeUndefined();
      expect(call.skip).toBeUndefined();
      expect(call.take).toBeUndefined();
    });

    it('uses the support-restricted omit for Support Staff', async () => {
      await service.findAll(undefined, supportActor, {});
      expect(prisma.user.findMany.mock.calls[0]![0].omit).toEqual(SUPPORT_RESTRICTED_USER_OMIT);
    });
  });

  describe('paginated path', () => {
    it('returns the envelope with skip/take/orderBy and a same-where count', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      prisma.user.count.mockResolvedValue(25);
      const result = await service.findAll({ where: emailWhere }, adminActor, { page: 2, limit: 5 });
      expect(result).toEqual({ items: [{ id: 'u1' }, { id: 'u2' }], page: 2, limit: 5, total: 25, totalPages: 5 });

      const query = prisma.user.findMany.mock.calls[0]![0];
      expect(query.where).toEqual(emailWhere);
      expect(query.orderBy).toEqual([{ email: 'asc' }, { id: 'asc' }]);
      expect(query.skip).toBe(5);
      expect(query.take).toBe(5);
      expect(query.omit).toEqual(SAFE_USER_OMIT);

      // count() uses only the where-filter — never include/omit/skip/take.
      const countArgs = prisma.user.count.mock.calls[0]![0];
      expect(countArgs).toEqual({ where: emailWhere });
      expect(Object.keys(countArgs)).toEqual(['where']);
    });

    it('applies the support-restricted omit to both query and envelope', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      prisma.user.count.mockResolvedValue(1);
      const result = await service.findAll(undefined, supportActor, { page: 1, limit: 10 });
      expect(prisma.user.findMany.mock.calls[0]![0].omit).toEqual(SUPPORT_RESTRICTED_USER_OMIT);
      expect(result).toEqual({ items: [{ id: 'u1' }], page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('defaults limit to 20 when only page is given, page to 1 when only limit is given', async () => {
      await service.findAll(undefined, adminActor, { page: 3 });
      let query = prisma.user.findMany.mock.calls[0]![0];
      expect(query.skip).toBe(40);
      expect(query.take).toBe(20);

      prisma.user.findMany.mockClear();
      await service.findAll(undefined, adminActor, { limit: 7 });
      query = prisma.user.findMany.mock.calls[0]![0];
      expect(query.skip).toBe(0);
      expect(query.take).toBe(7);
    });

    it('returns an empty items array with totalPages 1 for an empty page', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      const result = await service.findAll(undefined, adminActor, { page: 1, limit: 5 });
      expect(result).toEqual({ items: [], page: 1, limit: 5, total: 0, totalPages: 1 });
    });
  });

  describe('UsersService.update self-protection', () => {
    it('rejects deactivating your own account without any write', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@test.dev' });
      const self = { userId: 'admin-1', roles: ['Super Admin'], permissions: ['super_admin'] } as unknown as AuthUser;

      await expect(service.update('admin-1', { status: 'DEACTIVATED' }, self)).rejects.toThrow(
        'You cannot deactivate your own account',
      );
      // The guard throws inside the transaction before any write happens.
      expect(prisma.__tx.user.update).not.toHaveBeenCalled();
    });

    it('still allows status changes on other accounts, preserving roles', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', email: 'staff@test.dev' });
      const self = { userId: 'admin-1', roles: ['Super Admin'], permissions: ['super_admin'] } as unknown as AuthUser;

      const updated = await service.update('staff-1', { status: 'DEACTIVATED' }, self);

      expect(updated.status).toBe('DEACTIVATED');
      // Status-only change: no role rows touched.
      expect(prisma.__tx.userRole.deleteMany).not.toHaveBeenCalled();
      expect(prisma.__tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'staff-1' }, data: expect.objectContaining({ status: 'DEACTIVATED' }) }),
      );
    });
  });
});
