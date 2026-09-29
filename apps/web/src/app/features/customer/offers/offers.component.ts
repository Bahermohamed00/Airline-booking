import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OffersService, type OfferFilter } from './services/offers.service';
import { FlightService } from '../../../core/services/flight.service';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { CabinClass, Fare, FlightOffer } from '../../../core/models/domain.model';
import type { SearchCriteria } from '../../../core/models/booking-flow.model';
import { NaSegmented, SegmentOption } from '../../../shared/ui/segmented.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';
import { cabinLabel } from '../../../shared/utils/cabin-label';

const CABIN_OPTIONS: SegmentOption[] = [
  { value: '', label: 'All cabins' },
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];

const SCOPE_OPTIONS: SegmentOption[] = [
  { value: '', label: 'All' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
];

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
}

function expiryLabel(endsAt: string, now = Date.now()): string {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 24 * 60 * 60 * 1000) return 'Ends today';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `Ends in ${days} days`;
}

@Component({
  selector: 'na-offers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NaSegmented, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState, NaRouteLine],
  template: `
    <section class="hero">
      <div class="na-container">
        <p class="hero__eyebrow">Special flight offers</p>
        <h1 class="hero__title">Exclusive fares, real flights</h1>
        <p class="hero__sub">Discover limited-time discounts on the NovaAir network and save on your next journey.</p>
      </div>
    </section>

    <div class="na-container body">
      <div class="filters" role="group" aria-label="Offer filters">
          <na-segmented ariaLabel="Cabin class" [options]="cabinOptions" [value]="cabin()" (valueChange)="setCabin($event)" />
          <na-segmented ariaLabel="Route scope" [options]="scopeOptions" [value]="scope()" (valueChange)="setScope($event)" />
      </div>

      @if (error()) {
        <na-alert tone="danger" title="Unable to load offers" icon="⚠">
          {{ error() }}
          <div class="retry">
            <na-button variant="secondary" size="sm" (clicked)="reload()">Try again</na-button>
          </div>
        </na-alert>
      } @else if (offers() === null) {
        <p class="na-text-muted" role="status">Loading offers…</p>
        <na-skeleton [rows]="[1, 2, 3]" height="12rem" />
      } @else if (offers()!.length === 0) {
        <na-empty-state
          title="No offers available at the moment"
          message="Check back soon — new promotions are added regularly."
          actionLabel="Search flights instead"
          (action)="goSearch()"
        />
      } @else {
        <div class="grid">
          @for (o of offers()!; track o.id) {
            <article class="na-card card">
              <div class="card__top">
                <na-badge tone="success">SAVE {{ o.discountPercentage }}%</na-badge>
                <span class="card__expiry" [class.card__expiry--urgent]="isUrgent(o)">{{ expiryOf(o) }}</span>
              </div>

              <h2 class="card__route">
                <span class="card__ep">
                  <span class="card__code">{{ o.flight.origin.iataCode }}</span>
                  <span class="card__city">{{ o.flight.origin.city }}</span>
                </span>
                <span class="card__path" aria-hidden="true">
                  <na-route-line [origin]="o.flight.origin.iataCode" [destination]="o.flight.destination.iataCode" />
                </span>
                <span class="card__ep card__ep--to">
                  <span class="card__code">{{ o.flight.destination.iataCode }}</span>
                  <span class="card__city">{{ o.flight.destination.city }}</span>
                </span>
              </h2>

              <p class="card__title">{{ o.title }}</p>
              @if (o.description) {
                <p class="card__desc">{{ o.description }}</p>
              }

              <dl class="card__meta">
                <div><dt>Flight</dt><dd>{{ o.flight.flightNumber }}</dd></div>
                <div><dt>Departure</dt><dd>{{ dateOf(o.flight.departureTime) }} · {{ timeOf(o.flight.departureTime) }}</dd></div>
                <div><dt>Cabin</dt><dd>{{ cabinName(o.cabinClass) }}</dd></div>
                <div>
                  <dt>Baggage</dt>
                  <dd>
                    {{ o.fare.baggage.checkedBaggagePieces }}× {{ o.fare.baggage.checkedBaggageWeightKg }}kg checked
                    + {{ o.fare.baggage.carryOnPieces }} carry-on
                  </dd>
                </div>
                <div><dt>Seats left</dt><dd>{{ o.fare.availableCount }}</dd></div>
              </dl>

              <div class="card__foot">
                <p class="card__pricing">
                  <s class="card__old">{{ money(o.fare.originalPrice, o.fare.currency) }}</s>
                  <span class="card__price">{{ money(o.fare.discountedPrice, o.fare.currency) }}</span>
                  <span class="card__per">per person</span>
                </p>
                <na-button
                  variant="cta"
                  [loading]="bookingId() === o.id"
                  [disabled]="bookingId() !== null"
                  (clicked)="bookNow(o)"
                >
                  Book now
                </na-button>
              </div>
            </article>
          }
        </div>
      }

      @if (bookingError()) {
        <na-alert tone="danger" title="Couldn't start booking" icon="⚠">{{ bookingError() }}</na-alert>
      }
    </div>
  `,
  styles: `
    .hero {
      background: var(--na-navy-800);
      padding: var(--na-space-12) 0;
      border-bottom: 1px solid var(--na-border);
    }
    .hero__eyebrow {
      color: var(--na-ink-300);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.24em;
      margin-bottom: var(--na-space-3);
    }
    .hero__title { color: var(--na-ink-900); font-size: clamp(2rem, 4vw + 1rem, 3rem); letter-spacing: -0.02em; margin-bottom: var(--na-space-3); }
    .hero__sub { color: var(--na-ink-100); font-size: var(--na-text-lg); max-width: 60ch; }
    .body { padding-top: var(--na-space-8); padding-bottom: var(--na-space-12); display: grid; gap: var(--na-space-6); }
    .filters { display: flex; flex-wrap: wrap; gap: var(--na-space-4); align-items: center; }
    .retry { margin-top: var(--na-space-3); }
    .grid { display: grid; gap: var(--na-space-5); grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .card { display: flex; flex-direction: column; gap: var(--na-space-4); padding: var(--na-space-5); }
    .card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3); }
    .card__expiry { color: var(--na-ink-500); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); text-transform: uppercase; letter-spacing: 0.08em; }
    .card__expiry--urgent { color: var(--na-danger, #c0392b); }
    .card__route { display: flex; align-items: center; gap: var(--na-space-4); margin: 0; }
    .card__ep { display: flex; flex-direction: column; }
    .card__ep--to { text-align: right; }
    .card__code { font-family: var(--na-font-display); font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); line-height: 1; }
    .card__city { color: var(--na-ink-500); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.12em; margin-top: var(--na-space-1); }
    .card__path { flex: 1; display: flex; justify-content: center; min-width: 60px; }
    .card__title { font-weight: var(--na-font-semibold); font-size: var(--na-text-base); margin: 0; }
    .card__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); margin: 0; }
    .card__meta {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-3) var(--na-space-4);
      margin: 0; padding: var(--na-space-3) 0; border-top: 1px solid var(--na-border); border-bottom: 1px solid var(--na-border);
    }
    .card__meta dt { color: var(--na-ink-500); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.08em; }
    .card__meta dd { margin: 0; font-size: var(--na-text-sm); font-weight: var(--na-font-medium); }
    .card__foot { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--na-space-4); margin-top: auto; flex-wrap: wrap; }
    .card__pricing { display: flex; align-items: baseline; gap: var(--na-space-2); margin: 0; flex-wrap: wrap; }
    .card__old { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .card__price { font-family: var(--na-font-display); font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); color: var(--na-blue-600); }
    .card__per { color: var(--na-ink-500); font-size: var(--na-text-xs); }
    @media (max-width: 639px) {
      .hero { padding: var(--na-space-8) 0; }
      .card__meta { grid-template-columns: 1fr; }
      .card__foot { flex-direction: column; align-items: stretch; }
      .card__foot na-button { display: contents; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card { transition: none; }
    }
  `,
})
export class OffersPage {
  private readonly router = inject(Router);
  private readonly offersApi = inject(OffersService);
  private readonly flightsApi = inject(FlightService);
  private readonly draft = inject(BookingDraftService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cabinOptions = CABIN_OPTIONS;
  protected readonly scopeOptions = SCOPE_OPTIONS;

  protected readonly offers = signal<FlightOffer[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly cabin = signal<CabinClass | ''>('');
  protected readonly scope = signal<'' | 'domestic' | 'international'>('');
  protected readonly bookingId = signal<string | null>(null);
  protected readonly bookingError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected setCabin(value: string): void {
    this.cabin.set(value as CabinClass | '');
    this.load();
  }

  protected setScope(value: string): void {
    this.scope.set(value as '' | 'domestic' | 'international');
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  private load(): void {
    this.offers.set(null);
    this.error.set(null);
    const filter: OfferFilter = { cabin: this.cabin(), scope: this.scope() };
    this.offersApi
      .listOffers(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.offers.set(list),
        error: () => {
          this.offers.set([]);
          this.error.set('Please check your connection and try again.');
        },
      });
  }

  protected bookNow(offer: FlightOffer): void {
    this.bookingId.set(offer.id);
    this.bookingError.set(null);
    this.flightsApi.getFlight(offer.flight.id).subscribe({
      next: (flight) => {
        if (!flight) {
          this.bookingId.set(null);
          this.bookingError.set('This flight is no longer available.');
          return;
        }
        const fare = flight.fares.find((f) => f.cabinClass === offer.cabinClass);
        if (!fare) {
          this.bookingId.set(null);
          this.bookingError.set('This fare is no longer available.');
          return;
        }
        // Carry the offer's discounted total into the booking flow by lowering
        // the fare's base price so base + tax + fee equals the offer price.
        const discountedBase = Math.max(
          0,
          Math.round((offer.fare.discountedPrice - fare.taxAmount - fare.feeAmount) * 100) / 100,
        );
        const offerFare: Fare = { ...fare, basePrice: discountedBase };

        const criteria: SearchCriteria = {
          tripType: 'ONE_WAY',
          originCode: offer.flight.origin.iataCode,
          destinationCode: offer.flight.destination.iataCode,
          departureDate: offer.flight.departureTime.slice(0, 10),
          returnDate: null,
          passengers: { adults: 1, children: 0, infants: 0 },
          cabinClass: offer.cabinClass,
          promoCode: null,
        };
        this.draft.start(criteria, flight, offerFare);
        this.bookingId.set(null);
        this.router.navigate(['/flights', flight.id]);
      },
      error: () => {
        this.bookingId.set(null);
        this.bookingError.set('The booking service is unavailable right now. Please try again.');
      },
    });
  }

  protected isUrgent(o: FlightOffer): boolean {
    return new Date(o.endsAt).getTime() - Date.now() <= 2 * 24 * 60 * 60 * 1000;
  }

  protected expiryOf(o: FlightOffer): string {
    return expiryLabel(o.endsAt);
  }

  protected money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  protected cabinName(c: CabinClass): string {
    return cabinLabel(c);
  }

  protected timeOf(iso: string): string {
    return timeLabel(iso);
  }

  protected dateOf(iso: string): string {
    return dateLabel(iso);
  }

  protected goSearch(): void {
    this.router.navigate(['/search']);
  }
}
