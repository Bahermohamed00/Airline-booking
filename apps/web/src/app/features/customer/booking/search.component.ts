import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { AIRPORTS } from '../../../core/mock/mock-data';
import type { CabinClass } from '../../../core/models/domain.model';
import type { SearchCriteria, TripType } from '../../../core/models/booking-flow.model';
import { NaSegmented, SegmentOption } from '../../../shared/ui/segmented.component';
import { NaAutocomplete, AutocompleteOption } from '../../../shared/ui/autocomplete.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaQuantityStepper } from '../../../shared/ui/quantity-stepper.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';

const RECENT_KEY = 'na-recent-searches';

interface PopularRoute {
  origin: string;
  destination: string;
  label: string;
}

interface MultiCityLegForm {
  origin: string;
  destination: string;
  date: string;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'na-search-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, NaSegmented, NaAutocomplete, NaButton, NaAlert, NaQuantityStepper, NaRouteLine],
  template: `
    <section class="hero">
      <div class="hero__bg" aria-hidden="true">
        <img ngSrc="assets/img/hero-wing.jpg" fill priority sizes="100vw" alt="" class="hero__img" />
        <div class="hero__scrim"></div>
      </div>

      <div class="na-container hero__inner">
        <p class="hero__eyebrow">Book flights</p>
        <h1 class="hero__title">Find your next journey</h1>
        <p class="hero__sub">
          Search the NovaAir network — honest fares, considered cabins, real booking flows on demo data.
        </p>

        <div class="na-card search-card" role="search" aria-label="Flight search">
          <div class="search-card__top">
            <div class="na-field search-card__trip">
              <span class="na-label">Trip type</span>
              <na-segmented
                ariaLabel="Trip type"
                [options]="tripOptions"
                [value]="tripType()"
                (valueChange)="setTripType($event)"
              />
            </div>
            <div class="na-field search-card__cabin">
              <label class="na-label" for="cabin">Cabin class</label>
              <select
                id="cabin"
                class="na-select"
                [value]="cabinClass()"
                (change)="cabinClass.set($any($event.target).value)"
              >
                <option value="ECONOMY">Economy</option>
                <option value="PREMIUM_ECONOMY">Premium Economy</option>
                <option value="BUSINESS">Business</option>
                <option value="FIRST">First</option>
              </select>
            </div>
          </div>

          @if (tripType() !== 'MULTI_CITY') {
            <div class="search-card__route">
              <na-autocomplete
                #fromField
                label="From"
                placeholder="City or airport"
                [options]="airportOptions"
                (selected)="origin.set($event.value)"
              />
              <button type="button" class="swap" (click)="swapAirports()" aria-label="Swap origin and destination">
                <span aria-hidden="true">⇄</span>
              </button>
              <na-autocomplete
                #toField
                label="To"
                placeholder="City or airport"
                [options]="airportOptions"
                (selected)="destination.set($event.value)"
              />
            </div>

            <div class="search-card__dates">
              <div class="na-field">
                <label class="na-label" for="depart">Departure</label>
                <input
                  id="depart"
                  class="na-input"
                  type="date"
                  [min]="minDate"
                  [value]="departureDate()"
                  (change)="departureDate.set($any($event.target).value)"
                />
              </div>
              @if (tripType() === 'ROUND_TRIP') {
                <div class="na-field">
                  <label class="na-label" for="return">Return</label>
                  <input
                    id="return"
                    class="na-input"
                    type="date"
                    [min]="departureDate()"
                    [value]="returnDate()"
                    (change)="returnDate.set($any($event.target).value)"
                  />
                </div>
              }
            </div>
          } @else {
            <div class="mc-legs">
              @for (leg of legs(); track $index; let i = $index) {
                <div class="mc-leg">
                  <span class="mc-leg__badge" aria-hidden="true">Leg {{ i + 1 }}</span>
                  <div class="mc-leg__fields">
                    <na-autocomplete
                      [label]="'Leg ' + (i + 1) + ' — From'"
                      placeholder="City or airport"
                      [options]="airportOptions"
                      (selected)="setLegAirport(i, 'origin', $event.value)"
                    />
                    <na-autocomplete
                      [label]="'Leg ' + (i + 1) + ' — To'"
                      placeholder="City or airport"
                      [options]="airportOptions"
                      (selected)="setLegAirport(i, 'destination', $event.value)"
                    />
                    <div class="na-field mc-leg__date">
                      <label class="na-label" [for]="'leg-date-' + i">Date</label>
                      <input
                        [id]="'leg-date-' + i"
                        class="na-input"
                        type="date"
                        [min]="i === 0 ? minDate : legs()[i - 1].date"
                        [value]="leg.date"
                        (change)="setLegDate(i, $any($event.target).value)"
                      />
                    </div>
                    @if (i === 2) {
                      <button type="button" class="mc-leg__remove" (click)="removeLeg()" aria-label="Remove third leg">×</button>
                    }
                  </div>
                </div>
              }
              @if (legs().length < 3) {
                <na-button variant="ghost" size="sm" (clicked)="addLeg()">+ Add a third leg</na-button>
              }
            </div>
          }

          <fieldset class="pax">
            <legend class="na-label">Passengers</legend>
            <div class="pax__row">
              @for (g of passengerGroups; track g.key) {
                <na-quantity-stepper
                  [label]="g.label"
                  [value]="counts()[g.key]"
                  [min]="g.min"
                  [max]="g.max"
                  (valueChange)="setCount(g.key, $event)"
                />
              }
            </div>
          </fieldset>

          @if (formError()) {
            <na-alert tone="danger" title="Check your search" icon="⚠">{{ formError() }}</na-alert>
          }

          <div class="search-card__footer">
            <div class="na-field search-card__promo">
              <label class="na-label" for="promo">Promo code <span class="na-hint">(optional)</span></label>
              <input
                id="promo"
                class="na-input"
                type="text"
                autocomplete="off"
                placeholder="e.g. NOVA10"
                [value]="promoCode()"
                (input)="promoCode.set($any($event.target).value)"
              />
            </div>
            <na-button variant="cta" size="lg" (clicked)="submit()">Search flights</na-button>
          </div>
        </div>
      </div>
    </section>

    <div class="na-container below">
      @if (recentSearches().length) {
        <section aria-labelledby="recent-h">
          <h2 id="recent-h">Recent searches</h2>
          <ul class="recent" role="list">
            @for (r of recentSearches(); track r.originCode + r.destinationCode + r.departureDate) {
              <li>
                <button type="button" class="recent__chip" (click)="goToResults(r)">
                  <span aria-hidden="true">🕘</span>
                  {{ r.originCode }} → {{ r.destinationCode }} · {{ prettyDate(r.departureDate) }}
                </button>
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="popular-h">
        <h2 id="popular-h">Popular routes</h2>
        <div class="popular">
          @for (p of popularRoutes; track p.origin + p.destination) {
            <button type="button" class="na-card popular__card" (click)="searchPopular(p)">
              <span class="popular__route" aria-hidden="true">
                <na-route-line [origin]="p.origin" [destination]="p.destination" />
              </span>
              <span class="popular__label">{{ p.label }}</span>
              <span class="popular__cta" aria-hidden="true">Search →</span>
            </button>
          }
        </div>
      </section>

      <na-alert tone="info" icon="ℹ" title="Travel advisory" [dismissible]="advisoryDismissed()" (dismissed)="advisoryDismissed.set(true)">
        Demo notice: some routes operate with reduced frequency this week. Arrive at the airport at least 2 hours before departure.
      </na-alert>
    </div>
  `,
  styles: `
    /* Hero is a photographic dark zone in BOTH themes: its text uses the fixed
       brand cream (--na-cream and its alpha family), never the flipping ink tokens. */
    .hero {
      position: relative; overflow: hidden;
      background: var(--na-brown-900);
      padding: var(--na-space-16) 0;
    }
    .hero__bg { position: absolute; inset: 0; pointer-events: none; }
    .hero__img { object-fit: cover; object-position: center 30%; }
    .hero__scrim {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.66) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.7) 100%);
    }
    .hero__inner { position: relative; z-index: 1; }
    .hero__eyebrow {
      color: rgba(225, 220, 201, 0.66);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.24em;
      margin-bottom: var(--na-space-4);
    }
    .hero__title {
      color: var(--na-cream);
      font-size: clamp(2.5rem, 5vw + 1rem, 4rem);
      letter-spacing: -0.02em;
      margin-bottom: var(--na-space-4);
    }
    .hero__sub {
      color: rgba(225, 220, 201, 0.8);
      font-size: var(--na-text-lg); max-width: 56ch;
      margin-bottom: var(--na-space-10);
    }
    .search-card {
      padding: var(--na-space-8);
      box-shadow: var(--na-shadow-lg);
      display: grid; gap: var(--na-space-6);
      color: var(--na-ink-900);
    }
    .search-card .na-field { margin-bottom: 0; }
    .search-card .na-label {
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.08em; color: var(--na-ink-500);
    }
    .search-card .na-label .na-hint {
      text-transform: none; letter-spacing: 0; font-weight: var(--na-font-regular);
    }
    .search-card .na-input, .search-card .na-select { min-height: 48px; }
    .search-card__top {
      display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--na-space-4) var(--na-space-6);
      background: var(--na-surface-sunken); border: 1px solid var(--na-border);
      border-radius: var(--na-radius-lg); padding: var(--na-space-4);
    }
    .search-card__cabin { flex: 0 1 220px; min-width: 180px; margin-left: auto; }
    .search-card__route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: var(--na-space-3); }
    .swap {
      width: 40px; height: 40px; margin-bottom: var(--na-space-1);
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid var(--na-border-strong); border-radius: var(--na-radius-full);
      background: var(--na-surface-sunken); color: var(--na-ink-900);
      transition: transform var(--na-motion-base) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease);
    }
    .swap span { font-size: var(--na-text-lg); line-height: 1; }
    .swap:hover { transform: rotate(180deg); border-color: var(--na-navy-300); }
    .search-card__dates { display: flex; flex-wrap: wrap; gap: var(--na-space-4); }
    .search-card__dates .na-field { flex: 1 1 180px; max-width: 260px; }
    .mc-legs { display: grid; gap: var(--na-space-3); justify-items: start; }
    .mc-leg { width: 100%; display: grid; grid-template-columns: auto 1fr; gap: var(--na-space-3); align-items: start; }
    .mc-leg__badge {
      margin-top: var(--na-space-8); padding: var(--na-space-1) var(--na-space-3);
      background: var(--na-surface-sunken); border: 1px solid var(--na-border); border-radius: var(--na-radius-full);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); color: var(--na-ink-500); white-space: nowrap;
    }
    .mc-leg__fields { display: grid; grid-template-columns: 1fr 1fr minmax(150px, 200px) auto; gap: var(--na-space-3); align-items: end; }
    .mc-leg__fields .na-field { margin-bottom: 0; }
    .mc-leg__remove {
      width: 40px; height: 40px; margin-bottom: var(--na-space-1);
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid var(--na-border-strong); border-radius: var(--na-radius-full);
      background: var(--na-surface-sunken); color: var(--na-ink-700); font-size: var(--na-text-lg); line-height: 1;
    }
    .mc-leg__remove:hover { border-color: var(--na-danger); color: var(--na-danger); }
    .pax { border: none; padding: 0; margin: 0; }
    .pax legend { padding: 0; margin-bottom: var(--na-space-3); }
    .pax__row { display: flex; flex-wrap: wrap; gap: var(--na-space-4) var(--na-space-6); }
    .search-card__footer { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--na-space-4); }
    .search-card__promo { flex: 0 1 260px; }
    .search-card__footer na-button { flex-shrink: 0; }
    .below { padding-top: var(--na-space-10); padding-bottom: var(--na-space-12); display: grid; gap: var(--na-space-10); }
    .below h2 { margin-bottom: var(--na-space-5); }
    .recent { list-style: none; display: flex; flex-wrap: wrap; gap: var(--na-space-3); padding: 0; margin: 0; }
    .recent__chip {
      border: 1px solid var(--na-border-strong); background: var(--na-surface-raised);
      border-radius: var(--na-radius-full); padding: var(--na-space-2) var(--na-space-4); min-height: 44px;
      font-weight: var(--na-font-medium); color: var(--na-ink-700);
      transition: border-color var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease);
    }
    .recent__chip:hover { border-color: var(--na-navy-300); background: var(--na-surface-sunken); }
    .popular { display: grid; gap: var(--na-space-4); grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .popular__card {
      display: flex; flex-direction: column; gap: var(--na-space-2); text-align: left;
      padding: var(--na-space-5); cursor: pointer; font: inherit; color: var(--na-ink-900);
      transition: transform var(--na-motion-fast) var(--na-ease), box-shadow var(--na-motion-fast) var(--na-ease);
    }
    .popular__card:hover { transform: translateY(-2px); box-shadow: var(--na-shadow-md); }
    .popular__route { display: block; }
    .popular__label { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .popular__cta { color: var(--na-blue-600); font-size: var(--na-text-sm); font-weight: var(--na-font-semibold); margin-top: var(--na-space-3); }
    @media (max-width: 639px) {
      .hero { padding: var(--na-space-10) 0 var(--na-space-12); }
      .hero__sub { margin-bottom: var(--na-space-8); }
      .search-card { padding: var(--na-space-5); gap: var(--na-space-5); }
      .search-card__top { flex-direction: column; align-items: stretch; }
      .search-card__trip { min-width: 0; }
      .search-card__trip na-segmented { display: block; overflow-x: auto; }
      .search-card__cabin { flex: 1 1 auto; min-width: 0; margin-left: 0; }
      .search-card__route { grid-template-columns: 1fr; }
      .swap { justify-self: center; margin-bottom: 0; transform: rotate(90deg); }
      .swap:hover { transform: rotate(270deg); }
      .search-card__dates { flex-direction: column; }
      .search-card__dates .na-field { max-width: none; }
      .mc-leg { grid-template-columns: 1fr; }
      .mc-leg__badge { margin-top: 0; justify-self: start; }
      .mc-leg__fields { grid-template-columns: 1fr; }
      .mc-leg__remove { justify-self: end; margin-bottom: 0; }
      .search-card__footer { flex-direction: column; align-items: stretch; }
      .search-card__promo { flex: 1 1 auto; }
      .search-card__footer na-button { display: contents; }
    }
  `,
})
export class SearchPage {
  private readonly router = inject(Router);

