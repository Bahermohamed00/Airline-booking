import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AIRPORTS } from '../../../core/mock/mock-data';
import type { CabinClass } from '../../../core/models/domain.model';
import type { SearchCriteria, TripType } from '../../../core/models/booking-flow.model';
import { NaSegmented, SegmentOption } from '../../../shared/ui/segmented.component';
import { NaAutocomplete, AutocompleteOption } from '../../../shared/ui/autocomplete.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';

const RECENT_KEY = 'na-recent-searches';

interface PopularRoute {
  origin: string;
  destination: string;
  label: string;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'na-search-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NaSegmented, NaAutocomplete, NaButton, NaAlert],
  template: `
    <section class="hero">
      <div class="na-container">
        <h1 class="hero__title">Where to next?</h1>
        <p class="hero__sub">Book flights across the NovaAir network — demo data, real flows.</p>

        <div class="na-card search-card" role="search" aria-label="Flight search">
          <na-segmented
            ariaLabel="Trip type"
            [options]="tripOptions"
            [value]="tripType()"
            (valueChange)="setTripType($event)"
          />

          <div class="search-grid">
            <na-autocomplete
              label="From"
              placeholder="City or airport"
              [options]="airportOptions"
              (selected)="origin.set($event.value)"
            />
            <na-autocomplete
              label="To"
              placeholder="City or airport"
              [options]="airportOptions"
              (selected)="destination.set($event.value)"
            />
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
            <div class="na-field">
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

          <fieldset class="pax">
            <legend class="na-label">Passengers</legend>
            <div class="pax__row">
              @for (g of passengerGroups; track g.key) {
                <div class="pax__group">
                  <span class="pax__label" [id]="'pax-label-' + g.key">{{ g.label }}</span>
                  <div class="pax__stepper" role="group" [attr.aria-labelledby]="'pax-label-' + g.key">
                    <button
                      type="button"
                      class="pax__btn"
                      [attr.aria-label]="'Decrease ' + g.label"
                      [disabled]="counts()[g.key] <= g.min"
                      (click)="bump(g.key, -1)"
                    >−</button>
                    <span class="pax__count" aria-live="polite">{{ counts()[g.key] }}</span>
                    <button
                      type="button"
                      class="pax__btn"
                      [attr.aria-label]="'Increase ' + g.label"
                      [disabled]="counts()[g.key] >= g.max"
                      (click)="bump(g.key, 1)"
                    >+</button>
                  </div>
                </div>
              }
              <div class="na-field pax__promo">
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
            </div>
          </fieldset>

          @if (formError()) {
            <na-alert tone="danger" title="Check your search" icon="⚠">{{ formError() }}</na-alert>
          }

          <div class="search-card__actions">
            <na-button variant="cta" size="lg" (clicked)="submit()">Search flights</na-button>
          </div>
        </div>

        <na-alert tone="info" icon="ℹ" title="Travel advisory" [dismissible]="advisoryDismissed()" (dismissed)="advisoryDismissed.set(true)">
          Demo notice: some routes operate with reduced frequency this week. Arrive at the airport at least 2 hours before departure.
        </na-alert>
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
              <span class="popular__codes">{{ p.origin }} → {{ p.destination }}</span>
              <span class="popular__label">{{ p.label }}</span>
              <span class="popular__cta" aria-hidden="true">Search →</span>
            </button>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .hero {
      background: linear-gradient(160deg, var(--na-navy-800), var(--na-navy-600));
      color: var(--na-cta-contrast);
      padding: var(--na-space-12) 0 var(--na-space-16);
    }
    .hero__title { color: var(--na-cta-contrast); margin-bottom: var(--na-space-2); }
    .hero__sub { color: var(--na-ink-100); margin-bottom: var(--na-space-8); }
    .search-card { padding: var(--na-space-6); color: var(--na-ink-900); }
    .search-grid {
      display: grid; gap: var(--na-space-4); margin-top: var(--na-space-5);
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      align-items: end;
    }
    .search-grid .na-field { margin-bottom: 0; }
    .pax { border: none; padding: 0; margin: var(--na-space-5) 0 0; }
    .pax__row { display: flex; flex-wrap: wrap; gap: var(--na-space-6); align-items: flex-end; margin-top: var(--na-space-2); }
    .pax__group { display: flex; flex-direction: column; gap: var(--na-space-1); }
    .pax__label { font-size: var(--na-text-sm); color: var(--na-ink-700); }
    .pax__stepper { display: inline-flex; align-items: center; gap: var(--na-space-2); }
    .pax__btn {
      width: 40px; height: 40px; border-radius: var(--na-radius-md);
      border: 1px solid var(--na-border-strong); background: var(--na-surface-raised);
      font-size: var(--na-text-lg); font-weight: var(--na-font-semibold);
    }
    .pax__btn:hover:not(:disabled) { border-color: var(--na-navy-400); background: var(--na-surface-sunken); }
    .pax__count { min-width: 2ch; text-align: center; font-weight: var(--na-font-semibold); }
    .pax__promo { min-width: 200px; margin-bottom: 0; }
    .search-card__actions { margin-top: var(--na-space-6); display: flex; justify-content: flex-end; }
    .hero na-alert { margin-top: var(--na-space-4); display: block; }
    .below { padding-top: var(--na-space-8); padding-bottom: var(--na-space-12); display: grid; gap: var(--na-space-8); }
    .below h2 { margin-bottom: var(--na-space-4); }
    .recent { list-style: none; display: flex; flex-wrap: wrap; gap: var(--na-space-3); padding: 0; margin: 0; }
    .recent__chip {
      border: 1px solid var(--na-border-strong); background: var(--na-surface-raised);
      border-radius: var(--na-radius-full); padding: 0.5rem 1rem; min-height: 44px;
      font-weight: var(--na-font-medium); color: var(--na-ink-700);
    }
    .recent__chip:hover { border-color: var(--na-navy-400); background: var(--na-surface-sunken); }
    .popular { display: grid; gap: var(--na-space-4); grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .popular__card {
      display: flex; flex-direction: column; gap: var(--na-space-1); text-align: left;
      padding: var(--na-space-5); cursor: pointer; font: inherit;
      transition: box-shadow var(--na-motion-fast) var(--na-ease);
    }
    .popular__card:hover { box-shadow: var(--na-shadow-md); }
    .popular__codes { font-weight: var(--na-font-bold); font-size: var(--na-text-lg); color: var(--na-navy-700); }
    .popular__label { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .popular__cta { color: var(--na-blue-600); font-size: var(--na-text-sm); font-weight: var(--na-font-semibold); margin-top: var(--na-space-2); }
    @media (max-width: 639px) {
      .hero { padding: var(--na-space-8) 0 var(--na-space-12); }
      .search-card { padding: var(--na-space-4); }
      .search-card__actions { justify-content: stretch; }
      .search-card__actions na-button { width: 100%; }
    }
  `,
})
export class SearchPage {
  private readonly router = inject(Router);

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
  protected readonly formError = signal<string | null>(null);
  protected readonly advisoryDismissed = signal(false);
  protected readonly recentSearches = signal<SearchCriteria[]>(this.loadRecent());

  protected bump(key: 'adults' | 'children' | 'infants', delta: number): void {
    const group = this.passengerGroups.find((g) => g.key === key)!;
    this.counts.update((c) => {
      const next = Math.min(group.max, Math.max(group.min, c[key] + delta));
      const updated = { ...c, [key]: next };
      if (updated.infants > updated.adults) updated.infants = updated.adults;
      return updated;
    });
  }

  protected submit(): void {
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
