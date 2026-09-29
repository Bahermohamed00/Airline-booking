import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
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

describe('PermissionsGuard', () => {
  it('allows when no permissions are required', () => {
    const guard = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, undefined));
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });

  it('allows when @Permissions() declares an empty requirement list', () => {
    const guard = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, []));
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });

  it('requires every listed permission', () => {
    const guard = new PermissionsGuard(
      reflectorReturning(PERMISSIONS_KEY, [
        { resource: 'users', action: 'read' },
        { resource: 'bookings', action: 'manage' },
      ]),
    );
    expect(guard.canActivate(contextWith(userWith([], ['users:read', 'bookings:manage'])))).toBe(true);
    expect(() => guard.canActivate(contextWith(userWith([], ['users:read'])))).toThrow(ForbiddenException);
  });

  it('lets the super_admin permission bypass the check', () => {
    const guard = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, [{ resource: 'settings', action: 'manage' }]));
    expect(guard.canActivate(contextWith(userWith([], ['super_admin'])))).toBe(true);
  });

  it('rejects an absent user with 403', () => {
    const guard = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, [{ resource: 'users', action: 'read' }]));
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException);
  });

  it('fails closed on malformed permission metadata', () => {
    // A bare string instead of {resource, action}
    const stringMeta = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, ['users:read']));
    expect(() => stringMeta.canActivate(contextWith(userWith([], ['users:read'])))).toThrow(ForbiddenException);

    // An object missing both fields
    const emptyMeta = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, [{}]));
    expect(() => emptyMeta.canActivate(contextWith(userWith([], ['users:read'])))).toThrow(ForbiddenException);
  });

  it('permission matching is case-sensitive and format-exact', () => {
    const guard = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, [{ resource: 'users', action: 'read' }]));
    expect(guard.canActivate(contextWith(userWith([], ['users:read'])))).toBe(true);
    expect(() => guard.canActivate(contextWith(userWith([], ['Users:Read'])))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextWith(userWith([], ['users: read'])))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextWith(userWith([], ['users:read '])))).toThrow(ForbiddenException);
  });

  it('a well-formed but nonexistent permission never grants access', () => {
    const guard = new PermissionsGuard(reflectorReturning(PERMISSIONS_KEY, [{ resource: 'ghost', action: 'fly' }]));
    expect(() => guard.canActivate(contextWith(userWith([], ['users:read', 'bookings:manage'])))).toThrow(ForbiddenException);
  });
});
