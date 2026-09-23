import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { CheckInService } from '../../core/services/domain-services';
import { BOOKING_STATUS_MAP, statusLabel } from '../../core/status-maps';
import type { Booking } from '../../core/models/domain.model';
import { NaTabs, TabItem } from '../../shared/ui/tabs.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';

type BookingTab = 'upcoming' | 'past' | 'cancelled';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [NaTabs, NaBadge, NaButton, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>My bookings</h1>
        <p class="na-text-muted">Your trips with NovaAir — check in, manage, or review past journeys.</p>
      </header>

      @if (error()) {
        <na-alert tone="danger" title="Could not load your bookings" retryable (retry)="load()">
          Something went wrong while fetching your bookings.
        </na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="6rem" />
      } @else {
        <na-tabs [tabs]="tabs()" [active]="activeTab()" ariaLabel="Filter bookings" (tabChange)="setTab($event)" />

        @if (filtered().length === 0) {
          <na-empty-state
            [title]="emptyTitle()"
            message="When you book a flight it will appear here."
            actionLabel="Search flights"
            (action)="goSearch()"
          />
        } @else {
          <ul class="cards">
            @for (booking of filtered(); track booking.id) {
              <li class="card na-card">
                <div class="card__main">
                  <div class="card__top">
                    <span class="card__ref na-text-mono">{{ booking.bookingReference }}</span>
                    <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, booking.status).tone">
                      {{ statusLabel(BOOKING_STATUS_MAP, booking.status).label }}
                    </na-badge>
                  </div>
                  <p class="card__route">
                    <strong>{{ booking.flight.route.origin.iataCode }}</strong>
                    <span aria-hidden="true">→</span>
                    <strong>{{ booking.flight.route.destination.iataCode }}</strong>
                    <span class="na-text-muted">· {{ booking.flight.flightNumber }}</span>
                  </p>
                  <p class="na-text-muted na-text-small">
                    {{ fmt(booking.flight.departureTime) }} ·
                    {{ booking.passengers.length }} {{ booking.passengers.length === 1 ? 'passenger' : 'passengers' }}
                  </p>
                </div>
                <div class="card__actions">
                  @if (canCheckIn(booking)) {
                    <na-button variant="cta" size="sm" (clicked)="goCheckIn()">Check in</na-button>
                  }
                  <na-button variant="secondary" size="sm" (clicked)="goManage(booking)">Manage</na-button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .page__head { margin-bottom: var(--na-space-6); }
    .cards { list-style: none; margin: var(--na-space-4) 0 0; padding: 0; display: grid; gap: var(--na-space-4); }
    .card { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4) var(--na-space-5); }
    .card__top { display: flex; align-items: center; gap: var(--na-space-3); margin-bottom: var(--na-space-2); }
    .card__ref { font-weight: var(--na-font-semibold); }
    .card__route { display: flex; gap: var(--na-space-2); align-items: baseline; font-size: var(--na-text-lg); margin-bottom: var(--na-space-1); }
    .card__actions { display: flex; gap: var(--na-space-2); flex-shrink: 0; }
    @media (max-width: 639px) {
      .card { flex-direction: column; align-items: stretch; }
      .card__actions { justify-content: flex-end; }
    }
  `,
})
export class MyBookingsPage {
  private readonly bookingService = inject(BookingService);
  private readonly checkInService = inject(CheckInService);
  private readonly router = inject(Router);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly bookings = signal<Booking[]>([]);
  readonly activeTab = signal<BookingTab>('upcoming');

  setTab(tab: string): void {
    if (tab === 'upcoming' || tab === 'past' || tab === 'cancelled') {
      this.activeTab.set(tab);
    }
  }

  private readonly dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  readonly tabs = computed<TabItem[]>(() => {
    const all = this.bookings();
    return [
      { id: 'upcoming', label: 'Upcoming', count: this.bucket(all, 'upcoming').length },
      { id: 'past', label: 'Past', count: this.bucket(all, 'past').length },
      { id: 'cancelled', label: 'Cancelled', count: this.bucket(all, 'cancelled').length },
    ];
  });

  readonly filtered = computed(() => this.bucket(this.bookings(), this.activeTab()));

  readonly emptyTitle = computed(() =>
    this.activeTab() === 'upcoming'
      ? 'No upcoming trips'
      : this.activeTab() === 'past'
        ? 'No past trips'
        : 'No cancelled bookings',
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.bookingService.myBookings().subscribe({
      next: (bookings) => {
        this.bookings.set(bookings);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  canCheckIn(booking: Booking): boolean {
    return this.checkInService.eligibility(booking).eligible;
  }

  goCheckIn(): void {
    this.router.navigate(['/checkin']);
  }

  goManage(booking: Booking): void {
    this.router.navigate(['/bookings', booking.id]);
  }

  goSearch(): void {
    this.router.navigate(['/search']);
  }

  fmt(iso: string): string {
    return this.dateFmt.format(new Date(iso));
  }

  private bucket(bookings: Booking[], tab: BookingTab): Booking[] {
    const now = Date.now();
    return bookings.filter((b) => {
      const dep = new Date(b.flight.departureTime).getTime();
      if (tab === 'cancelled') return b.status === 'CANCELLED';
      if (tab === 'upcoming') return b.status !== 'CANCELLED' && dep >= now;
      return b.status !== 'CANCELLED' && dep < now;
    });
  }
}
