import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { STAFF_USERS } from '../mock/mock-data';
import { environment } from '../../../environments/environment';

describe('AuthService permissions', () => {
  let auth: AuthService;
  const originalUseRealApi = environment.useRealApi;

  beforeAll(() => {
    // Permission logic is mode-independent; force mock mode for these specs.
    environment.useRealApi = false;
  });

  afterAll(() => {
    environment.useRealApi = originalUseRealApi;
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    auth = TestBed.inject(AuthService);
    auth.logout();
  });

  it('denies everything when logged out', () => {
    expect(auth.hasPermission('bookings:manage')).toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.isStaff()).toBe(false);
  });

  it('grants super_admin every permission', () => {
    auth.loginAsRole('Super Admin');
    expect(auth.hasPermission('settings:manage')).toBe(true);
    expect(auth.hasPermission('audit:read')).toBe(true);
    expect(auth.hasPermission('anything:at-all')).toBe(true);
    expect(auth.isStaff()).toBe(true);
  });

  it('scopes Flight Manager to flight operations only', () => {
    auth.loginAsRole('Flight Manager');
    expect(auth.hasPermission('flights:manage')).toBe(true);
    expect(auth.hasPermission('aircraft:manage')).toBe(true);
    expect(auth.hasPermission('payments:refund')).toBe(false);
    expect(auth.hasPermission('settings:manage')).toBe(false);
  });

  it('scopes Finance Staff to payments and reports', () => {
    auth.loginAsRole('Finance Staff');
    expect(auth.hasPermission('payments:read')).toBe(true);
    expect(auth.hasPermission('payments:refund')).toBe(true);
    expect(auth.hasPermission('flights:manage')).toBe(false);
  });

  it('customers are not staff', () => {
    auth.setSession({ ...STAFF_USERS[0], roles: ['Customer'], permissions: [] });
    expect(auth.isStaff()).toBe(false);
  });
});
