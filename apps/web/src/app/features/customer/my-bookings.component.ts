import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { CheckInService } from '../../core/services/domain-services';
import { BOOKING_STATUS_MAP, statusLabel } from '../../core/status-maps';
import type { Booking, CabinClass } from '../../core/models/domain.model';
import { NaTabs, TabItem } from '../../shared/ui/tabs.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';
import { NaRouteLine } from '../../shared/ui/route-line.component';

type BookingTab = 'upcoming' | 'past' | 'cancelled';

interface EmptyStateContent {
  image: string | null;
  title: string;
  message: string;
  actionLabel: string | null;
}

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [NaTabs, NaBadge, NaButton, NaAlert, NaEmptyState, NaRouteLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="hero">
        <h1>My journeys</h1>
        <p class="hero__sub">Manage your upcoming trips, bookings and travel history.</p>
      </header>

      @if (error()) {
        <na-alert tone="danger" title="We couldn't load your bookings" retryable (retry)="load()">
          Something went wrong while fetching your journeys. Please try again.
        </na-alert>
      } @else if (loading()) {
        <div class="cards" role="status" aria-label="Loading your journeys">
          @for (i of [1, 2, 3]; track i) {
            <div class="journey na-card skel" aria-hidden="true">
              <span class="skel__bar skel__bar--route"></span>
              <span class="skel__bar skel__bar--times"></span>
              <span class="skel__rule"></span>
              <span class="skel__bar skel__bar--foot"></span>
            </div>
          }
        </div>
      } @else {
        <na-tabs [tabs]="tabs()" [active]="activeTab()" ariaLabel="Filter bookings" (tabChange)="setTab($event)" />

        @if (filtered().length === 0) {
          <na-empty-state
            [image]="emptyState().image"
            [title]="emptyState().title"
            [message]="emptyState().message"
            [actionLabel]="emptyState().actionLabel"
            (action)="goSearch()"
          />
        } @else {
          <ul class="cards">
            @for (booking of filtered(); track booking.id) {
              <li class="journey na-card" [class.journey--cancelled]="booking.status === 'CANCELLED'">
                <div class="journey__top">
                  <na-route-line
                    [origin]="booking.flight.route.origin.iataCode"
                    [destination]="booking.flight.route.destination.iataCode"
                    [originCity]="booking.flight.route.origin.city"
                    [destinationCity]="booking.flight.route.destination.city"
                    size="lg"
                  />
                </div>
                <div class="journey__times">
                  <div class="journey__point">
                    <p class="journey__time">{{ fmtTime(booking.flight.departureTime) }}</p>
                    <p class="journey__date">{{ fmtDate(booking.flight.departureTime) }}</p>
                  </div>
                  <span class="journey__arrow" aria-hidden="true">→</span>
                  <span class="na-visually-hidden">to</span>
                  <div class="journey__point journey__point--to">
                    <p class="journey__time">{{ fmtTime(booking.flight.arrivalTime) }}</p>
                    <p class="journey__date">{{ fmtDate(booking.flight.arrivalTime) }}</p>
                  </div>
                </div>
                <div class="journey__foot">
                  <div class="journey__info">
                    <p class="journey__meta">{{ metaLine(booking) }}</p>
                    <p class="journey__refblock">
                      <span class="journey__reflabel">Booking reference</span>
                      <span class="journey__ref na-text-mono">{{ booking.bookingReference }}</span>
                    </p>
                  </div>
                  <div class="journey__side">
                    <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, booking.status).tone">
                      {{ statusLabel(BOOKING_STATUS_MAP, booking.status).label }}
                    </na-badge>
                    <div class="journey__actions">
                      @if (canCheckIn(booking)) {
                        <na-button variant="cta" size="sm" (clicked)="goCheckIn()">Check in</na-button>
                      }
                      <na-button variant="secondary" size="sm" (clicked)="goManage(booking)">Manage</na-button>
                    </div>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-10) 0 var(--na-space-16); }
    .hero { margin-bottom: var(--na-space-10); }
    .hero__sub {
      margin-top: var(--na-space-3); max-width: 38ch;
      color: var(--na-ink-500); font-size: var(--na-text-lg);
    }
    .cards { list-style: none; margin: var(--na-space-6) 0 0; padding: 0; display: grid; gap: var(--na-space-5); }
    .journey {
      padding: var(--na-space-6);
      transition: transform var(--na-motion-base) var(--na-ease), box-shadow var(--na-motion-base) var(--na-ease);
    }
    .journey:hover { transform: translateY(-2px); box-shadow: var(--na-shadow-md); }
    .journey__top { margin-bottom: var(--na-space-5); }
    .journey__times { display: flex; align-items: flex-start; gap: var(--na-space-3); margin-bottom: var(--na-space-5); }
    .journey__point--to { text-align: right; }
    .journey__time { font-size: var(--na-text-lg); font-weight: var(--na-font-semibold); color: var(--na-ink-900); }
    .journey__date { margin-top: 2px; font-size: var(--na-text-sm); color: var(--na-ink-500); }
    .journey__arrow { margin-top: 3px; color: var(--na-ink-300); }
    .journey__foot {
      display: flex; justify-content: space-between; align-items: flex-end; gap: var(--na-space-4);
      border-top: 1px solid var(--na-border); padding-top: var(--na-space-4);
    }
    .journey__meta { margin-bottom: var(--na-space-3); font-size: var(--na-text-sm); color: var(--na-ink-500); }
    .journey__reflabel {
      display: block; margin-bottom: var(--na-space-1);
      font-size: var(--na-text-xs); font-weight: var(--na-font-medium);
      letter-spacing: 0.04em; text-transform: uppercase; color: var(--na-ink-500);
    }
    .journey__ref { font-weight: var(--na-font-semibold); }
    .journey__side { display: flex; flex-direction: column; align-items: flex-end; gap: var(--na-space-3); flex-shrink: 0; }
    .journey__actions { display: flex; gap: var(--na-space-2); flex-wrap: wrap; justify-content: flex-end; }
    .journey--cancelled .journey__top,
    .journey--cancelled .journey__times,
    .journey--cancelled .journey__info { opacity: 0.55; }

    .skel { display: block; }
    .skel__bar {
      display: block; border-radius: var(--na-radius-md);
      background: linear-gradient(90deg, var(--na-surface-sunken) 25%, var(--na-border) 50%, var(--na-surface-sunken) 75%);
      background-size: 200% 100%;
      animation: na-journeys-shimmer 1.4s infinite;
    }
    .skel__bar--route { height: 3rem; width: min(65%, 22rem); margin-bottom: var(--na-space-5); }
    .skel__bar--times { height: 1.5rem; width: min(45%, 15rem); margin-bottom: var(--na-space-5); }
    .skel__rule { display: block; height: 1px; background: var(--na-border); margin-bottom: var(--na-space-4); }
    .skel__bar--foot { height: 1rem; width: min(55%, 18rem); }
    @keyframes na-journeys-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (max-width: 639px) {
      .page { padding-top: var(--na-space-6); }
      .hero { margin-bottom: var(--na-space-8); }
      .journey { padding: var(--na-space-5) var(--na-space-4); }
      .journey__foot { flex-direction: column; align-items: stretch; }
      .journey__side { flex-direction: row; align-items: center; justify-content: space-between; }
    }
    @media (prefers-reduced-motion: reduce) {
      .journey { transition: none; }
      .journey:hover { transform: none; }
      .skel__bar { animation: none; }
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

  private readonly dayFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
  private readonly timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  readonly tabs = computed<TabItem[]>(() => {
    const all = this.bookings();
    return [
      { id: 'upcoming', label: 'Upcoming', count: this.bucket(all, 'upcoming').length },
      { id: 'past', label: 'Past', count: this.bucket(all, 'past').length },
      { id: 'cancelled', label: 'Cancelled', count: this.bucket(all, 'cancelled').length },
    ];
  });

  readonly filtered = computed(() => this.bucket(this.bookings(), this.activeTab()));

  readonly emptyState = computed<EmptyStateContent>(() => {
    switch (this.activeTab()) {
      case 'upcoming':
        return {
          image: 'assets/img/hero-wing.jpg',
          title: 'No upcoming journeys',
          message: 'Your next adventure is waiting — search over 120 destinations.',
          actionLabel: 'Search flights',
        };
      case 'past':
        return {
          image: null,
          title: 'No past journeys',
          message: 'Flights you have taken will appear here once the journey is complete.',
          actionLabel: null,
        };
      case 'cancelled':
        return {
          image: null,
          title: 'No cancelled bookings',
          message: 'None of your bookings have been cancelled — everything is on track.',
          actionLabel: null,
        };
    }
  });

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

  metaLine(booking: Booking): string {
    const parts = [booking.flight.flightNumber];
    const cabin = this.cabinOf(booking);
    if (cabin) parts.push(cabin);
    const n = booking.passengers.length;
    parts.push(`${n} ${n === 1 ? 'passenger' : 'passengers'}`);
    return parts.join(' · ');
  }

  fmtDate(iso: string): string {
    return this.dayFmt.format(new Date(iso));
  }

  fmtTime(iso: string): string {
    return this.timeFmt.format(new Date(iso));
  }

  private cabinOf(booking: Booking): string | null {
    for (const bs of booking.seats) {
      const seat = booking.flight.aircraft.seats.find((s) => s.id === bs.seatId || s.seatNumber === bs.seatNumber);
      if (seat) return this.cabinLabel(seat.cabinClass);
    }
    return null;
  }

  private cabinLabel(cabin: CabinClass): string {
    return cabin.charAt(0) + cabin.slice(1).toLowerCase().replace('_', ' ');
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
