import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { API_CONFIG } from '../config/api-config';

const base = 'http://test-api/api';

const mePayload = {
  userId: 'u1',
  email: 'a@b.c',
  firstName: 'Ann',
  lastName: 'Bee',
  emailVerified: true,
  mfaEnabled: false,
  roles: ['Customer'],
  permissions: [] as string[],
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_CONFIG, useValue: { baseUrl: base, useRealApi: true } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  function loginAndFlush(): void {
    auth.login('a@b.c', 'Password123!').subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({ accessToken: 'access-1', expiresIn: 900 });
    httpMock.expectOne(`${base}/auth/me`).flush(mePayload);
  }

  it('attaches the in-memory access token and credentials to API calls', () => {
    loginAndFlush();

    http.get(`${base}/bookings`).subscribe();
    const req = httpMock.expectOne(`${base}/bookings`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
    httpMock.verify();
  });

  it('refreshes once and retries with the new token after a 401', () => {
    loginAndFlush();
    let result: unknown;
    http.get(`${base}/bookings`).subscribe((r) => (result = r));

    httpMock.expectOne(`${base}/bookings`).flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${base}/auth/refresh`).flush({ accessToken: 'access-2', expiresIn: 900 });
    const retry = httpMock.expectOne(`${base}/bookings`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush([{ id: 'b1' }]);

    expect(result).toEqual([{ id: 'b1' }]);
    httpMock.verify();
  });

  it('does not attempt a refresh when the login call itself returns 401', () => {
    let error: { message?: string } | undefined;
    auth.login('a@b.c', 'wrong-password').subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(`${base}/auth/login`).flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${base}/auth/refresh`);
    expect(error?.message).toBe('Invalid credentials');
    httpMock.verify();
  });

  it('refreshes and retries when an authenticated /auth/* endpoint returns 401', () => {
    loginAndFlush();
    let result: unknown;
    http.get(`${base}/auth/sessions`).subscribe((r) => (result = r));

    httpMock.expectOne(`${base}/auth/sessions`).flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${base}/auth/refresh`).flush({ accessToken: 'access-2', expiresIn: 900 });
    const retry = httpMock.expectOne(`${base}/auth/sessions`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush([{ id: 's1' }]);

    expect(result).toEqual([{ id: 's1' }]);
    httpMock.verify();
  });

  it('does not attempt a refresh when a public reset-request returns 401', () => {
    let error: unknown;
    http.post(`${base}/auth/password-reset-request`, { email: 'a@b.c' }).subscribe({ error: (e) => (error = e) });

    httpMock
      .expectOne(`${base}/auth/password-reset-request`)
      .flush({ message: 'nope' }, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${base}/auth/refresh`);
    expect(error).toBeDefined();
    httpMock.verify();
  });

  it('clears the session and propagates when the refresh fails', () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true); // swallow the session-expired redirect
    loginAndFlush();
    let error: unknown;
    http.get(`${base}/bookings`).subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(`${base}/bookings`).flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${base}/auth/refresh`).flush({ message: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeDefined();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    httpMock.verify();
  });

  it('leaves non-API requests untouched', () => {
    loginAndFlush();

    http.get('https://cdn.example.com/data.json').subscribe();
    const req = httpMock.expectOne('https://cdn.example.com/data.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it('redirects to login with session-expired context when the refresh fails', () => {
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { get: () => '/profile/sessions', configurable: true });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    loginAndFlush();

    http.get(`${base}/bookings`).subscribe({ error: () => undefined });
    httpMock.expectOne(`${base}/bookings`).flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${base}/auth/refresh`).flush({ message: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'session-expired', returnUrl: '/profile/sessions' },
    });
    httpMock.verify();
  });

  it('does not redirect when already on a login page (loop prevention)', () => {
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { get: () => '/login', configurable: true });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    loginAndFlush();

    http.get(`${base}/bookings`).subscribe({ error: () => undefined });
    httpMock.expectOne(`${base}/bookings`).flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${base}/auth/refresh`).flush({ message: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });
});
