import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ForgotPasswordPage } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

async function setup(requestPasswordReset: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [ForgotPasswordPage],
    providers: [provideRouter([]), { provide: AuthService, useValue: { requestPasswordReset } }],
  }).compileComponents();

  const fixture = TestBed.createComponent(ForgotPasswordPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function submitWithEmail(el: HTMLElement, email: string): Promise<void> {
  const input = el.querySelector<HTMLInputElement>('#email')!;
  input.value = email;
  input.dispatchEvent(new Event('input'));
  el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('submits a valid email and always shows the same generic success message', async () => {
    const requestPasswordReset = vi.fn().mockReturnValue(of({ message: 'If an account exists...' }));
    const fixture = await setup(requestPasswordReset);
    const el = fixture.nativeElement as HTMLElement;

    await submitWithEmail(el, 'someone@example.com');
    fixture.detectChanges();

    expect(requestPasswordReset).toHaveBeenCalledWith('someone@example.com');
    expect(el.textContent).toContain('If an account exists for that email');
    expect(el.querySelector('form')).toBeNull(); // form replaced by the success state
    expect(el.textContent).toContain('Back to sign in');
  });

  it('keeps the submit button disabled for invalid emails', async () => {
    const requestPasswordReset = vi.fn().mockReturnValue(of({}));
    const fixture = await setup(requestPasswordReset);
    const el = fixture.nativeElement as HTMLElement;

    const input = el.querySelector<HTMLInputElement>('#email')!;
    input.value = 'not-an-email';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.querySelector<HTMLButtonElement>('na-button button')!.disabled).toBe(true);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows a server error and keeps the form on failure', async () => {
    const requestPasswordReset = vi.fn().mockReturnValue(throwError(() => ({ status: 0, message: 'Network error. Please try again.' })));
    const fixture = await setup(requestPasswordReset);
    const el = fixture.nativeElement as HTMLElement;

    await submitWithEmail(el, 'someone@example.com');
    fixture.detectChanges();

    expect(el.textContent).toContain('Network error');
    expect(el.querySelector('form')).not.toBeNull(); // user can retry
  });
});
