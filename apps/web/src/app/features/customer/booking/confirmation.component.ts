import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { BookingDraftService } from './booking-draft.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { BOOKING_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

@Component({
  selector: 'na-confirmation-page',
  imports: [RouterLink, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  template: `
    <div class="na-container page">
      @if (loading()) {
        <na-skeleton [rows]="[1, 2]" height="120px" />
      } @else if (lookupError()) {
        <na-alert tone="danger" icon="⚠" title="We couldn't load your booking" [retryable]="true" (retry)="lookup()">
          The booking service is unavailable right now. Your booking is safe — please try again in a moment.
        </na-alert>
      } @else if (booking(); as b) {
        <section class="hero" aria-labelledby="done-h">
          <span class="hero__icon" aria-hidden="true">✓</span>
          <h1 id="done-h">Booking received</h1>
          <p class="hero__sub">
            @if (b.status === 'PENDING') {
              Your seats are reserved while payment is pending. Keep this reference handy:
            } @else {
              Your trip is booked. Keep this reference handy:
            }
          </p>
          <p class="hero__ref na-text-mono" aria-label="Booking reference">{{ b.bookingReference }}</p>
          <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, b.status).tone">
            {{ statusLabel(BOOKING_STATUS_MAP, b.status).label }}
          </na-badge>
        </section>

        @if (b.status === 'PENDING') {
          <na-alert tone="warning" icon="⏳" title="Payment pending">
            This booking awaits payment — no payment has been taken yet. Your seats stay held
            @if (holdUntil(b); as until) { until <strong>{{ until }}</strong> }. You can manage or
            cancel it anytime from <a routerLink="/bookings">My bookings</a>.
            <a class="pay-link" [routerLink]="['/bookings', b.id]">Pay now</a>
          </na-alert>
        }

        <div class="grid">
          <section class="na-card panel" aria-labelledby="itin-h">
            <h2 id="itin-h">Itinerary</h2>
            @if (b.flight; as f) {
              <p>
                <strong>{{ f.flightNumber }}</strong> —
                {{ f.origin }} → {{ f.destination }}
              </p>
              <p class="na-text-small na-text-muted">
                {{ fullDate(f.departureTime) }} → {{ time(f.arrivalTime) }}
              </p>
            } @else {
              <p class="na-text-muted">Flight details are being finalized and will appear here shortly.</p>
            }
          </section>

          <section class="na-card panel" aria-labelledby="pax-h">
            <h2 id="pax-h">Passengers</h2>
            <ul class="rows">
              @for (p of b.passengers; track p.id) {
                <li>
                  <span>{{ p.firstName }} {{ p.lastName }}</span>
                  <span class="na-text-small na-text-muted">{{ typeLabel(p.passengerType) }}</span>
                </li>
              }
            </ul>
            @if (b.seats.length > 0) {
              <p class="seats na-text-small na-text-muted">
                Seats: <span class="na-text-mono">{{ seatNumbers(b) }}</span>
              </p>
            }
            <p class="panel__total">Total: <strong>{{ money(b.totalAmount, b.currency) }}</strong></p>
          </section>
        </div>

        <section class="actions" aria-label="Booking actions">
          <na-button variant="secondary" (clicked)="print()">Print confirmation</na-button>
          @if (b.flight) {
            <na-button variant="secondary" (clicked)="downloadIcs(b)">Add to calendar (.ics)</na-button>
          }
          <a class="actions__link" routerLink="/bookings">My bookings</a>
          @if (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') {
            <a class="actions__link" routerLink="/checkin">Online check-in</a>
          }
          <a class="actions__link" routerLink="/status">Flight status</a>
        </section>
      } @else {
        <na-empty-state
          icon="🎫"
          title="Booking not found"
          message="We couldn't find a booking for this link. It may be incomplete or belong to another account."
        />
        <div class="actions actions--center">
          <a class="actions__link" routerLink="/bookings">My bookings</a>
          <a class="actions__link" routerLink="/search">Search flights</a>
        </div>
      }
    </div>
  `,
  styles: `
    .page { padding-top: var(--na-space-8); padding-bottom: var(--na-space-12); max-width: 860px; }
    .hero { text-align: center; margin-bottom: var(--na-space-6); }
    .hero__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 64px; height: 64px; border-radius: 50%; margin-bottom: var(--na-space-4);
      background: var(--na-success-bg); color: var(--na-success);
      font-size: 2rem; font-weight: var(--na-font-bold);
    }
    .hero h1 { margin-bottom: var(--na-space-2); }
    .hero__sub { color: var(--na-ink-500); margin-bottom: var(--na-space-2); }
    .hero__ref {
      display: inline-block; font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); letter-spacing: 0.12em;
      background: var(--na-surface-raised); border: 1px dashed var(--na-border-strong);
      border-radius: var(--na-radius-md); padding: var(--na-space-2) var(--na-space-5); margin-bottom: var(--na-space-3);
    }
    na-alert { display: block; margin-bottom: var(--na-space-6); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4); margin-bottom: var(--na-space-6); }
    .panel { padding: var(--na-space-6); }
    .panel h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-3); }
    .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-2); }
    .rows li { display: flex; justify-content: space-between; gap: var(--na-space-3); }
    .seats { margin-top: var(--na-space-3); }
    .panel__total { border-top: 1px solid var(--na-border); margin-top: var(--na-space-3); padding-top: var(--na-space-3); }
    .actions { display: flex; gap: var(--na-space-3); flex-wrap: wrap; align-items: center; }
    .actions--center { justify-content: center; margin-top: var(--na-space-4); }
    .actions__link { min-height: 44px; display: inline-flex; align-items: center; font-weight: var(--na-font-semibold); }
    .pay-link {
      display: inline-flex; align-items: center; min-height: 36px; margin-top: var(--na-space-2);
      padding: 0.2rem 0.9rem; border: 1px solid currentColor; border-radius: var(--na-radius-sm);
      color: inherit; font-weight: var(--na-font-semibold); text-decoration: none;
    }
    @media print {
      .actions, na-alert { display: none; }
    }
    @media (max-width: 639px) {
      .grid { grid-template-columns: 1fr; }
    }
  `,
})
export class ConfirmationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly bookings = inject(CustomerBookingService);
  private readonly draft = inject(BookingDraftService);

  protected readonly booking = signal<CustomerBooking | null>(null);
  protected readonly loading = signal(true);
  protected readonly lookupError = signal(false);

  protected readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  protected readonly statusLabel = statusLabel;

  private readonly id = this.route.snapshot.queryParamMap.get('id');

  constructor() {
    const id = this.id;
    if (!id || !UUID_RE.test(id)) {
      this.loading.set(false);
      return;
    }
    const confirmed = this.draft.draft()?.confirmedBooking ?? null;
    if (confirmed?.id === id) {
      this.booking.set(confirmed);
      this.loading.set(false);
      this.draft.clear();
      return;
    }
    this.lookup();
  }

  protected lookup(): void {
    const id = this.id;
    if (!id) return;
    this.loading.set(true);
    this.lookupError.set(false);
    this.bookings.getById(id).subscribe({
      next: (b) => {
        this.booking.set(b);
        this.loading.set(false);
        // The funnel is complete — a stale draft must not leak into a new search.
        this.draft.clear();
      },
      error: () => {
        this.loading.set(false);
        this.lookupError.set(true);
      },
    });
  }

  protected seatNumbers(b: CustomerBooking): string {
    return b.seats.map((s) => s.seatNumber).join(' · ');
  }

  protected holdUntil(b: CustomerBooking): string | null {
    let earliest: string | null = null;
    for (const s of b.seats) {
      if (s.holdStatus !== 'ACTIVE') continue;
      if (earliest === null || s.holdExpiresAt < earliest) earliest = s.holdExpiresAt;
    }
    return earliest === null ? null : this.fullDate(earliest);
  }

  protected print(): void {
    window.print();
  }

  protected downloadIcs(b: CustomerBooking): void {
    const f = b.flight;
    if (!f) return;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NovaAir//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${b.id}@novaair.demo`,
      `DTSTAMP:${icsDate(b.bookedAt)}`,
      `DTSTART:${icsDate(f.departureTime)}`,
      `DTEND:${icsDate(f.arrivalTime)}`,
      `SUMMARY:Flight ${f.flightNumber} ${f.origin} → ${f.destination}`,
      `DESCRIPTION:Booking reference ${b.bookingReference}`,
      `LOCATION:${f.origin}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novaair-${b.bookingReference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  protected time(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected fullDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected typeLabel(type: string): string {
    return type === 'ADULT' ? 'Adult' : type === 'CHILD' ? 'Child' : 'Infant';
  }
}
