import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';

function contextWith(user: AuthUser | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const userWith = (roles: string[], permissions: string[]): AuthUser => ({
  userId: 'u1',
  email: 'a@b.c',
  firstName: 'A',
  lastName: 'B',
  emailVerified: true,
  mfaEnabled: false,
  roles,
  permissions,
  sessionId: 's1',
});

function reflectorReturning(key: string, value: unknown): Reflector {
  const r = new Reflector();
  vi.spyOn(r, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => (metadataKey === key ? value : undefined));
  return r;
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const guard = new RolesGuard(reflectorReturning(ROLES_KEY, undefined));
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });

  it('allows a user holding a required role', () => {
    const guard = new RolesGuard(reflectorReturning(ROLES_KEY, ['Super Admin', 'Booking Manager']));
    expect(guard.canActivate(contextWith(userWith(['Booking Manager'], [])))).toBe(true);
  });

  it('rejects with 403 when the role is missing or the user is absent', () => {
    const guard = new RolesGuard(reflectorReturning(ROLES_KEY, ['Super Admin']));
    expect(() => guard.canActivate(contextWith(userWith(['Customer'], [])))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException);
  });
});
