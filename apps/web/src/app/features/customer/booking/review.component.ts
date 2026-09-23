import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { BookingService } from '../../../core/services/booking.service';
import { PaymentService } from '../../../core/services/domain-services';
import { PricingService, formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP } from '../../../core/status-maps';
import type { BookingDraft } from '../../../core/models/booking-flow.model';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { BOOKING_STEPS } from './passengers.component';

@Component({
  selector: 'na-review-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NaStepper, NaButton, NaBadge, NaAlert],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="4" />
      <h1>Review & pay</h1>

      @if (draft(); as d) {
        @if (holdWarning()) {
          <na-alert tone="warning" icon="⏱" title="Seat hold expired">
            Your seat hold has expired. Seat selections were released — you can
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

            <section class="na-card panel" aria-labelledby="bags-h">
              <header class="panel__head">
                <h2 id="bags-h">Baggage & extras</h2>
                <a routerLink="/booking/extras">Edit</a>
              </header>
              <p class="na-text-small">
                Included: {{ d.fare.rules.checkedBaggagePieces }}× checked bag ({{ d.fare.rules.checkedBaggageWeightKg }} kg)
                + {{ d.fare.rules.carryOnPieces }}× carry-on per passenger.
              </p>
              @if (totalExtraBags(d) > 0) {
                <p class="na-text-small">Extra checked bags: {{ totalExtraBags(d) }}</p>
              }
              @if (d.extras.length) {
                <ul class="rows">
                  @for (e of d.extras; track e.extra.id) {
                    <li><span>{{ e.extra.name }}</span><span class="na-text-small na-text-muted">× {{ e.quantity }}</span></li>
                  }
                </ul>
              } @else {
                <p class="na-text-small na-text-muted">No add-on services selected.</p>
              }
            </section>

            <details class="na-card panel rules">
              <summary>Fare rules — {{ cabinName(d.fare.cabinClass) }}</summary>
              <ul>
                <li>{{ d.fare.rules.description }}</li>
                <li>{{ d.fare.rules.refundable ? 'Refundable (cancellation fee ' + d.fare.rules.cancellationFeePercent + '%)' : 'Non-refundable' }}</li>
                <li>{{ d.fare.rules.changeAllowed ? 'Changes allowed' + (d.fare.rules.changeFee ? ' — fee ' + money(d.fare.rules.changeFee) : ' — free') : 'Changes not permitted' }}</li>
                <li>{{ d.fare.rules.seatSelectionFee === 0 ? 'Seat selection included' : 'Seat selection fee applies' }}</li>
                @if (d.fare.rules.priorityBoarding) { <li>Priority boarding included</li> }
                @if (d.fare.rules.loungeAccess) { <li>Lounge access included</li> }
              </ul>
            </details>
          </div>

          <aside class="na-card side" aria-label="Price and payment">
            <h2>Price breakdown</h2>
            @if (breakdown(); as b) {
              <table class="side__table">
                <tbody>
                  <tr><td>Base fare & carrier charges</td><td>{{ money(b.baseFare) }}</td></tr>
                  <tr><td>of which taxes</td><td>{{ money(b.taxes) }}</td></tr>
                  <tr><td>of which fees</td><td>{{ money(b.fees) }}</td></tr>
                  @if (b.seatCharges > 0) { <tr><td>Seat selection</td><td>{{ money(b.seatCharges) }}</td></tr> }
                  @if (b.baggage > 0) { <tr><td>Extra baggage</td><td>{{ money(b.baggage) }}</td></tr> }
                  @if (b.extras > 0) { <tr><td>Add-ons</td><td>{{ money(b.extras) }}</td></tr> }
                  @if (b.discount > 0) { <tr class="side__discount"><td>Promo discount ({{ d.criteria.promoCode }})</td><td>−{{ money(b.discount) }}</td></tr> }
                  <tr class="side__total"><td>Total</td><td>{{ money(b.total) }}</td></tr>
                </tbody>
              </table>
            }

            <div class="consent">
              <input id="consent" type="checkbox" [checked]="consent()" (change)="consent.set($any($event.target).checked)"
                [attr.aria-invalid]="consentError()" aria-describedby="consent-hint" />
              <label for="consent" id="consent-hint">
                I accept the <a href="#" (click)="$event.preventDefault()">Conditions of carriage</a> and
                <a href="#" (click)="$event.preventDefault()">Privacy policy</a>.
              </label>
            </div>
            @if (consentError()) {
              <p class="na-error">Please accept the terms to continue.</p>
            }

            <div class="pay">
              <p class="na-text-small na-text-muted">
                Demo checkout — no real card details are collected. Payment is simulated by the
                <strong>mockpay</strong> provider and always uses a tokenized, idempotent charge.
              </p>
              @if (paymentError()) {
                <na-alert tone="danger" icon="⚠" title="Payment failed" [retryable]="true" (retry)="pay()">
                  {{ paymentError() }} Your booking details are preserved — you can safely retry.
                </na-alert>
              }
              <na-button variant="cta" size="lg" [loading]="paying()" [disabled]="paying()" (clicked)="pay()">
                {{ paying() ? 'Processing secure payment…' : 'Pay securely' }}
              </na-button>
              @if (paying()) {
                <p class="na-text-small na-text-muted" aria-live="polite">
                  Contacting the mock payment provider — do not close this page.
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
    h1 { margin-bottom: var(--na-space-5); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .layout { display: grid; grid-template-columns: 1fr 360px; gap: var(--na-space-5); align-items: start; }
    .main { display: grid; gap: var(--na-space-4); align-content: start; }
    .panel { padding: var(--na-space-5); }
    .panel__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--na-space-3); }
    .panel__head h2 { font-size: var(--na-text-xl); }
    .panel__head a { font-weight: var(--na-font-semibold); min-height: 44px; display: inline-flex; align-items: center; }
    .rows { list-style: none; margin: var(--na-space-2) 0 0; padding: 0; display: grid; gap: var(--na-space-2); }
    .rows li { display: flex; justify-content: space-between; gap: var(--na-space-3); }
    .rules summary { cursor: pointer; font-weight: var(--na-font-semibold); min-height: 44px; display: flex; align-items: center; }
    .rules ul { margin: var(--na-space-3) 0 0; padding-left: var(--na-space-5); display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); }
    .side { padding: var(--na-space-5); position: sticky; top: var(--na-space-4); }
    .side h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-4); }
    .side__table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    .side__table td { padding: var(--na-space-1) 0; }
    .side__table td:last-child { text-align: right; font-weight: var(--na-font-medium); }
    .side__discount td { color: var(--na-success); }
    .side__total td { border-top: 1px solid var(--na-border); padding-top: var(--na-space-2); font-size: var(--na-text-lg); font-weight: var(--na-font-bold); }
    .consent { display: flex; gap: var(--na-space-2); align-items: flex-start; margin: var(--na-space-5) 0 var(--na-space-2); }
    .consent input { width: 22px; height: 22px; flex-shrink: 0; margin-top: 2px; }
    .consent label { font-size: var(--na-text-sm); }
    .pay { display: grid; gap: var(--na-space-3); margin-top: var(--na-space-4); border-top: 1px solid var(--na-border); padding-top: var(--na-space-4); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; order: -1; }
    }
  `,
})
export class ReviewPage {
  private readonly router = inject(Router);
  private readonly draftApi = inject(BookingDraftService);
  private readonly bookingApi = inject(BookingService);
  private readonly payments = inject(PaymentService);
  private readonly pricing = inject(PricingService);

  protected readonly steps = BOOKING_STEPS;
  protected readonly draft = this.draftApi.draft;
  protected readonly consent = signal(false);
  protected readonly consentError = signal(false);
  protected readonly paying = signal(false);
  protected readonly paymentError = signal<string | null>(null);

  /** Idempotency key is stable across retries so a retry never double-charges. */
  private readonly idempotencyKey = crypto.randomUUID();

  protected readonly breakdown = computed(() => {
    const d = this.draft();
    if (!d) return null;
    return this.pricing.computeBreakdown({
      fare: d.fare,
      returnFare: d.returnFare,
      passengerTypes: d.passengers.map((p) => p.passengerType),
      seats: d.seats,
      returnSeats: d.returnSeats,
      extras: d.extras,
      extraBags: d.baggagePieces.reduce((a, b) => a + b, 0),
      promoCode: d.criteria.promoCode,
    });
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

  protected totalExtraBags(d: BookingDraft): number {
    return d.baggagePieces.reduce((a, b) => a + b, 0);
  }

  protected pay(): void {
    const d = this.draft();
    const b = this.breakdown();
    if (!d || !b) return;
    if (!this.consent()) {
      this.consentError.set(true);
      return;
    }
    this.consentError.set(false);
    this.paymentError.set(null);
    this.paying.set(true);

    this.payments
      .tokenize()
      .pipe(switchMap((token) => this.payments.charge(token, b.total, b.currency, this.idempotencyKey)))
      .subscribe({
        next: ({ providerReference }) => {
          this.draftApi.setPaymentReference(providerReference);
          const current = this.draft();
          if (!current) {
            this.paying.set(false);
            this.paymentError.set('Your session expired after payment. Please contact support.');
            return;
          }
          this.bookingApi.confirmFromDraft(current).subscribe({
            next: (booking) => {
              this.paying.set(false);
              this.router.navigate(['/booking/confirmation'], {
                queryParams: { ref: booking.bookingReference },
              });
            },
            error: () => {
              this.paying.set(false);
              this.paymentError.set('Payment succeeded but the booking could not be saved. Please contact support.');
            },
          });
        },
        error: (err: { message?: string }) => {
          this.paying.set(false);
          this.paymentError.set(err?.message ?? 'The payment provider rejected the transaction.');
        },
      });
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
