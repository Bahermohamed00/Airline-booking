import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingService } from '../../core/services/booking.service';
import { CheckInService } from '../../core/services/domain-services';
import { AuthService } from '../../core/services/auth.service';
import { BOOKING_STATUS_MAP, statusLabel } from '../../core/status-maps';
import type { Booking } from '../../core/models/domain.model';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';
import { NaRouteLine } from '../../shared/ui/route-line.component';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaEmptyState, NaRouteLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="hero">
        <h1>Check in for your flight</h1>
        <p class="hero__sub">Save time at the airport — check in online and walk straight to security.</p>
      </header>

      <div class="layout">
        <section class="na-card lookup" aria-labelledby="lookup-h">
          <h2 id="lookup-h">Find a booking</h2>
          <p class="lookup__sub">Enter your booking reference and contact email to retrieve your trip.</p>
          @if (lookupError()) {
            <na-alert tone="danger" title="Check-in lookup failed" dismissible (dismissed)="lookupError.set(null)">{{ lookupError() }}</na-alert>
          }
          <form [formGroup]="form" (ngSubmit)="lookup()">
            <div class="na-field">
              <label class="na-label" for="reference">Booking reference</label>
              <input id="reference" class="na-input na-text-mono" type="text" formControlName="reference" placeholder="e.g. NVA7K2" autocomplete="off" />
            </div>
            <div class="na-field">
              <label class="na-label" for="email">Contact email</label>
              <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" aria-describedby="email-hint" />
              <p class="na-hint" id="email-hint">The email address you used when booking.</p>
            </div>
            <na-button variant="cta" size="lg" type="submit" [loading]="lookupLoading()" [disabled]="form.invalid">Find booking</na-button>
          </form>
        </section>

        @if (isLoggedIn()) {
          <section class="na-card mine" aria-labelledby="eligible-h">
            <h2 id="eligible-h" class="mine__title">Your bookings</h2>
            @if (listError()) {
              <na-alert tone="danger" title="Could not load bookings" retryable (retry)="loadMine()">Please try again.</na-alert>
            } @else if (listLoading()) {
              <div class="mine__skel" role="status" aria-label="Loading your bookings">
                @for (i of [1, 2]; track i) {
                  <div class="mine__skelrow" aria-hidden="true">
                    <span class="sk sk--route"></span>
                    <span class="sk sk--meta"></span>
                  </div>
                }
              </div>
            } @else if (mine().length === 0) {
              <na-empty-state title="Nothing to check in to yet" message="When you have an upcoming flight it will appear here, ready for online check-in." actionLabel="Search flights" (action)="router.navigate(['/search'])" />
            } @else {
              <ul class="mine__list">
                @for (b of mine(); track b.id) {
                  <li class="mine__row">
                    <div class="mine__info">
                      <na-route-line size="md" [origin]="b.flight.route.origin.iataCode" [destination]="b.flight.route.destination.iataCode" />
                      <p class="mine__meta na-text-muted na-text-small">
                        {{ b.flight.flightNumber }} · {{ fmt(b.flight.departureTime) }} · <span class="na-text-mono">{{ b.bookingReference }}</span>
                      </p>
                    </div>
                    <na-button variant="secondary" size="sm" (clicked)="select(b)">Select</na-button>
                  </li>
                }
              </ul>
            }
          </section>
        }
      </div>

      @if (selected(); as b) {
        <section class="na-card detail" aria-labelledby="detail-h">
          <div class="detail__head">
            <h2 id="detail-h">Check in — <span class="na-text-mono">{{ b.bookingReference }}</span></h2>
            <na-button variant="ghost" size="sm" (clicked)="selected.set(null)">Close</na-button>
          </div>

          <div class="summary">
            <na-route-line
              size="lg"
              [origin]="b.flight.route.origin.iataCode"
              [destination]="b.flight.route.destination.iataCode"
              [originCity]="b.flight.route.origin.city"
              [destinationCity]="b.flight.route.destination.city"
            />
            <div class="summary__meta">
              <p class="na-text-muted na-text-small">{{ b.flight.flightNumber }} · {{ fmt(b.flight.departureTime) }}</p>
              <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, b.status).tone">
                {{ statusLabel(BOOKING_STATUS_MAP, b.status).label }}
              </na-badge>
            </div>
          </div>

          @if (allCheckedIn(b)) {
            <div class="success" role="status">
              <span class="success__mark" aria-hidden="true">✓</span>
              <h3 class="success__title">You're checked in</h3>
              <p class="success__msg">Your boarding pass is ready.</p>
              <na-button variant="cta" size="lg" (clicked)="goBoardingPass(b)">View boarding pass</na-button>
            </div>
          } @else if (eligibilityOf(b).eligible) {
            <p class="chip" [class.chip--warn]="closingSoon(b)">
              Check-in closes in <span class="chip__time">{{ countdown(eligibilityOf(b).closesAt!) }}</span>
            </p>
            <ul class="pax-list">
              @for (bp of b.passengers; track bp.id; let i = $index) {
                <li class="pax">
                  <div class="pax__info">
                    <p class="pax__name">{{ bp.passenger.firstName }} {{ bp.passenger.lastName }}</p>
                    <p class="na-text-muted na-text-small">
                      {{ bp.passengerType }} · Seat {{ seatOf(b, bp.id) ?? 'assigned at gate' }}
                      @if (bp.passenger.passportNumber) { · Doc {{ bp.passenger.passportNumber }} }
                    </p>
                  </div>
                  @if (alreadyDone(b, bp.id)) {
                    <div class="pax__done">
                      <na-badge tone="success">Checked in</na-badge>
                      <na-button variant="secondary" size="sm" (clicked)="goBoardingPass(b)">Boarding pass</na-button>
                    </div>
                  } @else {
                    <div class="pax__confirm">
                      <input
                        type="checkbox"
                        class="pax__checkbox"
                        [id]="'doc-' + bp.id"
                        [checked]="docConfirmed().has(bp.id)"
                        (change)="toggleDoc(bp.id)"
                      />
                      <label [for]="'doc-' + bp.id" class="pax__label">
                        I confirm the travel document details for this passenger are correct.
                      </label>
                    </div>
                    <na-button
                      variant="cta"
                      [disabled]="!docConfirmed().has(bp.id)"
                      [loading]="checkingIn() === bp.id"
                      (clicked)="completeCheckIn(b, i, bp.id)"
                    >Complete check-in</na-button>
                  }
                </li>
              }
            </ul>
          } @else if (opensInFuture(b)) {
            <na-alert tone="info" title="Check-in not open yet">
              Online check-in for this flight opens at <strong>{{ fmt(eligibilityOf(b).opensAt!) }}</strong>
              — in {{ countdown(eligibilityOf(b).opensAt!) }}.
            </na-alert>
          } @else {
            <na-alert tone="warning" title="Check-in unavailable">
              {{ eligibilityOf(b).reason ?? 'This booking cannot be checked in online.' }}
            </na-alert>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-10) 0 var(--na-space-16); }
    .hero { margin-bottom: var(--na-space-8); }
    .hero__sub { margin-top: var(--na-space-3); max-width: 46ch; color: var(--na-ink-500); font-size: var(--na-text-lg); }
    .layout { display: grid; justify-items: center; gap: var(--na-space-6); }
    .lookup { width: min(100%, 34rem); padding: var(--na-space-8); }
    .lookup h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-2); }
    .lookup__sub { margin-bottom: var(--na-space-5); font-size: var(--na-text-sm); color: var(--na-ink-500); }
    .lookup na-alert { display: block; margin-bottom: var(--na-space-4); }
    .lookup form na-button { display: flex; flex-direction: column; }
    .mine { width: min(100%, 34rem); padding: var(--na-space-6); background: transparent; box-shadow: none; }
    .mine__title { font-size: var(--na-text-lg); margin-bottom: var(--na-space-2); }
    .mine__list { list-style: none; margin: var(--na-space-2) 0 0; padding: 0; }
    .mine__row { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-3) var(--na-space-4); flex-wrap: wrap; padding: var(--na-space-4) 0; border-bottom: 1px solid var(--na-border); }
    .mine__row:first-child { padding-top: var(--na-space-2); }
    .mine__row:last-child { border-bottom: none; padding-bottom: 0; }
    .mine__info { min-width: 0; }
    .mine__meta { margin-top: var(--na-space-1); }
    .mine__skelrow { display: grid; gap: var(--na-space-2); padding: var(--na-space-4) 0; border-bottom: 1px solid var(--na-border); }
    .mine__skelrow:last-child { border-bottom: none; }
    .sk {
      display: block; border-radius: var(--na-radius-md);
      background: linear-gradient(90deg, var(--na-surface-sunken) 25%, var(--na-border) 50%, var(--na-surface-sunken) 75%);
      background-size: 200% 100%;
      animation: na-checkin-shimmer 1.4s infinite;
    }
    .sk--route { height: 1.5rem; width: min(55%, 14rem); }
    .sk--meta { height: 0.875rem; width: min(80%, 20rem); }
    @keyframes na-checkin-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .detail { margin-top: var(--na-space-6); padding: var(--na-space-8); }
    .detail__head { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); margin-bottom: var(--na-space-6); }
    .detail__head h2 { font-size: var(--na-text-xl); }
    .summary {
      display: flex; flex-direction: column; align-items: center; gap: var(--na-space-3); text-align: center;
      padding-bottom: var(--na-space-6); margin-bottom: var(--na-space-5); border-bottom: 1px solid var(--na-border);
    }
    .summary__meta { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--na-space-2) var(--na-space-3); }
    .success {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: var(--na-space-3); padding: var(--na-space-4) var(--na-space-4) var(--na-space-6);
    }
    .success__mark {
      width: 4rem; height: 4rem; border-radius: 50%; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--na-success-bg); color: var(--na-success); border: 1px solid var(--na-success);
      font-size: 1.75rem; font-weight: var(--na-font-bold); margin-bottom: var(--na-space-2);
    }
    .success__title { font-family: var(--na-font-display); font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); }
    .success__msg { color: var(--na-ink-500); margin-bottom: var(--na-space-3); }
    .chip {
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      margin: 0 0 var(--na-space-2); padding: var(--na-space-2) var(--na-space-3);
      background: var(--na-surface-sunken); border: 1px solid var(--na-border); border-radius: var(--na-radius-full);
      font-size: var(--na-text-sm); color: var(--na-ink-700);
    }
    .chip__time { font-family: var(--na-font-mono); font-size: var(--na-text-sm); }
    .chip--warn { background: var(--na-warning-bg); border-color: transparent; color: var(--na-warning); font-weight: var(--na-font-medium); }
    .pax-list { list-style: none; margin: var(--na-space-2) 0 0; padding: 0; }
    .pax { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3) var(--na-space-4); flex-wrap: wrap; padding: var(--na-space-4) 0; }
    .pax + .pax { border-top: 1px solid var(--na-border); }
    .pax__info { flex: 1 1 220px; min-width: 0; }
    .pax__name { font-weight: var(--na-font-semibold); }
    .pax__confirm { display: flex; gap: var(--na-space-3); align-items: flex-start; flex: 1 1 280px; }
    .pax__checkbox { width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0; accent-color: var(--na-blue-600); }
    .pax__label { font-size: var(--na-text-sm); color: var(--na-ink-700); }
    .pax__done { display: flex; align-items: center; gap: var(--na-space-3); }
    .detail na-alert { display: block; margin-top: var(--na-space-4); }
    @media (max-width: 639px) {
      .page { padding-top: var(--na-space-6); }
      .hero { margin-bottom: var(--na-space-6); }
      .lookup, .detail, .mine { padding: var(--na-space-5) var(--na-space-4); }
      .detail__head h2 { font-size: var(--na-text-lg); }
      .pax na-button { flex: 1 1 100%; display: flex; flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk { animation: none; }
    }
  `,
})
export class CheckInPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly checkInService = inject(CheckInService);
  private readonly auth = inject(AuthService);
  readonly router = inject(Router);

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly listLoading = signal(false);
  readonly listError = signal(false);
  readonly mine = signal<Booking[]>([]);
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly selected = signal<Booking | null>(null);
  readonly docConfirmed = signal<Set<string>>(new Set());
  readonly checkingIn = signal<string | null>(null);
  readonly now = signal(Date.now());

  private readonly timer = setInterval(() => this.now.set(Date.now()), 1000);
  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  readonly form = this.fb.nonNullable.group({
    reference: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    if (this.isLoggedIn()) this.loadMine();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  loadMine(): void {
    this.listLoading.set(true);
    this.listError.set(false);
    this.bookingService.myBookings().subscribe({
      next: (bookings) => {
        this.mine.set(bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'));
        this.listLoading.set(false);
      },
      error: () => {
        this.listLoading.set(false);
        this.listError.set(true);
      },
    });
  }

  lookup(): void {
    if (this.form.invalid) return;
    this.lookupLoading.set(true);
    this.lookupError.set(null);
    const { reference, email } = this.form.getRawValue();
    this.bookingService.findByReference(reference, email).subscribe({
      next: (booking) => {
        this.lookupLoading.set(false);
        if (booking) {
          this.select(booking);
        } else {
          this.lookupError.set('No booking found for this reference.');
        }
      },
      error: (err) => {
        this.lookupLoading.set(false);
        this.lookupError.set(err?.message ?? 'Unable to find your booking. Please try again.');
      },
    });
  }

  select(booking: Booking): void {
    this.selected.set(booking);
    this.docConfirmed.set(new Set());
  }

  eligibilityOf(booking: Booking) {
    return this.checkInService.eligibility(booking, this.now());
  }

  opensInFuture(booking: Booking): boolean {
    const opensAt = this.eligibilityOf(booking).opensAt;
    return !!opensAt && new Date(opensAt).getTime() > this.now();
  }

  closingSoon(booking: Booking): boolean {
    const closesAt = this.eligibilityOf(booking).closesAt;
    return !!closesAt && new Date(closesAt).getTime() - this.now() < 2 * 60 * 60 * 1000;
  }

  countdown(opensAtIso: string): string {
    const ms = Math.max(0, new Date(opensAtIso).getTime() - this.now());
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m} min`;
  }

  alreadyDone(booking: Booking, bookingPassengerId: string): boolean {
    return this.checkInService
      .alreadyCheckedIn(booking.id)
      .some((c) => c.bookingPassengerId === bookingPassengerId && c.status === 'COMPLETED');
  }

  allCheckedIn(booking: Booking): boolean {
    return booking.passengers.length > 0 && booking.passengers.every((bp) => this.alreadyDone(booking, bp.id));
  }

  toggleDoc(bookingPassengerId: string): void {
    this.docConfirmed.update((set) => {
      const next = new Set(set);
      if (next.has(bookingPassengerId)) next.delete(bookingPassengerId);
      else next.add(bookingPassengerId);
      return next;
    });
  }

  completeCheckIn(booking: Booking, passengerIndex: number, bookingPassengerId: string): void {
    if (this.checkingIn()) return;
    this.checkingIn.set(bookingPassengerId);
    this.checkInService.complete(booking, passengerIndex).subscribe({
      next: () => {
        this.checkingIn.set(null);
        this.router.navigate(['/checkin', booking.id, 'pass']);
      },
      error: (err) => {
        this.checkingIn.set(null);
        this.lookupError.set(err?.message ?? 'Check-in failed. Please try again.');
      },
    });
  }

  goBoardingPass(booking: Booking): void {
    this.router.navigate(['/checkin', booking.id, 'pass']);
  }

  seatOf(booking: Booking, bookingPassengerId: string): string | null {
    return booking.seats.find((s) => s.bookingPassengerId === bookingPassengerId)?.seatNumber ?? null;
  }

  fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }
}
