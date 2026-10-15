import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ProfilePage } from './profile.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { User } from '../../../core/models/domain.model';

const USER: User = {
  id: 'u1',
  email: 'pro@example.com',
  firstName: 'Pro',
  lastName: 'File',
  phone: '+49 170 1234567',
  streetAddress: 'Hauptstraße 12',
  nationalId: '29001011234567',
  dateOfBirth: '1990-01-01',
  emailVerified: true,
  mfaEnabled: false,
  status: 'ACTIVE',
  roles: ['Customer'],
  permissions: [],
};

interface Mocks {
  auth: Record<string, unknown>;
  toast: Record<'success' | 'error' | 'info' | 'warning', ReturnType<typeof vi.fn>>;
}

async function setup(
  section: 'profile' | 'security' | 'passengers',
  overrides: Record<string, unknown> = {},
): Promise<Mocks> {
  const userSignal = signal<User>({ ...USER });
  const auth: Record<string, unknown> = {
    user: userSignal.asReadonly(),
    savedPassengers: vi.fn().mockReturnValue(of([])),
    updateProfile: vi.fn().mockReturnValue(of(userSignal())),
    changePassword: vi.fn().mockReturnValue(of({ message: 'Password changed successfully' })),
    requestPasswordReset: vi.fn().mockReturnValue(of({ message: 'sent' })),
    setupMfa: vi.fn(),
    ...overrides,
  };
  const toast: Mocks['toast'] = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  await TestBed.configureTestingModule({
    imports: [ProfilePage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap(section === 'profile' ? {} : { section })) },
      },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();

  return { auth, toast };
}

async function render() {
  const fixture = TestBed.createComponent(ProfilePage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('ProfilePage — profile section', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the current user and keeps the email field disabled', async () => {
    await setup('profile');
    const el = (await render()).nativeElement as HTMLElement;

    expect(el.textContent).toContain('pro@example.com');
    expect(el.textContent).toContain("can't be changed");
    const emailInput = el.querySelector<HTMLInputElement>('#email')!;
    expect(emailInput.disabled).toBe(true);
  });

  it('saves only the allowed fields (no email) and confirms', async () => {
    const { auth, toast } = await setup('profile');
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    const updateProfile = auth['updateProfile'] as ReturnType<typeof vi.fn>;
    expect(updateProfile).toHaveBeenCalledWith({
      firstName: 'Pro',
      lastName: 'File',
      phone: '+49 170 1234567',
      streetAddress: 'Hauptstraße 12',
    });
    const call = updateProfile.mock.calls[0]![0] as Record<string, unknown>;
    expect('email' in call).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it('displays the national ID read-only and the date of birth without an edit control', async () => {
    await setup('profile');
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('29001011234567');
    expect(el.textContent).toContain('Date of birth');
    // Neither is part of the editable form.
    expect(el.querySelector('#nationalId')).toBeNull();
    expect(el.querySelector('#dateOfBirth')).toBeNull();
    expect('nationalId' in fixture.componentInstance.profileForm.controls).toBe(false);
    expect('dateOfBirth' in fixture.componentInstance.profileForm.controls).toBe(false);
  });

  it('shows "Not provided" for a legacy user without a national ID', async () => {
    const noId: User = { ...USER, nationalId: null };
    await setup('profile', { user: signal<User>(noId).asReadonly() });
    const el = (await render()).nativeElement as HTMLElement;

    expect(el.textContent).toContain('National ID: Not provided');
  });

  it('populates phone and street address from the loaded profile', async () => {
    await setup('profile');
    const fixture = await render();

    expect(fixture.componentInstance.profileForm.controls.phone.value).toBe('+49 170 1234567');
    expect(fixture.componentInstance.profileForm.controls.streetAddress.value).toBe(
      'Hauptstraße 12',
    );
  });

  it('rejects an invalid street address client-side without calling the API', async () => {
    const { auth } = await setup('profile');
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    const input = el.querySelector<HTMLInputElement>('#streetAddress')!;
    input.value = '!!!';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    expect(fixture.componentInstance.profileForm.controls.streetAddress.invalid).toBe(true);
    expect(auth['updateProfile']).not.toHaveBeenCalled();
  });

  it('shows an inline error when the update fails', async () => {
    await setup('profile', {
      updateProfile: vi
        .fn()
        .mockReturnValue(throwError(() => ({ status: 500, message: 'Server error' }))),
    });
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Server error');
  });
});

describe('ProfilePage — saved passengers section', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the empty state and no mock entries for an account with no saved passengers', async () => {
    const { auth } = await setup('passengers');
    const el = (await render()).nativeElement as HTMLElement;

    expect(el.textContent).toContain('No saved passengers');
    expect(el.querySelector('.pax-list')).toBeNull();
    // The mock fixtures (Lena/Jonas Hoffmann) must never appear.
    expect(el.textContent).not.toContain('Hoffmann');
    // The mock-backed service is no longer consulted by this page.
    expect(auth['savedPassengers']).not.toHaveBeenCalled();
  });
});

