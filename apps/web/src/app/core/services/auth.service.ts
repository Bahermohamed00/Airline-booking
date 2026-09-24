import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, throwError, map, switchMap, tap } from 'rxjs';
import { DEMO_CUSTOMER, STAFF_USERS, PASSENGERS, ROLES } from '../mock/mock-data';
import { environment } from '../../../environments/environment';
import type { User, Passenger } from '../models/domain.model';

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface ApiTokenPair {
  accessToken: string;
  refreshToken: string;
}

interface ApiMe {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

const TOKEN_KEY = 'na-auth-token';
const USER_KEY = 'na-auth-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly useRealApi = environment.useRealApi;
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly userSignal = signal<User | null>(restoreUser());
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isStaff = computed(() => {
    const u = this.userSignal();
    return u !== null && u.roles.some((r) => r !== 'Customer');
  });

  /** Login against the real NestJS API when useRealApi is on, otherwise mock. */
  login(email: string, password: string): Observable<LoginResult> {
    if (this.useRealApi) {
      return this.http.post<ApiTokenPair>(`${this.baseUrl}/auth/login`, { email, password }).pipe(
        switchMap((tokens) =>
          this.http.get<ApiMe>(`${this.baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }).pipe(
            map((me) => ({
              user: apiUserToUser(me),
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            })),
          ),
        ),
        tap((result) => this.persistSession(result.user, result.accessToken)),
      );
    }

    const all = [DEMO_CUSTOMER, ...STAFF_USERS];
    const user = all.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const validPassword = password.length >= 8;
    if (!user || !validPassword) {
      return throwError(() => ({ status: 401, message: 'Invalid email or password.' })).pipe(delay(400));
    }
    return of({ user, accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }).pipe(
      delay(500),
      tap((result) => this.persistSession(result.user, result.accessToken)),
    );
  }

  register(input: { email: string; password: string; firstName: string; lastName: string }): Observable<User> {
    if (this.useRealApi) {
      return this.http
        .post<{ userId: string; email: string }>(`${this.baseUrl}/auth/register`, input)
        .pipe(map((r) => ({ ...input, id: r.userId, emailVerified: false, mfaEnabled: false, status: 'ACTIVE' as const, roles: ['Customer'], permissions: [] })));
    }
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

  setSession(user: User): void {
    this.persistSession(user, this.accessToken() ?? 'mock-access-token');
  }

  /** Mock-only helper: instantly become a demo staff role. Not available in real API mode. */
  loginAsRole(roleName: string): void {
    if (this.useRealApi) return;
    const role = ROLES.find((r) => r.name === roleName);
    const staff = STAFF_USERS.find((u) => u.roles.includes(roleName));
    if (staff) {
      this.persistSession({ ...staff, permissions: role?.permissions ?? [] }, 'mock-access-token');
    } else {
      this.persistSession({ ...DEMO_CUSTOMER }, 'mock-access-token');
    }
  }

  logout(): void {
    this.userSignal.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  accessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
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

  requestPasswordReset(email: string): Observable<{ message: string }> {
    if (this.useRealApi) {
      return this.http.post<{ message: string }>(`${this.baseUrl}/auth/password-reset-request`, { email });
    }
    return of({ message: 'If an account exists for that email, a reset link has been sent.' }).pipe(delay(600));
  }

  setupMfa(): Observable<{ secret: string; qrCodeUrl: string }> {
    if (this.useRealApi) {
      return this.http.post<{ secret: string; qrCodeUrl: string }>(`${this.baseUrl}/auth/mfa/setup`, {});
    }
    return of({ secret: 'NB2W4Z3FMU2G43TFOZSWKZLR', qrCodeUrl: 'otpauth://totp/NovaAir:demo?secret=NB2W4Z3FMU2G43TFOZSWKZLR' }).pipe(delay(400));
  }

  private persistSession(user: User, accessToken: string): void {
    this.userSignal.set(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
}

function apiUserToUser(me: ApiMe): User {
  return {
    id: me.userId,
    email: me.email,
    firstName: me.firstName,
    lastName: me.lastName,
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    roles: me.roles,
    permissions: me.permissions,
  };
}

function restoreUser(): User | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