  private readonly fromField = viewChild('fromField', { read: NaAutocomplete });
  private readonly toField = viewChild('toField', { read: NaAutocomplete });

  protected readonly tripOptions: SegmentOption[] = [
    { value: 'ONE_WAY', label: 'One way' },
    { value: 'ROUND_TRIP', label: 'Round trip' },
    { value: 'MULTI_CITY', label: 'Multi-city' },
  ];

  protected readonly airportOptions: AutocompleteOption[] = AIRPORTS.filter((a) => a.status === 'ACTIVE').map(
    (a) => ({
      value: a.iataCode,
      label: `${a.iataCode} — ${a.name}`,
      hint: `${a.city}, ${a.country}`,
    }),
  );

  protected readonly passengerGroups = [
    { key: 'adults' as const, label: 'Adults (12+)', min: 1, max: 9 },
    { key: 'children' as const, label: 'Children (2–11)', min: 0, max: 8 },
    { key: 'infants' as const, label: 'Infants (under 2)', min: 0, max: 4 },
  ];

  protected readonly popularRoutes: PopularRoute[] = [
    { origin: 'FRA', destination: 'JFK', label: 'Frankfurt to New York' },
    { origin: 'FRA', destination: 'DXB', label: 'Frankfurt to Dubai' },
    { origin: 'MUC', destination: 'LHR', label: 'Munich to London' },
  ];

