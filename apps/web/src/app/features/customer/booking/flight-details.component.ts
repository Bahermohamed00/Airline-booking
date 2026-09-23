import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { FlightService, flightDurationLabel } from '../../../core/services/flight.service';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { CabinClass, Fare, Flight } from '../../../core/models/domain.model';
import type { SearchCriteria } from '../../../core/models/booking-flow.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaTimeline, TimelineEvent } from '../../../shared/ui/timeline.component';

function cabinLabel(c: CabinClass): string {
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

@Component({
  selector: 'na-flight-details-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NaButton, NaBadge, NaSkeleton, NaEmptyState, NaTimeline],
  template: `
    <div class="na-container page">
      @if (flight() === undefined) {
        <na-skeleton [rows]="[1, 2, 3]" height="110px" />
      } @else if (flight() === null) {
        <na-empty-state
          icon="✈"
          title="Flight not found"
          message="This flight could not be loaded. It may no longer be bookable."
          actionLabel="Back to search"
          (action)="goSearch()"
        />
      } @else if (flight(); as f) {
          <nav class="back" aria-label="Breadcrumb">
            <a routerLink="/results" [queryParams]="backParams()">← Back to results</a>
          </nav>

          <header class="head">
            <div>
              <h1>{{ f.route.origin.iataCode }} → {{ f.route.destination.iataCode }}</h1>
              <p class="na-text-muted">
                {{ f.flightNumber }} · {{ prettyDate(f.departureTime) }} · {{ duration(f) }} ·
                {{ f.aircraft.model }} ({{ f.aircraft.registration }})
              </p>
            </div>
          </header>

          <div class="layout">
            <section class="na-card panel" aria-labelledby="route-h">
              <h2 id="route-h">Itinerary</h2>
              <na-timeline [events]="timelineEvents(f)" />
              <dl class="facts">
                <div><dt>Aircraft</dt><dd>{{ f.aircraft.model }}</dd></div>
                <div><dt>Registration</dt><dd>{{ f.aircraft.registration }}</dd></div>
                <div><dt>Capacity</dt><dd>{{ f.aircraft.capacity }} seats</dd></div>
                <div><dt>Distance</dt><dd>{{ f.route.distanceKm }} km</dd></div>
              </dl>
            </section>

            <section aria-labelledby="fares-h">
              <h2 id="fares-h">Choose your fare</h2>
              <div class="fares">
                @for (fare of f.fares; track fare.id) {
                  <article class="na-card fare" [class.fare--soldout]="fare.availableCount === 0">
                    <header class="fare__head">
                      <h3>{{ label(fare.cabinClass) }}</h3>
                      <div class="fare__badges">
                        <na-badge [tone]="fare.rules.refundable ? 'success' : 'neutral'">
                          {{ fare.rules.refundable ? 'Refundable' : 'Non-refundable' }}
                        </na-badge>
                        @if (fare.rules.priorityBoarding) { <na-badge tone="info">Priority boarding</na-badge> }
                        @if (fare.rules.loungeAccess) { <na-badge tone="info">Lounge access</na-badge> }
                      </div>
                    </header>
                    <p class="na-text-small na-text-muted">{{ fare.rules.description }}</p>
                    <ul class="fare__rules">
                      <li>{{ fare.rules.refundable ? 'Free cancellation (fee ' + fare.rules.cancellationFeePercent + '%)' : 'Non-refundable ticket' }}</li>
                      <li>{{ fare.rules.changeAllowed ? 'Changes allowed' + (fare.rules.changeFee ? ' — fee ' + money(fare.rules.changeFee, fare) : ' — free') : 'Changes not allowed' }}</li>
                      <li>{{ fare.rules.checkedBaggagePieces }}× checked bag up to {{ fare.rules.checkedBaggageWeightKg }} kg + {{ fare.rules.carryOnPieces }}× carry-on</li>
                      <li>{{ fare.rules.seatSelectionFee === 0 ? 'Seat selection included' : 'Seat selection from ' + money(fare.rules.seatSelectionFee, fare) }}</li>
                    </ul>
                    <table class="fare__breakdown">
                      <tbody>
                        <tr><td>Base fare</td><td>{{ money(fare.basePrice, fare) }}</td></tr>
                        <tr><td>Taxes</td><td>{{ money(fare.taxAmount, fare) }}</td></tr>
                        <tr><td>Fees</td><td>{{ money(fare.feeAmount, fare) }}</td></tr>
                        <tr class="fare__total"><td>Total per adult</td><td>{{ money(fare.basePrice + fare.taxAmount + fare.feeAmount, fare) }}</td></tr>
                      </tbody>
                    </table>
                    @if (fare.availableCount === 0) {
                      <p class="fare__soldout">Sold out</p>
                    } @else {
                      @if (fare.availableCount < 5) {
                        <na-badge tone="warning">Only {{ fare.availableCount }} left</na-badge>
                      }
                      <na-button variant="cta" (clicked)="continueWith(f, fare)">Continue with this fare</na-button>
                    }
                  </article>
                }
              </div>
            </section>
          </div>
        }
    </div>
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); }
    .back { margin-bottom: var(--na-space-4); }
    .back a { min-height: 44px; display: inline-flex; align-items: center; font-weight: var(--na-font-semibold); }
    .head { margin-bottom: var(--na-space-6); }
    .head h1 { margin-bottom: var(--na-space-1); }
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: var(--na-space-6); align-items: start; }
    .panel { padding: var(--na-space-5); }
    .panel h2 { margin-bottom: var(--na-space-5); font-size: var(--na-text-xl); }
    .facts { display: grid; gap: var(--na-space-2); margin: var(--na-space-5) 0 0; padding-top: var(--na-space-4); border-top: 1px solid var(--na-border); }
    .facts div { display: flex; justify-content: space-between; gap: var(--na-space-3); }
    .facts dt { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .facts dd { margin: 0; font-weight: var(--na-font-medium); font-size: var(--na-text-sm); }
    .fares { display: grid; gap: var(--na-space-4); margin-top: var(--na-space-4); }
    .fare { padding: var(--na-space-5); display: grid; gap: var(--na-space-3); align-content: start; }
    .fare--soldout { opacity: 0.7; }
    .fare__head { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-3); flex-wrap: wrap; }
    .fare__badges { display: flex; gap: var(--na-space-2); flex-wrap: wrap; }
    .fare__rules { margin: 0; padding-left: var(--na-space-5); display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); color: var(--na-ink-700); }
    .fare__breakdown { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    .fare__breakdown td { padding: var(--na-space-1) 0; }
    .fare__breakdown td:last-child { text-align: right; font-weight: var(--na-font-medium); }
    .fare__total td { border-top: 1px solid var(--na-border); padding-top: var(--na-space-2); font-weight: var(--na-font-bold); }
    .fare__soldout { color: var(--na-danger); font-weight: var(--na-font-semibold); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
  `,
})
export class FlightDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flightsApi = inject(FlightService);
  private readonly draft = inject(BookingDraftService);

  /** undefined = loading, null = not found */
  protected readonly flight = signal<Flight | null | undefined>(undefined);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => this.flightsApi.getFlight(params.get('id') ?? '')),
        takeUntilDestroyed(),
      )
      .subscribe((f) => this.flight.set(f ?? null));
  }

  protected continueWith(flight: Flight, fare: Fare): void {
    const existing = this.draft.criteria();
    const criteria: SearchCriteria =
      existing && existing.originCode === flight.route.origin.iataCode
        ? existing
        : {
            tripType: 'ONE_WAY',
            originCode: flight.route.origin.iataCode,
            destinationCode: flight.route.destination.iataCode,
            departureDate: flight.departureTime.slice(0, 10),
            returnDate: null,
            passengers: { adults: 1, children: 0, infants: 0 },
            cabinClass: fare.cabinClass,
            promoCode: null,
          };
    this.draft.start(criteria, flight, fare);
    this.router.navigate(['/booking/passengers']);
  }

  protected backParams(): Record<string, string | number | null> {
    const c = this.draft.criteria();
    if (!c) return {};
    return {
      tripType: c.tripType,
      origin: c.originCode,
      destination: c.destinationCode,
      depart: c.departureDate,
      return: c.returnDate ?? null,
      adults: c.passengers.adults,
      children: c.passengers.children,
      infants: c.passengers.infants,
      cabin: c.cabinClass,
      promo: c.promoCode ?? null,
    };
  }

  protected timelineEvents(f: Flight): TimelineEvent[] {
    return [
      {
        label: `Departure — ${f.route.origin.iataCode} ${f.route.origin.name}`,
        detail: `${f.route.origin.city}, ${f.route.origin.country}`,
        timestamp: this.fullDate(f.departureTime),
        tone: 'info',
      },
      {
        label: `Arrival — ${f.route.destination.iataCode} ${f.route.destination.name}`,
        detail: `${f.route.destination.city}, ${f.route.destination.country} · total ${flightDurationLabel(f)}`,
        timestamp: this.fullDate(f.arrivalTime),
        tone: 'success',
      },
    ];
  }

  protected duration(f: Flight): string {
    return flightDurationLabel(f);
  }

  protected prettyDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  }

  protected fullDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected label(c: CabinClass): string {
    return cabinLabel(c);
  }

  protected money(amount: number, fare: Fare): string {
    return formatMoney(amount, fare.currency);
  }

  protected goSearch(): void {
    this.router.navigate(['/search']);
  }
}
