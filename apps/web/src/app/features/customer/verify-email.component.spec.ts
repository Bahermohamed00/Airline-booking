import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { VerifyEmailPage } from './verify-email.component';
import { AuthService } from '../../core/services/auth.service';

interface AuthStub {
  verifyEmail: ReturnType<typeof vi.fn>;
  resendVerification: ReturnType<typeof vi.fn>;
}

async function setup(token: string | null, auth: AuthStub) {
  await TestBed.configureTestingModule({
    imports: [VerifyEmailPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      { provide: AuthService, useValue: auth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(VerifyEmailPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('VerifyEmailPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('verifies a valid token and shows success with a sign-in path', async () => {
    const auth: AuthStub = {
      verifyEmail: vi.fn().mockReturnValue(of({ message: 'Email verified' })),
      resendVerification: vi.fn(),
    };
    const fixture = await setup('valid-token-123', auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(auth.verifyEmail).toHaveBeenCalledWith('valid-token-123');
    expect(el.textContent).toContain('Email verified');
    expect(el.textContent).toContain('Sign in');
    expect(el.querySelector('form')).toBeNull(); // no resend form on success
  });

  it('shows the resend form without calling the API when the token is missing', async () => {
    const auth: AuthStub = { verifyEmail: vi.fn(), resendVerification: vi.fn() };
    const fixture = await setup(null, auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(auth.verifyEmail).not.toHaveBeenCalled();
    expect(el.querySelector('form')).not.toBeNull();
    expect(el.textContent).toContain('Resend verification link');
  });

  it('shows an error with resend on an invalid token, and resend confirms generically', async () => {
    const auth: AuthStub = {
      verifyEmail: vi.fn().mockReturnValue(throwError(() => ({ status: 400, message: 'Invalid or expired token' }))),
      resendVerification: vi.fn().mockReturnValue(of({ message: 'ok' })),
    };
    const fixture = await setup('dead-token', auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Invalid or expired token');
    expect(el.querySelector('form')).not.toBeNull();

    const input = el.querySelector<HTMLInputElement>('#email')!;
    input.value = 'someone@example.com';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.resendVerification).toHaveBeenCalledWith('someone@example.com');
    expect(el.textContent).toContain('If an account exists for that email');
  });

  it('never renders the token value', async () => {
    const auth: AuthStub = {
      verifyEmail: vi.fn().mockReturnValue(of({ message: 'Email verified' })),
      resendVerification: vi.fn(),
    };
    const fixture = await setup('super-secret-verify-token', auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('super-secret-verify-token');
    expect(el.innerHTML).not.toContain('super-secret-verify-token');
  });
});
