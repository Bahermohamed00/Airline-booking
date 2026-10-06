import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import type { User } from '../../../core/models/domain.model';

function makeUser(roles: string[]): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    roles,
    permissions: [],
  };
}

interface AuthMock {
  login: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  isStaff: () => boolean;
  logout: ReturnType<typeof vi.fn>;
}

async function setup(reason: string | null, auth?: AuthMock) {
  await TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(reason ? { reason } : {}) } },
      },
      {
        provide: AuthService,
        useValue: auth ?? { login: vi.fn(), setSession: vi.fn(), isStaff: () => false, logout: vi.fn() },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function renderAndSubmit() {
  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;

  const email = el.querySelector<HTMLInputElement>('#email')!;
  const password = el.querySelector<HTMLInputElement>('#password')!;
  email.value = 'user@example.com';
  password.value = 'Password123!';
  email.dispatchEvent(new Event('input'));
  password.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('LoginPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows a session-expired notice when redirected with reason=session-expired', async () => {
    const fixture = await setup('session-expired');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Your session has expired');
  });

  it('shows no notice on a plain visit', async () => {
    const fixture = await setup(null);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Your session has expired');
  });

  it('signs a customer in and navigates to bookings', async () => {
    const auth: AuthMock = {
      login: vi.fn().mockReturnValue(of({ user: makeUser(['Customer']), accessToken: 't' })),
      setSession: vi.fn(),
      isStaff: () => false,
      logout: vi.fn(),
    };
    await setup(null, auth);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await renderAndSubmit();

    expect(auth.setSession).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/bookings');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('rejects staff/admin accounts and drops the session', async () => {
    const auth: AuthMock = {
      login: vi.fn().mockReturnValue(of({ user: makeUser(['Super Admin']), accessToken: 't' })),
      setSession: vi.fn(),
      isStaff: () => true,
      logout: vi.fn(),
    };
    await setup(null, auth);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const el = await renderAndSubmit();

    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('staff account');
  });

  it('shows a server error on failed login', async () => {
    const auth: AuthMock = {
      login: vi.fn().mockReturnValue(throwError(() => ({ status: 401, message: 'Invalid email or password.' }))),
      setSession: vi.fn(),
      isStaff: () => false,
      logout: vi.fn(),
    };
    await setup(null, auth);

    const el = await renderAndSubmit();

    expect(el.textContent).toContain('Invalid email or password.');
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
