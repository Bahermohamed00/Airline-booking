import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CustomerShell } from './customer-shell.component';
import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../core/models/domain.model';

const customer: User = {
  id: 'u1',
  email: 'customer@example.com',
  firstName: 'Demo',
  lastName: 'Customer',
  emailVerified: true,
  mfaEnabled: false,
  status: 'ACTIVE',
  roles: ['Customer'],
  permissions: [],
};

async function setup(loggedIn: boolean): Promise<ComponentFixture<CustomerShell>> {
  await TestBed.configureTestingModule({
    imports: [CustomerShell],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isLoggedIn: () => loggedIn,
          user: () => (loggedIn ? customer : null),
          logout: vi.fn(),
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CustomerShell);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('CustomerShell navbar auth state', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows "Sign in" for a logged-out visitor', async () => {
    const fixture = await setup(false);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Sign in');
    expect(el.textContent).not.toContain('Demo Customer');
  });

  it('shows the authenticated user instead of "Sign in" after login', async () => {
    const fixture = await setup(true);
    const el = fixture.nativeElement as HTMLElement;
    const topbar = el.querySelector('.topbar') as HTMLElement;

    expect(topbar.textContent).toContain('Demo Customer');
    expect(topbar.querySelector('.nav__link--cta')).toBeNull();
  });
});
