import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NaThemeToggle } from '../../shared/ui/theme-toggle.component';

@Component({
  selector: 'app-customer-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NaThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand" aria-label="NovaAir home">
        <span class="brand__mark" aria-hidden="true">✈</span>
        <span class="brand__name">NovaAir</span>
      </a>
      <nav class="nav" aria-label="Main">
        <a routerLink="/search" routerLinkActive="nav__link--active" class="nav__link">Flight Search</a>
        <a routerLink="/offers" routerLinkActive="nav__link--active" class="nav__link">Offers</a>
        <a routerLink="/bookings" routerLinkActive="nav__link--active" class="nav__link">Manage Booking</a>
        <a routerLink="/checkin" routerLinkActive="nav__link--active" class="nav__link">Check-in</a>
        <a routerLink="/status" routerLinkActive="nav__link--active" class="nav__link">Flight Status</a>
        <a routerLink="/baggage" routerLinkActive="nav__link--active" class="nav__link">Baggage</a>
        <a routerLink="/loyalty" routerLinkActive="nav__link--active" class="nav__link">Loyalty</a>
      </nav>
      <div class="topbar__right">
        <na-theme-toggle />
        <a routerLink="/help" class="nav__link">Help</a>
        @if (auth.isLoggedIn()) {
          <div class="account">
            <button type="button" class="account__btn" (click)="accountOpen.set(!accountOpen())" [attr.aria-expanded]="accountOpen()">
              {{ auth.user()?.firstName }} {{ auth.user()?.lastName }}
            </button>
            @if (accountOpen()) {
              <div class="account__menu" role="menu">
                <a routerLink="/profile" role="menuitem" (click)="accountOpen.set(false)">Profile</a>
                <a routerLink="/profile/passengers" role="menuitem" (click)="accountOpen.set(false)">Saved passengers</a>
                <a routerLink="/profile/security" role="menuitem" (click)="accountOpen.set(false)">Security & MFA</a>
                <a routerLink="/profile/sessions" role="menuitem" (click)="accountOpen.set(false)">Sessions & devices</a>
                <a routerLink="/profile/notifications" role="menuitem" (click)="accountOpen.set(false)">Notification preferences</a>
                <button type="button" role="menuitem" (click)="signOut()">Sign out</button>
              </div>
            }
          </div>
        } @else {
          <a routerLink="/login" class="nav__link nav__link--cta">Sign in</a>
        }
      </div>
    </header>

    <main class="main">
      <router-outlet />
    </main>

    <footer class="footer">
      <p>NovaAir is an educational demo platform — not a real airline and not affiliated with Lufthansa. All flights, fares, and bookings are mock data.</p>
    </footer>

    <nav class="mobile-nav" aria-label="Mobile">
      <a routerLink="/search" routerLinkActive="mobile-nav__link--active" class="mobile-nav__link">Search</a>
      <a routerLink="/bookings" routerLinkActive="mobile-nav__link--active" class="mobile-nav__link">Bookings</a>
      <a routerLink="/checkin" routerLinkActive="mobile-nav__link--active" class="mobile-nav__link">Check-in</a>
      <a routerLink="/status" routerLinkActive="mobile-nav__link--active" class="mobile-nav__link">Status</a>
      <a routerLink="/profile" routerLinkActive="mobile-nav__link--active" class="mobile-nav__link">Account</a>
    </nav>
  `,
  styles: `
    .topbar {
      position: sticky; top: 0; z-index: 60;
      display: flex; align-items: center; gap: var(--na-space-6);
      height: var(--na-topbar-h); padding: 0 var(--na-space-6);
      background: var(--na-navy-800); color: var(--na-ink-900);
      border-bottom: 1px solid var(--na-border);
    }
    .brand { display: flex; align-items: center; gap: var(--na-space-2); color: var(--na-ink-900); font-family: var(--na-font-display); font-weight: var(--na-font-bold); font-size: var(--na-text-lg); }
    .brand:hover { text-decoration: none; }
    .brand__mark { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--na-cta); color: var(--na-cta-contrast); border-radius: var(--na-radius-md); font-size: 1rem; }
    .nav { display: flex; gap: var(--na-space-1); flex: 1; }
    .nav__link { color: var(--na-ink-100); padding: 0.5rem 0.75rem; border-radius: var(--na-radius-md); font-size: var(--na-text-sm); font-weight: var(--na-font-medium); white-space: nowrap; }
    .nav__link:hover { background: var(--na-navy-600); text-decoration: none; }
    .nav__link--active { background: var(--na-navy-600); color: var(--na-ink-900); }
    .nav__link--cta { background: var(--na-cta); color: var(--na-cta-contrast); font-weight: var(--na-font-semibold); }
    .nav__link--cta:hover { background: var(--na-cta-hover); }
    .topbar__right { display: flex; align-items: center; gap: var(--na-space-3); }
    .account { position: relative; }
    .account__btn { background: var(--na-navy-600); color: var(--na-ink-900); border: none; border-radius: var(--na-radius-md); padding: 0.5rem 0.9rem; font-weight: var(--na-font-medium); min-height: 40px; }
    .account__menu {
      position: absolute; right: 0; top: calc(100% + 6px); min-width: 220px;
      background: var(--na-surface-raised); border: 1px solid var(--na-border); border-radius: var(--na-radius-md);
      box-shadow: var(--na-shadow-md); padding: var(--na-space-2); display: flex; flex-direction: column; z-index: 70;
    }
    .account__menu a, .account__menu button {
      text-align: left; padding: var(--na-space-2) var(--na-space-3); border: none; background: none;
      color: var(--na-ink-900); border-radius: var(--na-radius-sm); font-size: var(--na-text-sm); min-height: 40px;
    }
    .account__menu a:hover, .account__menu button:hover { background: var(--na-blue-100); text-decoration: none; }
    .main { min-height: calc(100vh - var(--na-topbar-h) - 60px); padding-bottom: var(--na-space-16); }
    .footer { background: var(--na-navy-800); color: var(--na-ink-300); font-size: var(--na-text-xs); text-align: center; padding: var(--na-space-6); }
    .mobile-nav { display: none; }
    @media (max-width: 900px) {
      .nav { display: none; }
      .topbar { padding: 0 var(--na-space-4); gap: var(--na-space-3); }
      .topbar__right { margin-left: auto; }
      .mobile-nav {
        display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
        background: var(--na-navy-800); border-top: 1px solid var(--na-navy-600);
      }
      .mobile-nav__link { flex: 1; color: var(--na-ink-100); text-align: center; padding: var(--na-space-3) 0 calc(var(--na-space-3) + env(safe-area-inset-bottom)); font-size: var(--na-text-xs); font-weight: var(--na-font-medium); }
      .mobile-nav__link--active { color: var(--na-ink-900); background: var(--na-navy-600); }
      .main { padding-bottom: calc(var(--na-space-16) + 64px); }
    }
    @media (max-width: 420px) {
      .topbar { gap: var(--na-space-2); padding: 0 var(--na-space-3); }
      // Help stays reachable via the footer; keep the bar inside 320px viewports.
      .topbar__right > .nav__link:not(.nav__link--cta) { display: none; }
      .account__btn { max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
  `,
})
export class CustomerShell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly accountOpen = signal(false);

  signOut(): void {
    this.accountOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
