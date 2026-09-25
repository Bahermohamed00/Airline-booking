import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, delay, throwError, map, catchError, switchMap, tap, finalize, shareReplay } from 'rxjs';
import { DEMO_CUSTOMER, STAFF_USERS, PASSENGERS } from '../mock/mock-data';
import type { User, Passenger, SessionInfo } from '../models/domain.model';
import { API_CONFIG, type ApiConfig } from '../config/api-config';

export interface LoginResult {
  user: User;
  accessToken: string;
}

export interface AuthError {
  status: number;
  message: string;
  code?: string;
}

interface LoginResponse {
  accessToken?: string;
  expiresIn?: number;
  mfaRequired?: boolean;
}

interface MeResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  private readonly userSignal = signal<User | null>(null);
  // Access token lives only in memory; the refresh token is an httpOnly cookie
  // the browser holds and JavaScript can never read (ADR-0001).
  private readonly accessTokenSignal = signal<string | null>(null);
  private refreshInFlight: Observable<string> | null = null;
  // Incremented on every session clear; a late refresh response from before a
  // logout must not resurrect the session.
  private sessionEpoch = 0;

  readonly user = this.userSignal.asReadonly();
  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isStaff = computed(() => {
    const u = this.userSignal();
    return u !== null && u.roles.some((r) => r !== 'Customer');
  });

  /** Mock login — accepts the seeded demo credentials. */
  login(email: string, password: string): Observable<LoginResult> {
    if (!this.config.useRealApi) {
      const all = [DEMO_CUSTOMER, ...STAFF_USERS];
      const user = all.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const validPassword = password.length >= 8;
      if (!user || !validPassword) {
        return throwError((): AuthError => ({ status: 401, message: 'Invalid email or password.' })).pipe(delay(400));
      }
      return of({ user, accessToken: 'mock-access-token' }).pipe(delay(500));
    }

    return this.http.post<LoginResponse>(`${this.config.baseUrl}/auth/login`, { email, password }).pipe(
      switchMap((res) => {
        if (res.mfaRequired || !res.accessToken) {
          return throwError((): AuthError => ({
            status: 401,
            message: 'This account requires multi-factor authentication.',
            code: 'MFA_REQUIRED',
          }));
        }
        const accessToken = res.accessToken;
        this.accessTokenSignal.set(accessToken);
        return this.fetchMe().pipe(map((user): LoginResult => ({ user, accessToken })));
      }),
      catchError((err) => throwError(() => this.toAuthError(err))),
    );
  }

  register(input: { email: string; password: string; firstName: string; lastName: string }): Observable<User> {
    if (!this.config.useRealApi) {
      const user: User = {
        id: crypto.randomUUID(),
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        emailVerified: false,
        mfaEnabled: false,
        status: 'ACTIVE',
        roles: ['Customer'],
        permissions: [],
      };
      return of(user).pipe(delay(500));
    }

    return this.http.post<{ userId: string; email: string }>(`${this.config.baseUrl}/auth/register`, input).pipe(
      map(
        (res): User => ({
          id: res.userId,
          email: res.email,
          firstName: input.firstName,
          lastName: input.lastName,
          emailVerified: false,
          mfaEnabled: false,
          status: 'ACTIVE',
          roles: ['Customer'],
          permissions: [],
        }),
      ),
      catchError((err) => throwError(() => this.toAuthError(err))),
    );
  }

  /** Restore the session after a page reload via the refresh cookie (silent refresh). */
  restoreSession(): Observable<void> {
    if (!this.config.useRealApi) return of(undefined);
    return this.refreshAccessToken().pipe(
      switchMap(() => this.fetchMe()),
      tap((user) => this.userSignal.set(user)),
      map(() => undefined),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
    );
  }

  /** Single-flight refresh: concurrent callers share one POST /auth/refresh. */
  refreshAccessToken(): Observable<string> {
    const epoch = this.sessionEpoch;
    this.refreshInFlight ??= this.http
      .post<{ accessToken: string; expiresIn: number }>(`${this.config.baseUrl}/auth/refresh`, {})
      .pipe(
        map((res) => res.accessToken),
        tap((token) => {
          if (epoch === this.sessionEpoch) this.accessTokenSignal.set(token);
        }),
        catchError((err: unknown) => {
          // A stale refresh (started before a logout) must not kill a newer session.
          if (epoch === this.sessionEpoch) this.clearSession();
          return throwError(() => this.toAuthError(err));
        }),
        // Clear the in-flight slot when the source terminates, then replay the
        // buffered result to the current subscribers.
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  logout(): void {
    if (this.config.useRealApi) {
      this.http.post(`${this.config.baseUrl}/auth/logout`, {}).subscribe({ error: () => undefined });
    }
    this.clearSession();
  }

  /** Lists the current user's active sessions (device metadata only — never tokens). */
  listSessions(): Observable<SessionInfo[]> {
    if (!this.config.useRealApi) {
      // Development-only demo data (documentation IPs, RFC 5737)
      const now = Date.now();
      const iso = (ms: number): string => new Date(ms).toISOString();
      return of<SessionInfo[]>([
        { id: 'mock-current', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', ipAddress: '203.0.113.10', createdAt: iso(now - 3_600_000), lastUsedAt: iso(now), current: true },
        { id: 'mock-mobile', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', ipAddress: '203.0.113.11', createdAt: iso(now - 3 * 86_400_000), lastUsedAt: iso(now - 86_400_000), current: false },
      ]).pipe(delay(400));
    }
    return this.http
      .get<SessionInfo[]>(`${this.config.baseUrl}/auth/sessions`)
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  /** Revokes one session; the backend re-checks ownership server-side. */
  revokeSession(sessionId: string): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      return of({ message: 'Session revoked' }).pipe(delay(300));
    }
    return this.http
      .delete<{ message: string }>(`${this.config.baseUrl}/auth/sessions/${sessionId}`)
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  /** Revokes every session including this one; on success the local session is cleared. */
  logoutAll(): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      this.clearSession();
      return of({ message: 'Logged out of all sessions' }).pipe(delay(300));
    }
    return this.http.post<{ message: string }>(`${this.config.baseUrl}/auth/logout-all`, {}).pipe(
      tap(() => this.clearSession()),
      catchError((err) => throwError(() => this.toAuthError(err))),
    );
  }

  setSession(user: User): void {
    this.userSignal.set(user);
  }

  hasPermission(permission: string): boolean {
    const u = this.userSignal();
    if (!u) return false;
    if (u.permissions.includes('super_admin')) return true;
    return u.permissions.includes(permission);
  }

  savedPassengers(): Observable<Passenger[]> {
    return of(PASSENGERS).pipe(delay(200));
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      return of({ message: 'Email verified.' }).pipe(delay(300));
    }
    return this.http
      .post<{ message: string }>(`${this.config.baseUrl}/auth/email-verification`, { token })
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  resendVerification(email: string): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      return of({ message: 'If an account exists for that email, a verification link has been sent.' }).pipe(delay(300));
    }
    return this.http
      .post<{ message: string }>(`${this.config.baseUrl}/auth/email-verification-request`, { email })
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  /** Updates the caller's own profile (name/phone only — email change is not supported). */
  updateProfile(input: { firstName: string; lastName: string; phone?: string }): Observable<User> {
    if (!this.config.useRealApi) {
      const updated = { ...this.userSignal()!, ...input };
      this.userSignal.set(updated);
      return of(updated).pipe(delay(300));
    }
    return this.http.patch(`${this.config.baseUrl}/auth/me`, input).pipe(
      switchMap(() => this.fetchMe()),
      tap((user) => this.userSignal.set(user)),
      catchError((err) => throwError(() => this.toAuthError(err))),
    );
  }

  /** Changes the caller's password. The current session survives; all others are revoked. */
  changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      return of({ message: 'Password changed successfully' }).pipe(delay(400));
    }
    return this.http
      .post<{ message: string }>(`${this.config.baseUrl}/auth/change-password`, input)
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      return of({ message: 'If an account exists for that email, a reset link has been sent.' }).pipe(delay(600));
    }
    return this.http
      .post<{ message: string }>(`${this.config.baseUrl}/auth/password-reset-request`, { email })
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  /** Confirms a password reset with the emailed token. The token is used once and never stored client-side. */
  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    if (!this.config.useRealApi) {
      return of({ message: 'Password updated successfully' }).pipe(delay(400));
    }
    return this.http
      .post<{ message: string }>(`${this.config.baseUrl}/auth/password-reset`, { token, newPassword })
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  setupMfa(): Observable<{ secret: string; qrCodeUrl: string }> {
    if (!this.config.useRealApi) {
      return of({ secret: 'NB2W4Z3FMU2G43TFOZSWKZLR', qrCodeUrl: 'otpauth://totp/NovaAir:demo?secret=NB2W4Z3FMU2G43TFOZSWKZLR' }).pipe(delay(400));
    }
    return this.http
      .post<{ secret: string; qrCodeUrl: string }>(`${this.config.baseUrl}/auth/mfa/setup`, {})
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  private fetchMe(): Observable<User> {
    return this.http.get<MeResponse>(`${this.config.baseUrl}/auth/me`).pipe(
      map(
        (me): User => ({
          id: me.userId,
          email: me.email,
          firstName: me.firstName,
          lastName: me.lastName,
          emailVerified: me.emailVerified,
          mfaEnabled: me.mfaEnabled,
          status: 'ACTIVE',
          roles: me.roles,
          permissions: me.permissions,
        }),
      ),
    );
  }

  private clearSession(): void {
    this.sessionEpoch += 1;
    this.accessTokenSignal.set(null);
    this.userSignal.set(null);
  }

  private toAuthError(err: unknown): AuthError {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string | string[] } | undefined;
      const message = Array.isArray(body?.message)
        ? body.message.join(' ')
        : (body?.message ?? 'Request failed. Please try again.');
      return { status: err.status, message };
    }
    if (err && typeof err === 'object' && 'message' in err) {
      return err as AuthError;
    }
    return { status: 0, message: 'Network error. Please try again.' };
  }
}
