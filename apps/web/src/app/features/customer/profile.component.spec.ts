import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ProfilePage } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { User } from '../../core/models/domain.model';

const USER: User = {
  id: 'u1',
  email: 'pro@example.com',
  firstName: 'Pro',
  lastName: 'File',
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

async function setup(section: 'profile' | 'security', overrides: Record<string, unknown> = {}): Promise<Mocks> {
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
  const toast: Mocks['toast'] = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ProfilePage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(section === 'profile' ? {} : { section })) } },
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

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const updateProfile = auth['updateProfile'] as ReturnType<typeof vi.fn>;
    expect(updateProfile).toHaveBeenCalledWith({ firstName: 'Pro', lastName: 'File', phone: '' });
    const call = updateProfile.mock.calls[0]![0] as Record<string, unknown>;
    expect('email' in call).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows an inline error when the update fails', async () => {
    await setup('profile', {
      updateProfile: vi.fn().mockReturnValue(throwError(() => ({ status: 500, message: 'Server error' }))),
    });
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Server error');
  });
});

describe('ProfilePage — security section (change password)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function submitPasswordForm(fixture: Awaited<ReturnType<typeof render>>, current: string, next: string, confirm: string) {
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
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    return el;
  }

  it('blocks mismatched passwords client-side without calling the API', async () => {
    const { auth } = await setup('security');
    const fixture = await render();
    fixture.componentInstance.passwordForm.controls.confirmNewPassword.markAsTouched();
    const el = await submitPasswordForm(fixture, 'OldPassword123!', 'NewPassword123!', 'Different123!');

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
      changePassword: vi.fn().mockReturnValue(throwError(() => ({ status: 400, message: 'Current password is incorrect' }))),
    });
    const fixture = await render();
    const el = await submitPasswordForm(fixture, 'WrongPassword123!', 'NewPassword123!', 'NewPassword123!');

    expect(el.textContent).toContain('Current password is incorrect');
  });
});