  protected readonly minDate = toDateInput(new Date());

  protected readonly tripType = signal<TripType>('ONE_WAY');

  setTripType(value: string): void {
    if (value === 'ONE_WAY' || value === 'ROUND_TRIP' || value === 'MULTI_CITY') {
      this.tripType.set(value);
    }
  }
  protected readonly origin = signal('');
  protected readonly destination = signal('');
  protected readonly departureDate = signal(toDateInput(new Date(Date.now() + 86400000)));
  protected readonly returnDate = signal(toDateInput(new Date(Date.now() + 5 * 86400000)));
  protected readonly cabinClass = signal<CabinClass>('ECONOMY');
  protected readonly promoCode = signal('');
  protected readonly counts = signal({ adults: 1, children: 0, infants: 0 });
  protected readonly legs = signal<MultiCityLegForm[]>([
    { origin: '', destination: '', date: toDateInput(new Date(Date.now() + 86400000)) },
    { origin: '', destination: '', date: toDateInput(new Date(Date.now() + 4 * 86400000)) },
  ]);
  protected readonly formError = signal<string | null>(null);
  protected readonly advisoryDismissed = signal(false);
  protected readonly recentSearches = signal<SearchCriteria[]>(this.loadRecent());

  protected setCount(key: 'adults' | 'children' | 'infants', value: number): void {
    const group = this.passengerGroups.find((g) => g.key === key)!;
    this.counts.update((c) => {
      const next = Math.min(group.max, Math.max(group.min, value));
      const updated = { ...c, [key]: next };
      if (updated.infants > updated.adults) updated.infants = updated.adults;
      return updated;
    });
  }

