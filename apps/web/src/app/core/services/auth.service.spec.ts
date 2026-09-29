import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, type LoginResult } from './auth.service';
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

function setup(useRealApi = true): { auth: AuthService; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: { baseUrl: base, useRealApi } },
    ],
  });
  return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
}

describe('AuthService (real API mode)', () => {
  it('login stores the access token in memory and emits the fetched profile', () => {
    const { auth, http } = setup();
    let result: LoginResult | undefined;
    auth.login('a@b.c', 'Password123!').subscribe((r) => (result = r));

    http.expectOne(`${base}/auth/login`).flush({ accessToken: 'access-1', expiresIn: 900 });
    http.expectOne(`${base}/auth/me`).flush(mePayload);

    expect(auth.accessToken()).toBe('access-1');
    expect(result?.user.email).toBe('a@b.c');
    expect(result?.user.firstName).toBe('Ann');
    http.verify();
  });

  it('restoreSession rebuilds the session from the refresh cookie', () => {
    const { auth, http } = setup();
    auth.restoreSession().subscribe();

    http.expectOne(`${base}/auth/refresh`).flush({ accessToken: 'access-2', expiresIn: 900 });
    http.expectOne(`${base}/auth/me`).flush(mePayload);

    expect(auth.accessToken()).toBe('access-2');
    expect(auth.isLoggedIn()).toBe(true);
    http.verify();
  });

  it('restoreSession leaves the user logged out when the refresh cookie is rejected', () => {
    const { auth, http } = setup();
    auth.restoreSession().subscribe();

    http.expectOne(`${base}/auth/refresh`).flush({ message: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    http.verify();
  });

  it('shares a single in-flight refresh across concurrent callers', () => {
    const { auth, http } = setup();
    const received: string[] = [];
    auth.refreshAccessToken().subscribe((t) => received.push(t));
    auth.refreshAccessToken().subscribe((t) => received.push(t));

    http.expectOne(`${base}/auth/refresh`).flush({ accessToken: 'shared-token', expiresIn: 900 });

    expect(received).toEqual(['shared-token', 'shared-token']);
    expect(auth.accessToken()).toBe('shared-token');
    http.verify();
  });

  it('logout clears state immediately and tells the API to revoke the session', () => {
    const { auth, http } = setup();
    auth.setSession({
      id: 'u1',
      email: 'a@b.c',
      firstName: 'Ann',
      lastName: 'Bee',
      emailVerified: true,
      mfaEnabled: false,
      status: 'ACTIVE',
      roles: ['Customer'],
      permissions: [],
    });

    auth.logout();

    expect(auth.isLoggedIn()).toBe(false);
    http.expectOne(`${base}/auth/logout`).flush({ message: 'Logged out' });
    http.verify();
  });

  it('does not resurrect the session when logout happens while a refresh is in flight', () => {
    const { auth, http } = setup();
    auth.setSession({
      id: 'u1',
      email: 'a@b.c',
      firstName: 'Ann',
      lastName: 'Bee',
      emailVerified: true,
      mfaEnabled: false,
      status: 'ACTIVE',
      roles: ['Customer'],
      permissions: [],
    });

    auth.refreshAccessToken().subscribe({ error: () => undefined });
    auth.logout();

    http.expectOne(`${base}/auth/logout`).flush({ message: 'Logged out' });
    // The refresh resolves only after the logout completed
    http.expectOne(`${base}/auth/refresh`).flush({ accessToken: 'late-token', expiresIn: 900 });

    expect(auth.accessToken()).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    http.verify();
  });

  it('a failing pre-logout refresh does not kill a fresh login session', () => {
    const { auth, http } = setup();

    // Stale in-flight refresh from the old session
    auth.refreshAccessToken().subscribe({ error: () => undefined });
    auth.logout();
    http.expectOne(`${base}/auth/logout`).flush({ message: 'Logged out' });

    // User logs in again (fresh session) before the stale refresh settles
    auth.login('a@b.c', 'Password123!').subscribe((r) => auth.setSession(r.user));
    http.expectOne(`${base}/auth/login`).flush({ accessToken: 'fresh-token', expiresIn: 900 });
    http.expectOne(`${base}/auth/me`).flush(mePayload);
    expect(auth.accessToken()).toBe('fresh-token');

    // The stale refresh now fails — it must not clear the new session
    http.expectOne(`${base}/auth/refresh`).flush({ message: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.accessToken()).toBe('fresh-token');
    expect(auth.isLoggedIn()).toBe(true);
    http.verify();
  });

  it('maps MFA-required responses to a descriptive error', () => {
    const { auth, http } = setup();
    let error: { message?: string; code?: string } | undefined;
    auth.login('a@b.c', 'Password123!').subscribe({ error: (e) => (error = e) });

    http.expectOne(`${base}/auth/login`).flush({ mfaRequired: true });

    expect(error?.code).toBe('MFA_REQUIRED');
    http.verify();
  });

  it('listSessions fetches the sessions from the API', () => {
    const { auth, http } = setup();
    let result: unknown[] | undefined;
    auth.listSessions().subscribe((r) => (result = r));

    http.expectOne(`${base}/auth/sessions`).flush([
      { id: 's1', userAgent: null, ipAddress: null, createdAt: '2026-09-20T10:00:00Z', lastUsedAt: '2026-09-24T09:00:00Z', current: true },
    ]);

    expect(result).toHaveLength(1);
    http.verify();
  });

  it('revokeSession deletes the session by id', () => {
    const { auth, http } = setup();
    auth.revokeSession('s1').subscribe();

    const req = http.expectOne(`${base}/auth/sessions/s1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Session revoked' });
    http.verify();
  });

  it('logoutAll posts to the API and clears the local session', () => {
    const { auth, http } = setup();
    auth.setSession({
      id: 'u1',
      email: 'a@b.c',
      firstName: 'Ann',
      lastName: 'Bee',
      emailVerified: true,
      mfaEnabled: false,
      status: 'ACTIVE',
      roles: ['Customer'],
      permissions: [],
    });
    let message: string | undefined;
    auth.logoutAll().subscribe((r) => (message = r.message));

    http.expectOne(`${base}/auth/logout-all`).flush({ message: 'Logged out of all sessions' });

    expect(message).toBe('Logged out of all sessions');
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    http.verify();
  });

  it('resetPassword posts the token and new password to the API', () => {
    const { auth, http } = setup();
    let message: string | undefined;
    auth.resetPassword('tok-123', 'NewPassword123!').subscribe((r) => (message = r.message));

    const req = http.expectOne(`${base}/auth/password-reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok-123', newPassword: 'NewPassword123!' });
    req.flush({ message: 'Password updated successfully' });

    expect(message).toBe('Password updated successfully');
    http.verify();
  });

  it('verifyEmail posts the token to the verification endpoint', () => {
    const { auth, http } = setup();
    let message: string | undefined;
    auth.verifyEmail('verify-token-123').subscribe((r) => (message = r.message));

    const req = http.expectOne(`${base}/auth/email-verification`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'verify-token-123' });
    req.flush({ message: 'Email verified' });

    expect(message).toBe('Email verified');
    http.verify();
  });

  it('resendVerification posts only the email', () => {
    const { auth, http } = setup();
    auth.resendVerification('a@b.c').subscribe();

    const req = http.expectOne(`${base}/auth/email-verification-request`);
    expect(req.request.body).toEqual({ email: 'a@b.c' });
    req.flush({ message: 'If the email exists, a verification link has been sent' });
    http.verify();
  });
});

describe('AuthService (mock mode)', () => {
  it('performs no HTTP calls', () => {
    const { auth, http } = setup(false);
    auth.login('nobody@example.com', 'short').subscribe({ error: () => undefined });
    auth.logout();
    http.expectNone(`${base}/auth/login`);
    http.expectNone(`${base}/auth/logout`);
    http.verify();
  });

  it('session APIs use local demo data and perform no HTTP calls', () => {
    const { auth, http } = setup(false);
    auth.listSessions().subscribe();
    auth.revokeSession('mock-mobile').subscribe();
    auth.logoutAll().subscribe();
    http.expectNone(`${base}/auth/sessions`);
    http.expectNone(`${base}/auth/logout-all`);
    http.verify();
  });

  it('password reset performs no HTTP calls in mock mode', () => {
    const { auth, http } = setup(false);
    auth.requestPasswordReset('a@b.c').subscribe();
    auth.resetPassword('tok', 'NewPassword123!').subscribe();
    http.expectNone(`${base}/auth/password-reset-request`);
    http.expectNone(`${base}/auth/password-reset`);
    http.verify();
  });
});
