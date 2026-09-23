import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { flightDurationLabel } from '../../../core/services/flight.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { Booking } from '../../../core/models/domain.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

@Component({
  selector: 'na-confirmation-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  template: `
    <div class="na-container page">
      @if (loading()) {
        <na-skeleton [rows]="[1, 2]" height="120px" />
      } @else if (booking(); as b) {
        <section class="hero" aria-labelledby="done-h">
          <span class="hero__icon" aria-hidden="true">✓</span>
          <h1 id="done-h">Booking confirmed</h1>
          <p class="hero__sub">Your trip is booked. Keep this reference handy:</p>
          <p class="hero__ref na-text-mono" aria-label="Booking reference">{{ b.bookingReference }}</p>
          <na-badge tone="success">Confirmed</na-badge>
        </section>

        <na-alert tone="info" icon="✉" title="Confirmation on its way">
          A confirmation email with your itinerary has been queued for delivery to
          <strong>{{ b.contactEmail }}</strong>. You can also check-in online from 24 hours before departure.
        </na-alert>

        <div class="grid">
          <section class="na-card panel" aria-labelledby="itin-h">
            <h2 id="itin-h">Itinerary</h2>
            <p>
              <strong>{{ b.flight.flightNumber }}</strong> —
              {{ b.flight.route.origin.iataCode }} ({{ b.flight.route.origin.city }}) →
              {{ b.flight.route.destination.iataCode }} ({{ b.flight.route.destination.city }})
            </p>
            <p class="na-text-small na-text-muted">
              {{ fullDate(b.flight.departureTime) }} → {{ time(b.flight.arrivalTime) }} ·
              {{ flightDurationLabel(b.flight) }} · {{ b.flight.aircraft.model }}
            </p>
          </section>

          <section class="na-card panel" aria-labelledby="pax-h">
            <h2 id="pax-h">Passengers</h2>
            <ul class="rows">
              @for (p of b.passengers; track p.id) {
                <li>
                  <span>{{ p.passenger.firstName }} {{ p.passenger.lastName }}</span>
                  <span class="na-text-small na-text-muted">
                    {{ typeLabel(p.passengerType) }} · Seat {{ seatFor(b, p.id) ?? 'assigned at check-in' }}
                  </span>
                </li>
              }
            </ul>
            <p class="panel__total">Total paid: <strong>{{ money(b.totalAmount, b.currency) }}</strong></p>
          </section>
        </div>

        <section class="actions" aria-label="Booking actions">
          <na-button variant="secondary" (clicked)="print()">Print confirmation</na-button>
          <na-button variant="secondary" (clicked)="downloadIcs(b)">Add to calendar (.ics)</na-button>
          <a class="actions__link" routerLink="/bookings">My bookings</a>
          <a class="actions__link" routerLink="/checkin">Online check-in</a>
          <a class="actions__link" routerLink="/status">Flight status</a>
        </section>
      } @else {
        <na-empty-state
          icon="🎫"
          title="No recent booking found"
          message="We couldn't find a freshly confirmed booking in this session. Check your bookings or start a new search."
          actionLabel="Go to my bookings"
          (action)="goBookings()"
        />
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
    .panel { padding: var(--na-space-5); }
    .panel h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-3); }
    .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-2); }
    .rows li { display: flex; justify-content: space-between; gap: var(--na-space-3); }
    .panel__total { border-top: 1px solid var(--na-border); margin-top: var(--na-space-3); padding-top: var(--na-space-3); }
    .actions { display: flex; gap: var(--na-space-3); flex-wrap: wrap; align-items: center; }
    .actions__link { min-height: 44px; display: inline-flex; align-items: center; font-weight: var(--na-font-semibold); }
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
  private readonly router = inject(Router);
  private readonly bookings = inject(BookingService);
  private readonly draft = inject(BookingDraftService);

  protected readonly booking = signal<Booking | null>(null);
  protected readonly loading = signal(true);

  protected readonly flightDurationLabel = flightDurationLabel;

  constructor() {
    const ref = this.route.snapshot.queryParamMap.get('ref');
    const confirmed = this.draft.draft()?.confirmedBooking ?? null;
    this.draft.clear();

    if (confirmed) {
      this.booking.set(confirmed);
      this.loading.set(false);
      return;
    }
    if (!ref) {
      this.loading.set(false);
      return;
    }
    this.bookings.findByReference(ref).subscribe({
      next: (b) => {
        this.booking.set(b ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected seatFor(b: Booking, bookingPassengerId: string): string | null {
    return b.seats.find((s) => s.bookingPassengerId === bookingPassengerId)?.seatNumber ?? null;
  }

  protected print(): void {
    window.print();
  }

  protected downloadIcs(b: Booking): void {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NovaAir//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${b.id}@novaair.demo`,
      `DTSTAMP:${icsDate(b.bookedAt)}`,
      `DTSTART:${icsDate(b.flight.departureTime)}`,
      `DTEND:${icsDate(b.flight.arrivalTime)}`,
      `SUMMARY:Flight ${b.flight.flightNumber} ${b.flight.route.origin.iataCode} → ${b.flight.route.destination.iataCode}`,
      `DESCRIPTION:Booking reference ${b.bookingReference}`,
      `LOCATION:${b.flight.route.origin.name}`,
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

  protected goBookings(): void {
    this.router.navigateByUrl('/bookings');
  }
}
