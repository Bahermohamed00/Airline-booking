import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import { DEMO_CUSTOMER, STAFF_USERS, PASSENGERS, ROLES } from '../mock/mock-data';
import type { User, Passenger } from '../models/domain.model';

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isStaff = computed(() => {
    const u = this.userSignal();
    return u !== null && u.roles.some((r) => r !== 'Customer');
  });

  /** Mock login — accepts the seeded demo credentials. */
  login(email: string, password: string): Observable<LoginResult> {
    const all = [DEMO_CUSTOMER, ...STAFF_USERS];
    const user = all.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const validPassword = password.length >= 8;
    if (!user || !validPassword) {
      return throwError(() => ({ status: 401, message: 'Invalid email or password.' })).pipe(delay(400));
    }
    return of({ user, accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }).pipe(delay(500));
  }

  register(input: { email: string; password: string; firstName: string; lastName: string }): Observable<User> {
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
    this.userSignal.set(user);
  }

  loginAsRole(roleName: string): void {
    const role = ROLES.find((r) => r.name === roleName);
    const staff = STAFF_USERS.find((u) => u.roles.includes(roleName));
    if (staff) {
      this.userSignal.set({ ...staff, permissions: role?.permissions ?? [] });
    } else {
      this.userSignal.set({ ...DEMO_CUSTOMER });
    }
  }

  logout(): void {
    this.userSignal.set(null);
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
    return of({ message: 'If an account exists for that email, a reset link has been sent.' }).pipe(delay(600));
  }

  setupMfa(): Observable<{ secret: string; qrCodeUrl: string }> {
    return of({ secret: 'NB2W4Z3FMU2G43TFOZSWKZLR', qrCodeUrl: 'otpauth://totp/NovaAir:demo?secret=NB2W4Z3FMU2G43TFOZSWKZLR' }).pipe(delay(400));
  }
}
