import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminLoginPage } from './admin-login.component';
import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../core/models/domain.model';

function makeUser(roles: string[]): User {
  return {
    id: 'u1',
    email: 'ops@example.com',
    firstName: 'Op',
    lastName: 'Staff',
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    roles,
    permissions: [],
  };
}

interface Mocks {
  auth: {
    login: ReturnType<typeof vi.fn>;
    setSession: ReturnType<typeof vi.fn>;
    isStaff: () => boolean;
    logout: ReturnType<typeof vi.fn>;
  };
}

async function setup(auth: Mocks['auth']) {
  await TestBed.configureTestingModule({
    imports: [AdminLoginPage],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  }).compileComponents();
}

async function renderAndSubmit() {
  const fixture = TestBed.createComponent(AdminLoginPage);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;

  const email = el.querySelector<HTMLInputElement>('#admin-email')!;
  const password = el.querySelector<HTMLInputElement>('#admin-password')!;
  email.value = 'ops@example.com';
  password.value = 'Password123!';
  email.dispatchEvent(new Event('input'));
  password.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AdminLoginPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders a credential form, not a role picker', async () => {
    await setup({ login: vi.fn(), setSession: vi.fn(), isStaff: () => false, logout: vi.fn() });
    const fixture = TestBed.createComponent(AdminLoginPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#admin-email')).not.toBeNull();
    expect(el.querySelector('#admin-password')).not.toBeNull();
    expect(el.querySelector('form')).not.toBeNull();
    expect(el.textContent).not.toContain('demo staff role');
  });

  it('signs staff in and navigates to the dashboard', async () => {
    const auth: Mocks['auth'] = {
      login: vi.fn().mockReturnValue(of({ user: makeUser(['Flight Manager']), accessToken: 't' })),
      setSession: vi.fn(),
      isStaff: () => true,
      logout: vi.fn(),
    };
    await setup(auth);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await renderAndSubmit();

    expect(auth.setSession).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin/dashboard');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('rejects non-staff accounts and drops the session', async () => {
    const auth: Mocks['auth'] = {
      login: vi.fn().mockReturnValue(of({ user: makeUser(['Customer']), accessToken: 't' })),
      setSession: vi.fn(),
      isStaff: () => false,
      logout: vi.fn(),
    };
    await setup(auth);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const el = await renderAndSubmit();

    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('restricted to staff accounts');
  });

  it('shows a server error on failed login', async () => {
    const auth: Mocks['auth'] = {
      login: vi.fn().mockReturnValue(throwError(() => ({ status: 401, message: 'Invalid credentials' }))),
      setSession: vi.fn(),
      isStaff: () => false,
      logout: vi.fn(),
    };
    await setup(auth);

    const el = await renderAndSubmit();

    expect(el.textContent).toContain('Invalid credentials');
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
