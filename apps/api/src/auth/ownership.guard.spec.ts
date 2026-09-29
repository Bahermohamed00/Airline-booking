import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard.js';
import { OWNERSHIP_KEY, type OwnershipRequirement } from './decorators/ownership.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './decorators/current-user.decorator.js';

const requirement: OwnershipRequirement = { resource: 'session', param: 'id' };

function contextWith(user: AuthUser | undefined, id: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, params: { id } }) }),
  } as unknown as ExecutionContext;
}

const user = (permissions: string[] = []): AuthUser => ({
  userId: 'user-1',
  email: 'a@b.c',
  firstName: 'A',
  lastName: 'B',
  emailVerified: true,
  mfaEnabled: false,
  roles: ['Customer'],
  permissions,
  sessionId: 's1',
});

function reflectorWith(value: OwnershipRequirement | undefined): Reflector {
  const r = new Reflector();
  vi.spyOn(r, 'getAllAndOverride').mockImplementation((key: unknown) => (key === OWNERSHIP_KEY ? value : undefined));
  return r;
}

describe('OwnershipGuard', () => {
  const prisma = { session: { findUnique: vi.fn() } };

  beforeEach(() => {
    prisma.session.findUnique.mockReset();
  });

  function guardWith(meta: OwnershipRequirement | undefined): OwnershipGuard {
    return new OwnershipGuard(prisma as unknown as PrismaService, reflectorWith(meta));
  }

  it('allows everything when no ownership metadata is present', async () => {
    await expect(guardWith(undefined).canActivate(contextWith(undefined, 's-1'))).resolves.toBe(true);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it('allows the owner', async () => {
    prisma.session.findUnique.mockResolvedValue({ userId: 'user-1' });
    await expect(guardWith(requirement).canActivate(contextWith(user(), 's-1'))).resolves.toBe(true);
  });

  it('answers 404 (no existence leak) for a stranger resource', async () => {
    prisma.session.findUnique.mockResolvedValue({ userId: 'someone-else' });
    await expect(guardWith(requirement).canActivate(contextWith(user(), 's-1'))).rejects.toThrow(NotFoundException);
  });

  it('answers 404 for a missing resource', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(guardWith(requirement).canActivate(contextWith(user(), 's-9'))).rejects.toThrow(NotFoundException);
  });

  it('rejects an unauthenticated caller with 403', async () => {
    await expect(guardWith(requirement).canActivate(contextWith(undefined, 's-1'))).rejects.toThrow(ForbiddenException);
  });

  it('honors the bypass permission and super_admin', async () => {
    const bypassReq: OwnershipRequirement = { ...requirement, bypassPermission: 'users:update' };
    prisma.session.findUnique.mockResolvedValue({ userId: 'someone-else' });

    await expect(guardWith(bypassReq).canActivate(contextWith(user(['users:update']), 's-1'))).resolves.toBe(true);
    await expect(guardWith(bypassReq).canActivate(contextWith(user(['super_admin']), 's-1'))).resolves.toBe(true);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
});
