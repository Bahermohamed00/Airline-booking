import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/** Attaches the JWT to API calls when running against the real NestJS API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useRealApi) return next(req);
  const token = inject(AuthService).accessToken();
  if (!token || !req.url.startsWith(environment.apiBaseUrl)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
