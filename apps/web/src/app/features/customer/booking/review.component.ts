import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP } from '../../../core/status-maps';
import type { BookingDraft } from '../../../core/models/booking-flow.model';
import type { CreateBookingPayload } from '../../../core/models/customer-booking.model';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { BOOKING_STEPS } from './passengers.component';

@Component({
  selector: 'na-review-page',
  imports: [RouterLink, NaStepper, NaButton, NaBadge, NaAlert],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="4" />
      <h1>Review & book</h1>
      <p class="page__sub na-text-muted">Check your trip details, then confirm your booking.</p>

      @if (draft(); as d) {
        @if (holdWarning()) {
          <na-alert tone="warning" icon="⏱" title="Seat selection timed out">
            Your seat selection timed out, so the seats were released — you can
            <a routerLink="/booking/seats">choose seats again</a> or continue without reserved seats.
          </na-alert>
        }

        <div class="layout">
          <div class="main">
            <section class="na-card panel" aria-labelledby="trip-h">
              <header class="panel__head">
                <h2 id="trip-h">Trip</h2>
                <a [routerLink]="['/flights', d.outbound.id]">Edit</a>
              </header>
              <p>
                <strong>{{ d.outbound.flightNumber }}</strong> — {{ d.outbound.route.origin.iataCode }}
                ({{ d.outbound.route.origin.city }}) → {{ d.outbound.route.destination.iataCode }}
                ({{ d.outbound.route.destination.city }})
              </p>
              <p class="na-text-small na-text-muted">
                {{ fullDate(d.outbound.departureTime) }} → {{ time(d.outbound.arrivalTime) }} ·
                {{ cabinName(d.fare.cabinClass) }} ·
                <na-badge [tone]="statusTone(d.outbound.status)">{{ statusLabel(d.outbound.status) }}</na-badge>
              </p>
            </section>

            <section class="na-card panel" aria-labelledby="pax-h">
              <header class="panel__head">
                <h2 id="pax-h">Passengers</h2>
                <a routerLink="/booking/passengers">Edit</a>
              </header>
              <ul class="rows">
                @for (p of d.passengers; track $index; let i = $index) {
                  <li>
                    <span>
                      {{ p.firstName }} {{ p.lastName }}
                      <span class="na-text-muted na-text-small">({{ typeLabel(p.passengerType) }})</span>
                    </span>
                    <span class="na-text-small na-text-muted">
                      Seat {{ seatNumber(d, i) ?? 'not selected' }}
                    </span>
                  </li>
                }
              </ul>
            </section>

            <section class="na-card panel" aria-labelledby="contact-h">
              <header class="panel__head">
                <h2 id="contact-h">Contact</h2>
                <a routerLink="/booking/passengers">Edit</a>
              </header>
              <p class="na-text-small">
                {{ d.contactEmail }}@if (d.contactPhone) { · {{ d.contactPhone }} }
              </p>
            </section>

            <section class="na-card panel" aria-labelledby="bags-h">
              <header class="panel__head">
                <h2 id="bags-h">Baggage & extras</h2>
                <a routerLink="/booking/extras">Edit</a>
              </header>
              @if (d.fare.rules; as rules) {
                <p class="na-text-small">
                  Included: {{ rules.checkedBaggagePieces }}× checked bag ({{ rules.checkedBaggageWeightKg }} kg)
                  + {{ rules.carryOnPieces }}× carry-on per passenger.
                </p>
              }
              <p class="na-text-small na-text-muted">No add-on services were available for this booking.</p>
            </section>

            @if (d.fare.rules; as rules) {
              <details class="na-card panel rules">
                <summary>Fare rules — {{ cabinName(d.fare.cabinClass) }}</summary>
                <ul>
                  <li>{{ rules.description }}</li>
                  <li>{{ rules.refundable ? 'Refundable (cancellation fee ' + rules.cancellationFeePercent + '%)' : 'Non-refundable' }}</li>
                  <li>{{ rules.changeAllowed ? 'Changes allowed' + (rules.changeFee ? ' — fee ' + money(rules.changeFee) : ' — free') : 'Changes not permitted' }}</li>
                  @if (rules.priorityBoarding) { <li>Priority boarding included</li> }
                  @if (rules.loungeAccess) { <li>Lounge access included</li> }
                </ul>
              </details>
            }
          </div>

          <aside class="na-card side" aria-label="Price and confirmation">
            <h2>Price breakdown</h2>
            @if (breakdown(); as b) {
              <table class="side__table">
                <tbody>
                  <tr><td>Base fare × {{ b.passengerCount }}</td><td>{{ money(b.base) }}</td></tr>
                  <tr><td>Taxes × {{ b.passengerCount }}</td><td>{{ money(b.taxes) }}</td></tr>
                  <tr><td>Fees × {{ b.passengerCount }}</td><td>{{ money(b.fees) }}</td></tr>
                  <tr class="side__total"><td>Total</td><td>{{ money(b.total) }}</td></tr>
                </tbody>
              </table>
              <p class="na-hint">Seats are included at no charge.</p>
            }

            <p class="payment-note na-text-small na-text-muted">
              No payment is due now — the booking will be created as <strong>pending</strong> and payment happens later.
            </p>

            <div class="consent">
              <input id="consent" type="checkbox" [checked]="consent()" (change)="consent.set($any($event.target).checked)"
                [attr.aria-invalid]="consentError()" aria-describedby="consent-hint" />
              <label for="consent" id="consent-hint">
                I accept the conditions of carriage and privacy policy — see
                <a routerLink="/help">Help & conditions</a>.
              </label>
            </div>
            @if (consentError()) {
              <p class="na-error">Please accept the terms to continue.</p>
            }

            <div class="confirm">
              @if (submitError(); as message) {
                <na-alert tone="danger" icon="⚠" title="Booking could not be created" [retryable]="submitErrorRetryable()" (retry)="submit()">
                  {{ message }}
                </na-alert>
              }
              <na-button variant="cta" size="lg" [loading]="submitting()" [disabled]="submitting()" (clicked)="submit()">
                {{ submitting() ? 'Creating your booking…' : 'Confirm booking' }}
              </na-button>
              @if (submitting()) {
                <p class="na-text-small na-text-muted" aria-live="polite">
                  Contacting the booking service — do not close this page.
                </p>
              }
            </div>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); }
    h1 { margin-bottom: var(--na-space-1); }
    .page__sub { margin-bottom: var(--na-space-5); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .layout { display: grid; grid-template-columns: 1fr 360px; gap: var(--na-space-5); align-items: start; }
    .main { display: grid; gap: var(--na-space-4); align-content: start; }
    .panel { padding: var(--na-space-6); }
    .panel__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--na-space-3); }
    .panel__head h2 { font-size: var(--na-text-xl); }
    .panel__head a { font-weight: var(--na-font-semibold); min-height: 44px; display: inline-flex; align-items: center; }
    .rows { list-style: none; margin: var(--na-space-2) 0 0; padding: 0; display: grid; gap: var(--na-space-2); }
    .rows li { display: flex; justify-content: space-between; gap: var(--na-space-3); }
    .rules summary { cursor: pointer; font-weight: var(--na-font-semibold); min-height: 44px; display: flex; align-items: center; }
    .rules ul { margin: var(--na-space-3) 0 0; padding-left: var(--na-space-5); display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); }
    .side { padding: var(--na-space-6); position: sticky; top: var(--na-space-4); }
    .side h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-4); }
    .side__table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); margin-bottom: var(--na-space-2); }
    .side__table td { padding: var(--na-space-1) 0; }
    .side__table td:last-child { text-align: right; font-weight: var(--na-font-medium); }
    .side__total td { border-top: 1px solid var(--na-border); padding-top: var(--na-space-2); font-size: var(--na-text-lg); font-weight: var(--na-font-bold); }
    .payment-note { margin: var(--na-space-4) 0 0; }
    .consent { display: flex; gap: var(--na-space-2); align-items: flex-start; margin: var(--na-space-5) 0 var(--na-space-2); }
    .consent input { width: 22px; height: 22px; flex-shrink: 0; margin-top: var(--na-space-1); }
    .consent label { font-size: var(--na-text-sm); }
    .confirm { display: grid; gap: var(--na-space-3); margin-top: var(--na-space-4); border-top: 1px solid var(--na-border); padding-top: var(--na-space-4); }
    .confirm na-alert { margin-bottom: 0; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; order: -1; }
    }
  `,
})
export class ReviewPage {
  private readonly router = inject(Router);
  private readonly draftApi = inject(BookingDraftService);
  private readonly bookings = inject(CustomerBookingService);
  private readonly auth = inject(AuthService);

  protected readonly steps = BOOKING_STEPS;
  protected readonly draft = this.draftApi.draft;
  protected readonly consent = signal(false);
  protected readonly consentError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitErrorRetryable = signal(false);

  /**
   * Server-consistent figures: the server prices a booking as fare components
   * × passenger count. There are no seat charges, extras or discounts.
   */
  protected readonly breakdown = computed(() => {
    const d = this.draft();
    if (!d) return null;
    const passengerCount = d.passengers.length;
    const base = d.fare.basePrice * passengerCount;
    const taxes = d.fare.taxAmount * passengerCount;
    const fees = d.fare.feeAmount * passengerCount;
    return { passengerCount, base, taxes, fees, total: base + taxes + fees };
  });

  protected readonly holdWarning = computed(() => {
    const d = this.draft();
    return !!d && d.seats.length > 0 && this.draftApi.isHoldExpired();
  });

  constructor() {
    if (!this.draft()) {
      this.router.navigateByUrl('/search');
    }
  }

  protected seatNumber(d: BookingDraft, passengerIndex: number): string | null {
    return d.seats.find((s) => s.passengerIndex === passengerIndex)?.seat.seatNumber ?? null;
  }

  protected submit(): void {
    const d = this.draft();
    if (!d || d.passengers.length === 0 || this.submitting()) return;
    if (!this.consent()) {
      this.consentError.set(true);
      return;
    }
    this.consentError.set(false);
    // The route's authGuard enforces this too; redirect defensively so a guest
    // who reached this page can log in and land back here.
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
      return;
    }

    // Exactly the CreateBookingDto contract — the server owns identity (JWT),
    // booking reference, status and totals; never send client-computed fields.
    const payload: CreateBookingPayload = {
      flightId: d.outbound.id,
      cabinClass: d.fare.cabinClass,
      seatIds: d.seats.map((s) => s.seat.id),
      passengers: d.passengers.map((p) => ({
        passengerType: p.passengerType,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        ...(p.dateOfBirth ? { dateOfBirth: p.dateOfBirth } : {}),
        ...(p.nationality ? { nationality: p.nationality } : {}),
        ...(p.passportNumber ? { passportNumber: p.passportNumber } : {}),
      })),
      ...(d.contactEmail ? { contactEmail: d.contactEmail } : {}),
      ...(d.contactPhone ? { contactPhone: d.contactPhone } : {}),
    };

    this.submitting.set(true);
    this.submitError.set(null);
    this.bookings.create(payload).subscribe({
      next: (booking) => {
        this.submitting.set(false);
        this.draftApi.setConfirmedBooking(booking);
        this.router.navigate(['/booking/confirmation'], { queryParams: { id: booking.id } });
      },
      error: (err: HttpErrorResponse) => this.handleCreateError(err),
    });
  }

  private handleCreateError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    switch (err?.status) {
      case 401:
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
        return;
      case 400: {
        const message = (err.error as { message?: string | string[] } | undefined)?.message;
        this.submitError.set(
          Array.isArray(message)
            ? message.join(' ')
            : (message ?? 'The booking details were rejected. Please review them and try again.'),
        );
        this.submitErrorRetryable.set(false);
        return;
      }
      case 404:
        this.submitError.set('This flight is no longer available. Please start a new search.');
        this.submitErrorRetryable.set(false);
        return;
      case 409:
        // Seat conflict: drop the local selection so the user re-picks from
        // refreshed availability on the seats page.
        this.draftApi.releaseHold();
        this.router.navigate(['/booking/seats'], { state: { seatConflict: true } });
        return;
      default:
        this.submitError.set('The booking could not be created right now. Your details are preserved — you can safely try again.');
        this.submitErrorRetryable.set(true);
    }
  }

  protected money(amount: number): string {
    const currency = this.draft()?.fare.currency ?? 'EUR';
    return formatMoney(amount, currency);
  }

  protected time(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected fullDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected cabinName(cabin: string): string {
    return cabin
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  protected typeLabel(type: string): string {
    return type === 'ADULT' ? 'Adult' : type === 'CHILD' ? 'Child' : 'Infant';
  }

  protected statusLabel(status: keyof typeof FLIGHT_STATUS_MAP): string {
    return FLIGHT_STATUS_MAP[status].label;
  }

  protected statusTone(status: keyof typeof FLIGHT_STATUS_MAP) {
    return FLIGHT_STATUS_MAP[status].tone;
  }
}
