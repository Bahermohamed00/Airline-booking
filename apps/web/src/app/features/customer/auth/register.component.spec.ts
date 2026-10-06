import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
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
    });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
