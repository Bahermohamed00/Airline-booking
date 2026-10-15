import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const staffGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Support Staff always land on their support overview. The '' child route
  // redirects /admin → /admin/dashboard BEFORE this guard runs, so the final
  // URL here is usually /admin/dashboard — match both.
  if (auth.isSupportStaff() && (state.url === '/admin' || state.url === '/admin/dashboard')) {
    return router.createUrlTree(['/admin/support/overview']);
  }

  if (auth.isStaff()) return true;
  if (auth.isLoggedIn()) return router.createUrlTree(['/admin/denied']);
  return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
};

export function permissionGuard(permission: string): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.hasPermission(permission)) return true;
    return router.createUrlTree(['/admin/denied'], { queryParams: { from: state.url } });
  };
}

/**
 * Guest-only pages (login/register). Safe to read signals directly: the app
 * initializer (app.config.ts) blocks bootstrap until restoreSession() settles,
 * so session state is final before the first guard runs.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return true;

  if (auth.isSupportStaff()) {
    return router.createUrlTree(['/admin/support/overview']);
  }

  return router.createUrlTree([auth.isStaff() ? '/admin/dashboard' : '/bookings']);
};