import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container help">
      <h1>Help &amp; Support</h1>
      <div class="help__grid">
        <section class="na-card help__card">
          <h3>Manage your booking</h3>
          <p class="na-text-muted">Change seats, add baggage, or cancel an eligible booking.</p>
          <a routerLink="/bookings">Go to My Bookings</a>
        </section>
        <section class="na-card help__card">
          <h3>Online check-in</h3>
          <p class="na-text-muted">Check in from 24 hours until 1 hour before departure.</p>
          <a routerLink="/checkin">Start check-in</a>
        </section>
        <section class="na-card help__card">
          <h3>Baggage tracking</h3>
          <p class="na-text-muted">Follow your checked bags with your tag number.</p>
          <a routerLink="/baggage">Track baggage</a>
        </section>
        <section class="na-card help__card">
          <h3>Flight status</h3>
          <p class="na-text-muted">Live schedule, delay, and gate information.</p>
          <a routerLink="/status">Check status</a>
        </section>
      </div>
      <p class="help__note na-text-muted">NovaAir is an educational demo. No real flights, payments, or personal data are involved. Demo data is stored only in this browser session.</p>
    </div>
  `,
  styles: `
    .help { padding-top: var(--na-space-10); }
    .help h1 { margin-bottom: var(--na-space-6); }
    .help__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--na-space-4); }
    .help__card { padding: var(--na-space-5); display: flex; flex-direction: column; gap: var(--na-space-2); }
    .help__card a { font-weight: var(--na-font-semibold); margin-top: auto; }
    .help__note { margin-top: var(--na-space-8); font-size: var(--na-text-sm); }
  `,
})
export class HelpPage {}