  protected swapAirports(): void {
    const from = this.fromField();
    const to = this.toField();
    if (from && to) {
      const fromText = from.text();
      from.text.set(to.text());
      to.text.set(fromText);
    }
    const origin = this.origin();
    this.origin.set(this.destination());
    this.destination.set(origin);
  }

  protected setLegAirport(index: number, key: 'origin' | 'destination', value: string): void {
    this.legs.update((list) => list.map((leg, i) => (i === index ? { ...leg, [key]: value } : leg)));
  }

  protected setLegDate(index: number, value: string): void {
    this.legs.update((list) => list.map((leg, i) => (i === index ? { ...leg, date: value } : leg)));
  }

  protected addLeg(): void {
    this.legs.update((list) =>
      list.length >= 3
        ? list
        : [...list, { origin: '', destination: '', date: toDateInput(new Date(Date.now() + 7 * 86400000)) }],
    );
  }

  protected removeLeg(): void {
    this.legs.update((list) => (list.length > 2 ? list.slice(0, 2) : list));
  }

  private validateLegs(): string | null {
    const legs = this.legs();
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (!leg.origin || !leg.destination) return `Please choose an origin and a destination for leg ${i + 1}.`;
      if (leg.origin === leg.destination) return `Origin and destination must be different on leg ${i + 1}.`;
      if (!leg.date) return `Please pick a date for leg ${i + 1}.`;
      if (i > 0 && leg.date < legs[i - 1].date) return 'Legs must be in chronological order.';
    }
    return null;
  }

  protected submit(): void {
    if (this.tripType() === 'MULTI_CITY') {
      const legError = this.validateLegs();
      if (legError) {
        this.formError.set(legError);
        return;
      }
      this.formError.set(null);
      const legs = this.legs();
      const criteria: SearchCriteria = {
        tripType: 'MULTI_CITY',
        originCode: legs[0].origin,
        destinationCode: legs[0].destination,
        departureDate: legs[0].date,
        returnDate: null,
        passengers: this.counts(),
        cabinClass: this.cabinClass(),
        promoCode: this.promoCode().trim() || null,
        legs: legs.map((l) => ({ originCode: l.origin, destinationCode: l.destination, departureDate: l.date })),
      };
      this.remember(criteria);
      this.goToResults(criteria);
      return;
    }
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) {
      this.formError.set('Please choose an origin and a destination airport.');
      return;
    }
    if (origin === destination) {
      this.formError.set('Origin and destination must be different.');
      return;
    }
    if (!this.departureDate()) {
      this.formError.set('Please pick a departure date.');
      return;
    }
    this.formError.set(null);

    const criteria: SearchCriteria = {
      tripType: this.tripType(),
      originCode: origin,
      destinationCode: destination,
      departureDate: this.departureDate(),
      returnDate: this.tripType() === 'ROUND_TRIP' ? this.returnDate() : null,
      passengers: this.counts(),
      cabinClass: this.cabinClass(),
      promoCode: this.promoCode().trim() || null,
    };
    this.remember(criteria);
    this.goToResults(criteria);
  }

  protected searchPopular(route: PopularRoute): void {
    const criteria: SearchCriteria = {
      tripType: 'ONE_WAY',
      originCode: route.origin,
      destinationCode: route.destination,
      departureDate: this.departureDate(),
      returnDate: null,
      passengers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'ECONOMY',
      promoCode: null,
    };
    this.remember(criteria);
    this.goToResults(criteria);
  }

  protected goToResults(c: SearchCriteria): void {
    const legParams: Record<string, string> = {};
    c.legs?.forEach((leg, i) => {
      legParams[`leg${i + 1}Origin`] = leg.originCode;
      legParams[`leg${i + 1}Destination`] = leg.destinationCode;
      legParams[`leg${i + 1}Date`] = leg.departureDate;
    });
    this.router.navigate(['/results'], {
      queryParams: {
        tripType: c.tripType,
        origin: c.originCode,
        destination: c.destinationCode,
        depart: c.departureDate,
        return: c.returnDate ?? undefined,
        adults: c.passengers.adults,
        children: c.passengers.children,
        infants: c.passengers.infants,
        cabin: c.cabinClass,
        promo: c.promoCode ?? undefined,
        ...legParams,
      },
    });
  }

  protected prettyDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  private remember(c: SearchCriteria): void {
    const list = [c, ...this.recentSearches().filter(
      (r) => !(r.originCode === c.originCode && r.destinationCode === c.destinationCode && r.departureDate === c.departureDate),
    )].slice(0, 3);
    this.recentSearches.set(list);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // storage unavailable — recent searches just stay in memory
    }
  }

  private loadRecent(): SearchCriteria[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as SearchCriteria[]) : [];
    } catch {
      return [];
    }
  }
}
