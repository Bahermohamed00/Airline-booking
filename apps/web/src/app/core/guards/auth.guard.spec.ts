import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  UrlTree,
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type RouterStateSnapshot,
} from '@angular/router';
import { authGuard, guestGuard, staffGuard, permissionGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

type AuthStub = {
  isLoggedIn?: () => boolean;
  isStaff?: () => boolean;
  hasPermission?: (permission: string) => boolean;
};

function runWith(authStub: AuthStub, guard: CanActivateFn, url = '/profile/sessions'): boolean | UrlTree {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
  });
  // These guards are synchronous (boolean | UrlTree); cast past the widened
  // MaybeAsync<GuardResult> signature.
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  ) as boolean | UrlTree;
}

describe('authGuard', () => {
  it('allows authenticated users', () => {
    expect(runWith({ isLoggedIn: () => true }, authGuard)).toBe(true);
  });

  it('redirects unauthenticated users to /login with a return URL', () => {
    const result = runWith({ isLoggedIn: () => false }, authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/login');
    expect((result as UrlTree).toString()).toContain('returnUrl');
  });
});

describe('guestGuard', () => {
  it('allows unauthenticated users', () => {
    expect(runWith({ isLoggedIn: () => false }, guestGuard, '/login')).toBe(true);
  });

  it('redirects authenticated customers away from login to /bookings', () => {
    const result = runWith({ isLoggedIn: () => true, isStaff: () => false }, guestGuard, '/login');
    expect((result as UrlTree).toString()).toBe('/bookings');
  });

  it('redirects authenticated staff to /admin/dashboard', () => {
    const result = runWith({ isLoggedIn: () => true, isStaff: () => true }, guestGuard, '/admin/login');
    expect((result as UrlTree).toString()).toBe('/admin/dashboard');
  });

  it('the redirect targets are themselves reachable (no redirect loop)', () => {
    // /bookings is behind authGuard: an authenticated user passes it.
    expect(runWith({ isLoggedIn: () => true }, authGuard, '/bookings')).toBe(true);
    // /admin/dashboard is behind staffGuard: a staff user passes it.
    expect(runWith({ isLoggedIn: () => true, isStaff: () => true }, staffGuard, '/admin/dashboard')).toBe(true);
  });
});

describe('staffGuard', () => {
  it('allows staff', () => {
    expect(runWith({ isLoggedIn: () => true, isStaff: () => true }, staffGuard, '/admin/users')).toBe(true);
  });

  it('sends logged-in non-staff to /admin/denied', () => {
    const result = runWith({ isLoggedIn: () => true, isStaff: () => false }, staffGuard, '/admin/users');
    expect((result as UrlTree).toString()).toContain('/admin/denied');
  });

  it('sends guests to /admin/login with a return URL', () => {
    const result = runWith({ isLoggedIn: () => false, isStaff: () => false }, staffGuard, '/admin/users');
    const str = (result as UrlTree).toString();
    expect(str).toContain('/admin/login');
    expect(str).toContain('returnUrl');
  });
});

describe('permissionGuard', () => {
  it('allows when the permission is present', () => {
    expect(runWith({ hasPermission: () => true }, permissionGuard('users:read'), '/admin/users')).toBe(true);
  });

  it('redirects to /admin/denied when the permission is missing', () => {
    const result = runWith({ hasPermission: () => false }, permissionGuard('users:read'), '/admin/users');
    expect((result as UrlTree).toString()).toContain('/admin/denied');
  });
});
