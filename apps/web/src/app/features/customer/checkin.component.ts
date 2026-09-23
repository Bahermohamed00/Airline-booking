import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingService } from '../../core/services/booking.service';
import { CheckInService } from '../../core/services/domain-services';
import { AuthService } from '../../core/services/auth.service';
import type { Booking } from '../../core/models/domain.model';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>Online check-in</h1>
        <p class="na-text-muted">Check in from 24 hours until 1 hour before departure.</p>
      </header>

      <div class="layout">
        <section class="na-card panel" aria-labelledby="lookup-h">
          <h2 id="lookup-h">Find a booking</h2>
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
              <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" />
            </div>
            <na-button variant="primary" type="submit" [loading]="lookupLoading()" [disabled]="form.invalid">Continue</na-button>
          </form>
        </section>

        @if (isLoggedIn()) {
          <section class="na-card panel" aria-labelledby="eligible-h">
            <h2 id="eligible-h">Your bookings</h2>
            @if (listError()) {
              <na-alert tone="danger" title="Could not load bookings" retryable (retry)="loadMine()">Please try again.</na-alert>
            } @else if (listLoading()) {
              <na-skeleton [rows]="[1, 2]" height="3.5rem" />
            } @else if (mine().length === 0) {
              <na-empty-state title="No bookings found" message="Book a flight first, then return here to check in." actionLabel="Search flights" (action)="router.navigate(['/search'])" />
            } @else {
              <ul class="mine">
                @for (b of mine(); track b.id) {
                  <li class="mine__row">
                    <div>
                      <p><span class="na-text-mono">{{ b.bookingReference }}</span> · {{ b.flight.flightNumber }} {{ b.flight.route.origin.iataCode }}→{{ b.flight.route.destination.iataCode }}</p>
                      <p class="na-text-muted na-text-small">{{ fmt(b.flight.departureTime) }}</p>
                    </div>
                    @if (eligibilityOf(b).eligible) {
                      <na-button variant="cta" size="sm" (clicked)="select(b)">Check in</na-button>
                    } @else {
                      <na-button variant="secondary" size="sm" (clicked)="select(b)">View</na-button>
                    }
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
          <p class="na-text-muted">{{ b.flight.flightNumber }} · {{ b.flight.route.origin.iataCode }}→{{ b.flight.route.destination.iataCode }} · {{ fmt(b.flight.departureTime) }}</p>

          @if (eligibilityOf(b).eligible) {
            <ul class="pax-list">
              @for (bp of b.passengers; track bp.id; let i = $index) {
                <li class="pax-card na-card">
                  <div class="pax-card__info">
                    <p class="pax-card__name">{{ bp.passenger.firstName }} {{ bp.passenger.lastName }}</p>
                    <p class="na-text-muted na-text-small">
                      {{ bp.passengerType }} · Seat {{ seatOf(b, bp.id) ?? 'assigned at gate' }}
                      @if (bp.passenger.passportNumber) { · Doc {{ bp.passenger.passportNumber }} }
                    </p>
                  </div>
                  @if (alreadyDone(b, bp.id)) {
                    <na-badge tone="success">Checked in</na-badge>
                  } @else {
                    <div class="pax-card__confirm">
                      <input
                        type="checkbox"
                        class="pax-card__checkbox"
                        [id]="'doc-' + bp.id"
                        [checked]="docConfirmed().has(bp.id)"
                        (change)="toggleDoc(bp.id)"
                      />
                      <label [for]="'doc-' + bp.id" class="na-label">
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
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .page__head { margin-bottom: var(--na-space-6); }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4); }
    .panel { padding: var(--na-space-5); align-self: start; }
    .panel h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .mine { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .mine__row { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-3); padding-bottom: var(--na-space-3); border-bottom: 1px solid var(--na-border); }
    .mine__row:last-child { border-bottom: none; padding-bottom: 0; }
    .detail { margin-top: var(--na-space-6); padding: var(--na-space-5); }
    .detail__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--na-space-2); }
    .detail__head h2 { font-size: var(--na-text-lg); }
    .pax-list { list-style: none; margin: var(--na-space-4) 0 0; padding: 0; display: grid; gap: var(--na-space-4); }
    .pax-card { padding: var(--na-space-4); display: grid; gap: var(--na-space-3); }
    .pax-card__name { font-weight: var(--na-font-semibold); }
    .pax-card__confirm { display: flex; gap: var(--na-space-3); align-items: flex-start; }
    .pax-card__checkbox { width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0; }
    .detail na-alert { display: block; margin-top: var(--na-space-4); }
    @media (max-width: 639px) {
      .layout { grid-template-columns: 1fr; }
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

  seatOf(booking: Booking, bookingPassengerId: string): string | null {
    return booking.seats.find((s) => s.bookingPassengerId === bookingPassengerId)?.seatNumber ?? null;
  }

  fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }
}
