import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree } from '@angular/router';
import { staffGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

/**
 * staffGuard regression coverage: Support Staff must always land on
 * /admin/support/overview — including when the '' child redirect has already
 * rewritten /admin to /admin/dashboard before the guard runs.
 */
describe('staffGuard', () => {
  let auth: { isSupportStaff: () => boolean; isStaff: () => boolean; isLoggedIn: () => boolean };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };

  const run = (url: string) =>
    TestBed.runInInjectionContext(() =>
      staffGuard({} as never, { url } as never),
    ) as boolean | UrlTree;

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = { isSupportStaff: () => false, isStaff: () => true, isLoggedIn: () => true };
    router = { createUrlTree: vi.fn((commands: unknown[], extras?: unknown) => ({ commands, extras })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  const supportStaff = () => {
    auth.isSupportStaff = () => true;
  };

  it('redirects Support Staff from /admin to the support overview', () => {
    supportStaff();
    run('/admin');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/support/overview']);
  });

  it('redirects Support Staff from /admin/dashboard to the support overview (post-redirect URL)', () => {
    supportStaff();
    run('/admin/dashboard');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/support/overview']);
  });

  it('lets Support Staff through to their support pages', () => {
    supportStaff();
    expect(run('/admin/support')).toBe(true);
    expect(run('/admin/support/overview')).toBe(true);
  });

  it('lets normal operations staff reach /admin/dashboard untouched', () => {
    auth.isSupportStaff = () => false;
    expect(run('/admin/dashboard')).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalledWith(['/admin/support/overview']);
  });

  it('sends non-staff logged-in users to the denied page', () => {
    auth.isStaff = () => false;
    run('/admin/dashboard');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/denied']);
  });

  it('sends anonymous users to the admin login with a returnUrl', () => {
    auth.isStaff = () => false;
    auth.isLoggedIn = () => false;
    run('/admin/dashboard');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/login'], {
      queryParams: { returnUrl: '/admin/dashboard' },
    });
  });
});