describe('ProfilePage — security section (change password)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function submitPasswordForm(
    fixture: Awaited<ReturnType<typeof render>>,
    current: string,
    next: string,
    confirm: string,
  ) {
    const el = fixture.nativeElement as HTMLElement;
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(id)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('#currentPassword', current);
    set('#newPassword', next);
    set('#confirmNewPassword', confirm);
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    return el;
  }

  it('blocks mismatched passwords client-side without calling the API', async () => {
    const { auth } = await setup('security');
    const fixture = await render();
    fixture.componentInstance.passwordForm.controls.confirmNewPassword.markAsTouched();
    const el = await submitPasswordForm(
      fixture,
      'OldPassword123!',
      'NewPassword123!',
      'Different123!',
    );

    expect(el.textContent).toContain('Passwords do not match');
    expect(auth['changePassword']).not.toHaveBeenCalled();
  });

  it('submits a valid change and confirms that other devices were signed out', async () => {
    const { auth, toast } = await setup('security');
    const fixture = await render();

    await submitPasswordForm(fixture, 'OldPassword123!', 'NewPassword123!', 'NewPassword123!');

    expect(auth['changePassword']).toHaveBeenCalledWith({
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Other devices'));
  });

  it('shows the server error inline (e.g. wrong current password)', async () => {
    await setup('security', {
      changePassword: vi
        .fn()
        .mockReturnValue(
          throwError(() => ({ status: 400, message: 'Current password is incorrect' })),
        ),
    });
    const fixture = await render();
    const el = await submitPasswordForm(
      fixture,
      'WrongPassword123!',
      'NewPassword123!',
      'NewPassword123!',
    );

    expect(el.textContent).toContain('Current password is incorrect');
  });
});
describe('ProfilePage — MFA email code enrollment', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function renderSecurity(overrides: Record<string, unknown>) {
    await setup('security', overrides);
    const fixture = await render();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('sends the enrollment code email and shows the code step — no QR, no secret', async () => {
    const setupMfa = vi.fn().mockReturnValue(of({ message: 'A 6-digit security code was sent.' }));
    const { fixture, el } = await renderSecurity({ setupMfa, verifyMfa: vi.fn() });

    fixture.componentInstance.startMfa();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setupMfa).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('6-digit security code');
    expect(el.querySelector('.qr img')).toBeNull();
    expect(el.querySelector('.qr__cell')).toBeNull();
    expect(el.textContent).not.toContain('authenticator app');
  });

  it('verifies the emailed code against the API and enables MFA', async () => {
    const setupMfa = vi.fn().mockReturnValue(of({ message: 'sent' }));
    const verifyMfa = vi.fn().mockReturnValue(of({ enabled: true }));
    const { fixture } = await renderSecurity({ setupMfa, verifyMfa });
    const c = fixture.componentInstance;

    c.startMfa();
    await fixture.whenStable();
    c.mfaCode.set('482910');
    c.verifyMfa();
    await fixture.whenStable();

    expect(verifyMfa).toHaveBeenCalledWith('482910');
    expect(c.mfaEnabled()).toBe(true);
    expect(c.mfaChallengeSent()).toBe(false);
    expect(c.mfaCode()).toBe('');
  });

  it('rejects a malformed code client-side without calling the API', async () => {
    const setupMfa = vi.fn().mockReturnValue(of({ message: 'sent' }));
    const verifyMfa = vi.fn();
    const { fixture } = await renderSecurity({ setupMfa, verifyMfa });
    const c = fixture.componentInstance;

    c.startMfa();
    await fixture.whenStable();
    c.mfaCode.set('123');
    c.verifyMfa();

    expect(verifyMfa).not.toHaveBeenCalled();
    expect(c.mfaError()).toContain('6-digit');
  });

  it('surfaces an API verification failure without enabling MFA', async () => {
    const setupMfa = vi.fn().mockReturnValue(of({ message: 'sent' }));
    const verifyMfa = vi.fn().mockReturnValue(throwError(() => ({ status: 400, message: 'Invalid or expired code' })));
    const { fixture, el } = await renderSecurity({ setupMfa, verifyMfa });
    const c = fixture.componentInstance;

    c.startMfa();
    await fixture.whenStable();
    c.mfaCode.set('482910');
    c.verifyMfa();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(c.mfaEnabled()).toBe(false);
    expect(c.mfaChallengeSent()).toBe(true); // stays on the code step
    expect(el.textContent).toContain('Invalid or expired code');
  });

  it('ignores repeat setup clicks while the code email is in flight (regression: superseded codes)', async () => {
    // The setup request stays pending: every issued code invalidates the
    // previous one, so a second click must not fire a second request.
    let complete!: () => void;
    const setupMfa = vi.fn().mockReturnValue(
      new Observable<{ message: string }>((sub) => {
        complete = () => { sub.next({ message: 'sent' }); sub.complete(); };
      }),
    );
    const { fixture } = await renderSecurity({ setupMfa, verifyMfa: vi.fn() });
    const c = fixture.componentInstance;

    c.startMfa();
    c.startMfa(); // second click while in flight — must be ignored
    expect(setupMfa).toHaveBeenCalledTimes(1);
    expect(c.mfaSetupLoading()).toBe(true);

    complete();
    await fixture.whenStable();
    expect(c.mfaSetupLoading()).toBe(false);
    expect(c.mfaChallengeSent()).toBe(true);
  });

  it('resend requests a fresh code and clears the entry', async () => {
    const setupMfa = vi.fn().mockReturnValue(of({ message: 'sent' }));
    const { fixture } = await renderSecurity({ setupMfa, verifyMfa: vi.fn() });
    const c = fixture.componentInstance;

    c.startMfa();
    await fixture.whenStable();
    c.mfaCode.set('482910');
    c.startMfa(); // resend
    await fixture.whenStable();

    expect(setupMfa).toHaveBeenCalledTimes(2);
    expect(c.mfaCode()).toBe('');
    expect(c.mfaChallengeSent()).toBe(true);
  });
});
