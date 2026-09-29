import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { API_CONFIG } from '../config/api-config';

const RETRIED = new HttpContextToken<boolean>(() => false);

/** Unauthenticated auth endpoints: a 401 here is definitive and must never trigger a refresh retry. */
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/email-verification',
  '/auth/email-verification-request',
  '/auth/password-reset',
  '/auth/password-reset-request',
];

/** Dead session: clear, then send the user to the right login page with context. */
function redirectToLogin(router: Router): void {
  const current = router.url;
  if (current.startsWith('/login') || current.startsWith('/admin/login')) return;
  const target = current.startsWith('/admin') ? '/admin/login' : '/login';
  void router.navigate([target], { queryParams: { reason: 'session-expired', returnUrl: current } });
}

/**
 * Attaches the in-memory access token to API calls and, on a 401, performs a
 * single-flight cookie refresh and retries the request once. Public auth
 * endpoints are excluded from the retry (a 401 there is a definitive answer,
 * e.g. bad credentials — and /auth/refresh itself must never loop), but still
 * carry credentials so the refresh cookie flows. Authenticated /auth/*
 * endpoints (sessions, me, logout, mfa) DO get the refresh+retry path.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(API_CONFIG);
  if (!config.useRealApi || !req.url.startsWith(config.baseUrl)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  const isPublicAuthEndpoint = PUBLIC_AUTH_PATHS.some((p) => req.url.startsWith(`${config.baseUrl}${p}`));

  const build = (request: HttpRequest<unknown>, token: string | null, retried: boolean) =>
    request.clone({
      withCredentials: true,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      context: request.context.set(RETRIED, retried),
    });

  return next(build(req, auth.accessToken(), req.context.get(RETRIED))).pipe(
    catchError((error: unknown) => {
      const mayRetry = error instanceof HttpErrorResponse && error.status === 401 && !isPublicAuthEndpoint && !req.context.get(RETRIED);
      if (!mayRetry) {
        return throwError(() => error);
      }
      return auth.refreshAccessToken().pipe(
        switchMap((token) => next(build(req, token, true))),
        catchError((refreshError: unknown) => {
          // Refresh failed: the session is dead. Say so plainly and preserve
          // the target instead of surfacing a misleading generic error.
          redirectToLogin(router);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
