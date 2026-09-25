import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ResetPasswordPage } from './reset-password.component';
import { AuthService } from '../../core/services/auth.service';

async function setup(token: string | null, resetPassword: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [ResetPasswordPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      { provide: AuthService, useValue: { resetPassword } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ResetPasswordPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function fillAndSubmit(fixture: Awaited<ReturnType<typeof setup>>, pw: string, confirm: string) {
  const el = fixture.nativeElement as HTMLElement;
  const newPassword = el.querySelector<HTMLInputElement>('#newPassword')!;
  const confirmInput = el.querySelector<HTMLInputElement>('#confirmPassword')!;
  newPassword.value = pw;
  confirmInput.value = confirm;
  newPassword.dispatchEvent(new Event('input'));
  confirmInput.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('ResetPasswordPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the invalid-link state when the token is missing', async () => {
    const resetPassword = vi.fn();
    const fixture = await setup(null, resetPassword);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('missing its reset token');
    expect(el.textContent).toContain('Request a new link');
    expect(el.querySelector('form')).toBeNull();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('blocks mismatched passwords client-side without calling the API', async () => {
    const resetPassword = vi.fn();
    const fixture = await setup('tok-abc', resetPassword);
    fixture.componentInstance.form.controls.confirmPassword.markAsTouched();
    const el = await fillAndSubmit(fixture, 'NewPassword123!', 'Different123!');

    expect(el.textContent).toContain('Passwords do not match');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('submits a valid new password and shows success with a sign-in link', async () => {
    const resetPassword = vi.fn().mockReturnValue(of({ message: 'Password updated successfully' }));
    const fixture = await setup('tok-abc', resetPassword);
    const el = await fillAndSubmit(fixture, 'NewPassword123!', 'NewPassword123!');

    expect(resetPassword).toHaveBeenCalledWith('tok-abc', 'NewPassword123!');
    expect(el.textContent).toContain('Password updated');
    expect(el.textContent).toContain('Sign in');
    expect(el.querySelector('form')).toBeNull();
  });

  it('shows an invalid/expired message with a request-new-link path on API 400', async () => {
    const resetPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 400, message: 'Invalid or expired token' })));
    const fixture = await setup('tok-abc', resetPassword);
    const el = await fillAndSubmit(fixture, 'NewPassword123!', 'NewPassword123!');

    expect(el.textContent).toContain('invalid or has expired');
    expect(el.textContent).toContain('Request a new');
    expect(el.querySelector('form')).not.toBeNull(); // retry possible
  });

  it('shows the server validation message on a 400 that is not a token failure', async () => {
    const resetPassword = vi
      .fn()
      .mockReturnValue(throwError(() => ({ status: 400, message: 'newPassword must be longer than or equal to 12 characters' })));
    const fixture = await setup('tok-abc', resetPassword);
    const el = await fillAndSubmit(fixture, 'NewPassword123!', 'NewPassword123!');

    expect(el.textContent).toContain('must be longer than or equal to 12 characters');
    expect(el.textContent).not.toContain('invalid or has expired');
  });

  it('never renders the token value', async () => {
    const resetPassword = vi.fn().mockReturnValue(of({ message: 'ok' }));
    const fixture = await setup('super-secret-token-value', resetPassword);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('super-secret-token-value');
    expect(el.innerHTML).not.toContain('super-secret-token-value');
  });
});
