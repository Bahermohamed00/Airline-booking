import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import type { User } from '../models/domain.model';

function userWith(roles: string[], permissions: string[]): User {
  return {
    id: 'u1',
    email: 'staff@example.com',
    firstName: 'Staff',
    lastName: 'User',
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    roles,
    permissions,
  };
}

describe('AuthService permissions', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
  });

  it('denies everything when logged out', () => {
    expect(auth.hasPermission('bookings:manage')).toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.isStaff()).toBe(false);
  });

  it('grants super_admin every permission', () => {
    auth.setSession(userWith(['Super Admin'], ['super_admin']));
    expect(auth.hasPermission('settings:manage')).toBe(true);
    expect(auth.hasPermission('audit:read')).toBe(true);
    expect(auth.hasPermission('anything:at-all')).toBe(true);
    expect(auth.isStaff()).toBe(true);
  });

  it('scopes permissions to exactly what the role grants', () => {
    auth.setSession(userWith(['Flight Manager'], ['dashboard:read', 'flights:read', 'flights:manage', 'aircraft:manage', 'routes:manage']));
    expect(auth.hasPermission('flights:manage')).toBe(true);
    expect(auth.hasPermission('aircraft:manage')).toBe(true);
    expect(auth.hasPermission('payments:refund')).toBe(false);
    expect(auth.hasPermission('settings:manage')).toBe(false);
  });

  it('scopes Finance Staff to payments and reports', () => {
    auth.setSession(userWith(['Finance Staff'], ['dashboard:read', 'payments:read', 'payments:refund', 'reports:read']));
    expect(auth.hasPermission('payments:read')).toBe(true);
    expect(auth.hasPermission('payments:refund')).toBe(true);
    expect(auth.hasPermission('flights:manage')).toBe(false);
  });

  it('customers are not staff', () => {
    auth.setSession(userWith(['Customer'], []));
    expect(auth.isStaff()).toBe(false);
  });
});
