import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container help">
      <header class="help__head">
        <h1>Help &amp; Support</h1>
        <p class="na-text-muted">Quick answers and shortcuts to the most common travel tasks.</p>
      </header>
      <div class="help__grid">
        <section class="na-card help__card">
          <span class="help__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
              <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-6Z" />
              <path d="M13 5v14" stroke-dasharray="2 3" />
            </svg>
          </span>
          <h2>Manage your booking</h2>
          <p class="na-text-muted">Change seats, add baggage, or cancel an eligible booking.</p>
          <a routerLink="/bookings">Go to My Bookings</a>
        </section>
        <section class="na-card help__card">
          <span class="help__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
            </svg>
          </span>
          <h2>Online check-in</h2>
          <p class="na-text-muted">Check in from 24 hours until 1 hour before departure.</p>
          <a routerLink="/checkin">Start check-in</a>
        </section>
        <section class="na-card help__card">
          <span class="help__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
              <rect x="4" y="8" width="16" height="12" rx="2" />
              <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              <path d="M4 13h16" />
            </svg>
          </span>
          <h2>Baggage tracking</h2>
          <p class="na-text-muted">Follow your checked bags with your tag number.</p>
          <a routerLink="/baggage">Track baggage</a>
        </section>
        <section class="na-card help__card">
          <span class="help__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
              <path d="M3 12h5l2.5-7 4 14L17 12h4" />
            </svg>
          </span>
          <h2>Flight status</h2>
          <p class="na-text-muted">Live schedule, delay, and gate information.</p>
          <a routerLink="/status">Check status</a>
        </section>
      </div>
      <p class="help__note na-text-muted">NovaAir is an educational demo. No real flights, payments, or personal data are involved. Demo data is stored only in this browser session.</p>
    </div>
  `,
  styles: `
    .help { padding: var(--na-space-8) 0 var(--na-space-16); }
    .help__head { margin-bottom: var(--na-space-6); }
    .help__head p { margin-top: var(--na-space-2); }
    .help__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--na-space-4); }
    .help__card {
      padding: var(--na-space-6); display: flex; flex-direction: column; gap: var(--na-space-2);
      transition: transform var(--na-motion-base) var(--na-ease), box-shadow var(--na-motion-base) var(--na-ease);
    }
    .help__card:hover { transform: translateY(-2px); box-shadow: var(--na-shadow-md); }
    .help__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: var(--na-radius-md);
      background: var(--na-blue-100); color: var(--na-blue-600); margin-bottom: var(--na-space-2);
    }
    .help__icon svg { width: 22px; height: 22px; }
    .help__card h2 { font-size: var(--na-text-lg); }
    .help__card a { font-weight: var(--na-font-semibold); margin-top: auto; padding-top: var(--na-space-3); }
    .help__note { margin-top: var(--na-space-8); font-size: var(--na-text-sm); }
  `,
})
export class HelpPage {}
