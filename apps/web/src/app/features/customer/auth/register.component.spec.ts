import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterPage } from './register.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { User } from '../../../core/models/domain.model';

const registeredUser: User = {
  id: 'u1',
  email: 'new@example.com',
  firstName: 'New',
  lastName: 'User',
  dateOfBirth: '2000-05-17',
  emailVerified: false,
  mfaEnabled: false,
  status: 'PENDING_VERIFICATION',
  roles: ['Customer'],
  permissions: [],
};

function mocks() {
  return {
    auth: { register: vi.fn().mockReturnValue(of(registeredUser)) },
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<RegisterPage>> {
  await TestBed.configureTestingModule({
    imports: [RegisterPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RegisterPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function settle(fixture: ComponentFixture<RegisterPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

/** ISO date exactly `years` ago today — mirrors the backend age rule. */
function isoYearsAgo(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function fillValidForm(el: HTMLElement): void {
  setInput(el, '#firstName', 'New');
  setInput(el, '#lastName', 'User');
  setInput(el, '#dateOfBirth', '2000-05-17');
  setInput(el, '#phone', '+49 170 1234567');
  setInput(el, '#streetAddress', 'Hauptstraße 12');
  setInput(el, '#nationalId', '28501010123456');
  setInput(el, '#email', 'new@example.com');
  setInput(el, '#password', 'Password123!');
  setInput(el, '#confirmPassword', 'Password123!');
}

describe('RegisterPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows a clear message and blocks submission when the customer is under 18', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#dateOfBirth', isoYearsAgo(17));
    el.querySelector<HTMLInputElement>('#dateOfBirth')!.dispatchEvent(new Event('blur'));
    await settle(fixture);

    expect(fixture.componentInstance.form.invalid).toBe(true);
    expect(el.textContent).toContain('at least 18 years old');

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle(fixture);
    expect(m.auth.register).not.toHaveBeenCalled();
  });

  it('accepts a customer who turns exactly 18 today', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#dateOfBirth', isoYearsAgo(18));
    await settle(fixture);

    expect(fixture.componentInstance.form.controls.dateOfBirth.valid).toBe(true);
  });

  it('submits the registration with dateOfBirth through the auth service', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fillValidForm(el);
    await settle(fixture);
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle(fixture);

    expect(m.auth.register).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      dateOfBirth: '2000-05-17',
      phone: '+49 170 1234567',
      streetAddress: 'Hauptstraße 12',
      nationalId: '28501010123456',
    });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows "Please enter your national ID." after an empty national ID field is touched', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#nationalId', '');
    el.querySelector<HTMLInputElement>('#nationalId')!.dispatchEvent(new Event('blur'));
    await settle(fixture);

    expect(fixture.componentInstance.form.controls.nationalId.invalid).toBe(true);
    expect(el.textContent).toContain('Please enter your national ID.');
  });

  it('shows "National ID must be exactly 14 digits." for malformed IDs and blocks submission', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    for (const invalid of ['2850101012345', '285010101234567', '2850101012345A']) {
      fillValidForm(el);
      setInput(el, '#nationalId', invalid);
      el.querySelector<HTMLInputElement>('#nationalId')!.dispatchEvent(new Event('blur'));
      await settle(fixture);

      expect(fixture.componentInstance.form.controls.nationalId.invalid).toBe(true);
      expect(el.textContent).toContain('National ID must be exactly 14 digits.');

      el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await settle(fixture);
      expect(m.auth.register).not.toHaveBeenCalled();
    }
  });

  it('shows no validation errors on first load', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.na-error')).toBeNull();
  });

  it('shows "Please enter your mobile number." after an empty mobile field is touched', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#phone', '');
    el.querySelector<HTMLInputElement>('#phone')!.dispatchEvent(new Event('blur'));
    await settle(fixture);

    expect(fixture.componentInstance.form.controls.phone.invalid).toBe(true);
    expect(el.textContent).toContain('Please enter your mobile number.');
  });

  it('shows "Invalid mobile number." for a malformed mobile and blocks submission', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#phone', 'not-a-phone');
    el.querySelector<HTMLInputElement>('#phone')!.dispatchEvent(new Event('blur'));
    await settle(fixture);

    expect(fixture.componentInstance.form.controls.phone.invalid).toBe(true);
    expect(el.textContent).toContain('Invalid mobile number.');

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle(fixture);
    expect(m.auth.register).not.toHaveBeenCalled();
  });

  it('shows "Please enter your street address." after an empty address field is touched', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#streetAddress', '');
    el.querySelector<HTMLInputElement>('#streetAddress')!.dispatchEvent(new Event('blur'));
    await settle(fixture);

    expect(fixture.componentInstance.form.controls.streetAddress.invalid).toBe(true);
    expect(el.textContent).toContain('Please enter your street address.');
  });

  it('shows "Invalid street address." for a malformed address and blocks submission', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    setInput(el, '#streetAddress', '!!!');
    el.querySelector<HTMLInputElement>('#streetAddress')!.dispatchEvent(new Event('blur'));
    await settle(fixture);

    expect(fixture.componentInstance.form.controls.streetAddress.invalid).toBe(true);
    expect(el.textContent).toContain('Invalid street address.');

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle(fixture);
    expect(m.auth.register).not.toHaveBeenCalled();
  });

  it('maps API 400 validation messages onto the matching fields instead of a generic banner', async () => {
    const m = mocks();
    m.auth.register.mockReturnValue(
      throwError(() => ({
        status: 400,
        message: 'Invalid mobile number. Invalid street address.',
        messages: ['Invalid mobile number.', 'Invalid street address.'],
      })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    fillValidForm(el);
    await settle(fixture);
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle(fixture);

    const component = fixture.componentInstance;
    expect(component.error()).toBeNull();
    expect(component.form.controls.phone.errors?.['server']).toBe('Invalid mobile number.');
    expect(component.form.controls.streetAddress.errors?.['server']).toBe(
      'Invalid street address.',
    );
    expect(el.textContent).toContain('Invalid mobile number.');
    expect(el.textContent).toContain('Invalid street address.');
  });
});
