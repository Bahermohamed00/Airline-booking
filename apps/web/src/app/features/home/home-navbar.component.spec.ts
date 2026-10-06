import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeNavbar } from './home-navbar.component';
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

async function setup(loggedIn: boolean): Promise<ComponentFixture<HomeNavbar>> {
  await TestBed.configureTestingModule({
    imports: [HomeNavbar],
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

  const fixture = TestBed.createComponent(HomeNavbar);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('HomeNavbar auth state', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows "Sign in" linking to /login for a logged-out visitor', async () => {
    const fixture = await setup(false);
    const el = fixture.nativeElement as HTMLElement;

    const signin = el.querySelector<HTMLAnchorElement>('.nav__signin')!;
    expect(signin.textContent?.trim()).toBe('Sign in');
    expect(signin.getAttribute('href')).toBe('/login');
  });

  it('shows the authenticated user\'s first name linking to /profile instead of "Sign in"', async () => {
    const fixture = await setup(true);
    const el = fixture.nativeElement as HTMLElement;

    const link = el.querySelector<HTMLAnchorElement>('.nav__signin')!;
    expect(link.textContent?.trim()).toBe('Demo');
    expect(link.getAttribute('href')).toBe('/profile');
    expect(el.textContent).not.toContain('Sign in');
  });
});
