import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlightService, applyFilters, applySort, flightDurationLabel } from '../../../core/services/flight.service';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { Fare, Flight, CabinClass } from '../../../core/models/domain.model';
import type { ResultFilters, ResultSort, SearchCriteria, TripType } from '../../../core/models/booking-flow.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaSegmented, SegmentOption } from '../../../shared/ui/segmented.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';

interface AdjacentDay {
  date: string;
  minPrice: number | null;
}

function cabinLabel(c: CabinClass): string {
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

@Component({
  selector: 'na-results-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState, NaSegmented, NaRouteLine],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="na-container page">
      @if (criteria(); as c) {
        <h1>Flight results</h1>
        <p class="page__sub na-text-muted">Pick the flight and fare that suit you best.</p>

        <div class="summary">
          <na-route-line [origin]="c.originCode" [destination]="c.destinationCode" />
          <p class="summary__meta">
            {{ prettyDate(c.departureDate) }}
            @if (c.returnDate) { – {{ prettyDate(c.returnDate) }} }
            · {{ passengerLabel(c) }} · {{ cabinName(c.cabinClass) }}
          </p>
          <a routerLink="/search" class="summary__edit">Modify search</a>
        </div>

        @if (c.tripType === 'ROUND_TRIP' && c.returnDate) {
          <na-alert tone="info" icon="ℹ" title="Outbound flights only" class="roundtrip-note">
            Round-trip booking isn't available yet — these results cover your outbound journey on
            {{ prettyDate(c.departureDate) }} only. The return leg can't be booked for now.
          </na-alert>
        }

        <div class="dates" role="group" aria-label="Nearby dates">
          @for (d of adjacent(); track d.date) {
            <button
              type="button"
              class="dates__day"
              [class.dates__day--active]="d.date === c.departureDate"
              [attr.aria-pressed]="d.date === c.departureDate"
              [disabled]="d.minPrice === null && d.date !== c.departureDate"
              (click)="pickDate(d.date)"
            >
              <span class="dates__dow">{{ weekday(d.date) }}</span>
              <span class="dates__date">{{ shortDate(d.date) }}</span>
              <span class="dates__price">{{ d.minPrice === null ? '—' : money(d.minPrice) }}</span>
            </button>
          }
        </div>

        <div class="layout">
          <aside
            id="filters-panel"
            class="na-card filters"
            [class.filters--open]="filtersOpen()"
            aria-label="Filters"
            [attr.role]="filtersOpen() ? 'dialog' : null"
            [attr.aria-modal]="filtersOpen() ? 'true' : null"
          >
            <div class="filters__head">
              <h2 class="filters__title">Filters</h2>
              <button
                #filtersClose
                type="button"
                class="filters__close"
                aria-label="Close filters"
                (click)="closeFilters()"
              >×</button>
            </div>
            <div class="filters__group">
              <div class="na-field">
                <label class="na-label" for="maxPrice">Max price (EUR)</label>
                <input
                  id="maxPrice"
                  class="na-input"
                  type="number"
                  min="0"
                  placeholder="No limit"
                  [value]="filters().maxPrice ?? ''"
                  (input)="setMaxPrice($any($event.target).value)"
                />
              </div>
            </div>
            <div class="filters__group">
              <div class="na-field">
                <span class="na-label" id="window-label">Departure window</span>
                <na-segmented
                  ariaLabel="Departure window"
                  [options]="windowOptions"
                  [value]="filters().departureWindow ?? 'any'"
                  (valueChange)="setWindow($event)"
                />
              </div>
            </div>
            <div class="filters__group">
              <div class="filters__check">
                <input
                  id="refundable"
                  type="checkbox"
                  [checked]="filters().refundableOnly"
                  (change)="setRefundable($any($event.target).checked)"
                />
                <label for="refundable">Refundable fares only</label>
              </div>
            </div>
            @if (filtersActive()) {
              <na-button variant="ghost" size="sm" (clicked)="resetFilters()">Reset filters</na-button>
            }
          </aside>

          <section class="results" aria-label="Flight results" aria-live="polite">
            <div class="filters-open">
              <na-button variant="secondary" (clicked)="openFilters()">Filters</na-button>
            </div>

            <div class="results__bar">
              <p class="na-text-muted na-text-small">
                @if (flights() !== null) {
                  {{ visibleFlights().length }} of {{ flights()!.length }} flights
                }
              </p>
              <div class="na-field results__sort">
                <label class="na-label" for="sort">Sort by</label>
                <select id="sort" class="na-select" [value]="sort()" (change)="sort.set($any($event.target).value)">
                  <option value="recommended">Recommended</option>
                  <option value="price">Lowest price</option>
                  <option value="duration">Shortest duration</option>
                  <option value="departure">Earliest departure</option>
                </select>
              </div>
            </div>

            @if (error()) {
              <na-alert tone="danger" icon="⚠" title="We couldn't load flights for this route" [retryable]="true" (retry)="runSearch()">
                Try again in a moment.
              </na-alert>
            } @else if (flights() === null) {
              <div class="skel" aria-hidden="true">
                @for (i of skeletons; track i) {
                  <div class="na-card skel__card">
                    <na-skeleton [rows]="[1]" height="0.75rem" width="36%" />
                    <na-skeleton [rows]="[1]" height="1.75rem" width="64%" />
                    <na-skeleton [rows]="[1]" height="0.75rem" width="48%" />
                  </div>
                }
              </div>
              <span class="na-visually-hidden">Loading flights…</span>
            } @else if (visibleFlights().length === 0) {
              <na-empty-state
                icon="✈"
                title="No flights match your search"
                message="Try a nearby date above, or adjust your filters to see more options."
                actionLabel="Reset filters"
                (action)="resetFilters()"
              />
            } @else {
              <ol class="cards" role="list">
                @for (f of visibleFlights(); track f.id) {
                  <li class="na-card card">
                    <div class="card__top">
                      <p class="card__airline">NovaAir · {{ f.flightNumber }} · {{ f.aircraft.model }}</p>
                      <div class="card__badges">
                        @if (f.scheduleStatus === 'DELAYED') {
                          <na-badge tone="warning">Delayed</na-badge>
                        }
                        @if (fareOf(f, c); as fare) {
                          @if (fare.availableCount < 5) {
                            <na-badge tone="warning">Only {{ fare.availableCount }} seats left at this fare</na-badge>
                          }
                        }
                      </div>
                    </div>

                    <div class="card__journey">
                      <na-route-line
                        size="lg"
                        [origin]="f.route.origin.iataCode"
                        [destination]="f.route.destination.iataCode"
                        [originCity]="f.route.origin.city"
                        [destinationCity]="f.route.destination.city"
                      />
                      <div class="card__schedule">
                        <div class="card__when">
                          <span class="card__time">{{ time(f.departureTime) }}</span>
                          <span class="card__date">{{ shortDate(f.departureTime) }}</span>
                        </div>
                        <p class="card__duration">
                          {{ duration(f) }} · {{ f.segments.length > 1 ? f.segments.length - 1 + ' stop' : 'Nonstop' }}
                        </p>
                        <div class="card__when card__when--to">
                          <span class="card__time">{{ time(f.arrivalTime) }}</span>
                          <span class="card__date">{{ shortDate(f.arrivalTime) }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="card__bottom">
                      <div class="card__fare-info">
                        @if (fareOf(f, c); as fare) {
                          <p class="card__cabin">{{ cabinName(fare.cabinClass) }}</p>
                          @if (fare.rules; as rules) {
                            <p class="na-text-muted na-text-small">
                              {{ rules.checkedBaggagePieces }}× checked bag ({{ rules.checkedBaggageWeightKg }} kg) included
                            </p>
                          }
                        }
                        <button
                          type="button"
                          class="card__toggle"
                          [attr.aria-expanded]="expanded().has(f.id)"
                          [attr.aria-controls]="'fares-' + f.id"
                          (click)="toggleExpand(f.id)"
                        >
                          {{ expanded().has(f.id) ? 'Hide fares' : 'Compare fares' }}
                        </button>
                      </div>
                      <div class="card__buy">
                        @if (fareOf(f, c); as fare) {
                          <p class="card__from">From</p>
                          <p class="card__price">{{ fareTotal(fare) }}</p>
                          <p class="card__per">per adult</p>
                          <na-button variant="cta" (clicked)="select(f, fare)">Select</na-button>
                        }
                      </div>
                    </div>

                    @if (expanded().has(f.id)) {
                      <div class="card__fares" [id]="'fares-' + f.id">
                        <h3 class="na-text-small">Fare options</h3>
                        @for (fare of f.fares; track fare.id) {
                          <div class="fare-row">
                            <div>
                              <strong>{{ cabinName(fare.cabinClass) }}</strong>
                              @if (fare.rules; as rules) {
                                <na-badge [tone]="rules.refundable ? 'success' : 'neutral'">
                                  {{ rules.refundable ? 'Refundable' : 'Non-refundable' }}
                                </na-badge>
                                <p class="na-text-small na-text-muted">{{ rules.description }}</p>
                                <p class="na-text-small na-text-muted">
                                  {{ rules.checkedBaggagePieces }}× checked bag ({{ rules.checkedBaggageWeightKg }} kg)
                                </p>
                              }
                            </div>
                            <div class="fare-row__buy">
                              <span class="fare-row__price">{{ fareTotal(fare) }}</span>
                              <na-button
                                variant="secondary"
                                size="sm"
                                [disabled]="fare.availableCount === 0"
                                (clicked)="select(f, fare)"
                              >{{ fare.availableCount === 0 ? 'Sold out' : 'Select' }}</na-button>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </li>
                }
              </ol>
            }
          </section>
        </div>

        @if (filtersOpen()) {
          <div class="backdrop" role="presentation" (click)="closeFilters()"></div>
        }
      } @else {
        <na-empty-state
          icon="🔎"
          title="Start with a search"
          message="Search for a route and dates to see live fares here."
          actionLabel="Search flights"
          (action)="goSearch()"
        />
      }
    </div>
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); }
    h1 { margin-bottom: var(--na-space-1); }
    .page__sub { margin-bottom: var(--na-space-5); }
    .summary {
      display: flex; align-items: center; gap: var(--na-space-3) var(--na-space-6); flex-wrap: wrap;
      padding: var(--na-space-2) 0 var(--na-space-5); margin-bottom: var(--na-space-5);
      border-bottom: 1px solid var(--na-border);
    }
    .summary__meta { flex: 1; min-width: 200px; color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .summary__edit { font-weight: var(--na-font-semibold); min-height: 44px; display: inline-flex; align-items: center; }
    .roundtrip-note { display: block; margin-bottom: var(--na-space-5); }
    .dates { display: flex; gap: var(--na-space-2); overflow-x: auto; padding-bottom: var(--na-space-2); margin-bottom: var(--na-space-5); }
    .dates__day {
      flex: 1; min-width: 96px; display: flex; flex-direction: column; align-items: center; gap: var(--na-space-1);
      padding: var(--na-space-2) var(--na-space-3); min-height: 56px;
      background: var(--na-surface-raised); border: 1px solid var(--na-border); border-radius: var(--na-radius-md);
      transition: border-color var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease);
    }
    .dates__day:hover:not(:disabled) { border-color: var(--na-navy-300); }
    .dates__day--active { border-color: var(--na-blue-600); background: var(--na-blue-100); }
    .dates__day:disabled { opacity: 0.55; }
    .dates__dow, .dates__date { font-size: var(--na-text-xs); color: var(--na-ink-500); }
    .dates__price { font-weight: var(--na-font-semibold); font-size: var(--na-text-sm); }
    .layout { display: grid; grid-template-columns: 260px 1fr; gap: var(--na-space-5); align-items: start; }
    .filters { padding: var(--na-space-6); position: sticky; top: var(--na-space-4); }
    .filters__head { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3); }
    .filters__title {
      font-family: var(--na-font-family); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.12em; color: var(--na-ink-500);
    }
    .filters__close {
      display: none; background: none; border: none; font-size: 1.5rem; line-height: 1;
      color: var(--na-ink-500); min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md);
    }
    .filters__group { padding: var(--na-space-4) 0; }
    .filters__group + .filters__group { border-top: 1px solid var(--na-border); }
    .filters__group .na-field { margin-bottom: 0; }
    .filters__check { display: flex; align-items: center; gap: var(--na-space-2); min-height: 44px; }
    .filters__check input { width: 20px; height: 20px; }
    .filters-open { display: none; }
    .results__bar { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); margin-bottom: var(--na-space-4); flex-wrap: wrap; }
    .results__sort { flex-direction: row; align-items: center; gap: var(--na-space-2); margin-bottom: 0; }
    .results__sort .na-select { width: auto; min-height: 40px; }
    .skel { display: grid; gap: var(--na-space-4); }
    .skel__card { padding: var(--na-space-6); }
    .cards { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--na-space-4); }
    .card {
      display: grid; gap: var(--na-space-5); padding: var(--na-space-6);
      transition: transform var(--na-motion-fast) var(--na-ease), box-shadow var(--na-motion-fast) var(--na-ease);
    }
    .card:hover { transform: translateY(-2px); box-shadow: var(--na-shadow-md); }
    .card__top { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3); flex-wrap: wrap; }
    .card__airline { color: var(--na-ink-500); font-size: var(--na-text-sm); font-weight: var(--na-font-medium); }
    .card__badges { display: flex; gap: var(--na-space-2); flex-wrap: wrap; justify-content: flex-end; }
    .card__journey { display: grid; gap: var(--na-space-3); max-width: 30rem; }
    .card__schedule { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--na-space-3); flex-wrap: wrap; }
    .card__when { display: flex; flex-direction: column; }
    .card__when--to { text-align: right; }
    .card__time { font-size: var(--na-text-xl); font-weight: var(--na-font-bold); color: var(--na-ink-900); line-height: 1.1; }
    .card__date { font-size: var(--na-text-xs); color: var(--na-ink-500); margin-top: 2px; }
    .card__duration {
      flex: 1; min-width: 110px; text-align: center; padding-top: var(--na-space-1);
      color: var(--na-ink-500); font-size: var(--na-text-sm);
    }
    .card__bottom {
      border-top: 1px solid var(--na-border); padding-top: var(--na-space-4);
      display: flex; justify-content: space-between; align-items: flex-end; gap: var(--na-space-4); flex-wrap: wrap;
    }
    .card__fare-info { display: grid; gap: var(--na-space-1); justify-items: start; }
    .card__cabin { font-weight: var(--na-font-semibold); color: var(--na-ink-900); }
    .card__toggle {
      background: none; border: none; color: var(--na-blue-600); font-weight: var(--na-font-semibold);
      min-height: 44px; padding: 0; margin-top: var(--na-space-1);
    }
    .card__toggle:hover { text-decoration: underline; }
    .card__buy { display: grid; justify-items: end; gap: 2px; margin-left: auto; }
    .card__from {
      font-size: var(--na-text-xs); color: var(--na-ink-500);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .card__price {
      font-family: var(--na-font-display); font-size: var(--na-text-2xl); font-weight: var(--na-font-bold);
      color: var(--na-ink-900); line-height: 1.1;
    }
    .card__per { font-size: var(--na-text-xs); color: var(--na-ink-500); }
    .card__buy na-button { margin-top: var(--na-space-2); }
    .card__fares { border-top: 1px solid var(--na-border); padding-top: var(--na-space-4); display: grid; gap: var(--na-space-3); }
    .fare-row {
      display: flex; justify-content: space-between; gap: var(--na-space-4); align-items: center;
      padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-md);
      background: var(--na-surface-sunken);
    }
    .fare-row__buy { display: flex; flex-direction: column; align-items: flex-end; gap: var(--na-space-2); }
    .fare-row__price { font-weight: var(--na-font-bold); font-size: var(--na-text-lg); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .filters-open { display: flex; flex-direction: column; margin-bottom: var(--na-space-4); }
      .filters-open na-button { display: contents; }
      .filters {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 100;
        width: min(320px, 85vw); border-radius: 0; border-left: 1px solid var(--na-border);
        box-shadow: var(--na-shadow-lg); overflow-y: auto;
        transform: translateX(105%); visibility: hidden;
        transition: transform var(--na-motion-base) var(--na-ease), visibility 0s var(--na-motion-base);
      }
      .filters--open {
        transform: translateX(0); visibility: visible;
        transition: transform var(--na-motion-base) var(--na-ease);
      }
      .filters__close { display: block; }
      .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 99; }
    }
    @media (max-width: 639px) {
      .card { padding: var(--na-space-4); gap: var(--na-space-4); }
      .card__bottom { flex-direction: column; align-items: stretch; }
      .card__buy { justify-items: stretch; margin-left: 0; }
      .card__buy na-button { display: contents; }
    }
  `,
})
export class ResultsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flightsApi = inject(FlightService);
  private readonly draft = inject(BookingDraftService);

  protected readonly criteria = signal<SearchCriteria | null>(null);
  protected readonly flights = signal<Flight[] | null>(null);
  protected readonly adjacent = signal<AdjacentDay[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly expanded = signal<Set<string>>(new Set());
  protected readonly filters = signal<ResultFilters>({ refundableOnly: false, departureWindow: null, maxPrice: null });
  protected readonly sort = signal<ResultSort>('recommended');
  protected readonly filtersOpen = signal(false);
  protected readonly skeletons = [1, 2, 3];

  private readonly filtersCloseBtn = viewChild('filtersClose', { read: ElementRef });

  protected readonly windowOptions: SegmentOption[] = [
    { value: 'any', label: 'Any time' },
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
  ];

  protected readonly visibleFlights = computed(() => {
    const list = this.flights();
    const c = this.criteria();
    if (!list || !c) return [];
    const filtered = applyFilters(list, this.filters(), c.cabinClass);
    return applySort(filtered, this.sort(), c.cabinClass);
  });

  protected readonly filtersActive = computed(() => {
    const f = this.filters();
    return f.maxPrice != null || f.departureWindow != null || f.refundableOnly;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const origin = params.get('origin');
      const destination = params.get('destination');
      const depart = params.get('depart');
      if (!origin || !destination || !depart) {
        this.criteria.set(null);
        return;
      }
      const criteria: SearchCriteria = {
        tripType: (params.get('tripType') as TripType) ?? 'ONE_WAY',
        originCode: origin,
        destinationCode: destination,
        departureDate: depart,
        returnDate: params.get('return'),
        passengers: {
          adults: Math.max(1, Number(params.get('adults')) || 1),
          children: Math.max(0, Number(params.get('children')) || 0),
          infants: Math.max(0, Number(params.get('infants')) || 0),
        },
        cabinClass: (params.get('cabin') as CabinClass) ?? 'ECONOMY',
        promoCode: params.get('promo'),
      };
      this.criteria.set(criteria);
      this.runSearch();
      this.loadAdjacent();
    });
  }

  protected runSearch(): void {
    const c = this.criteria();
    if (!c) return;
    this.flights.set(null);
    this.error.set(null);
    this.flightsApi.searchFlights(c).subscribe({
      next: (flights) => this.flights.set(flights),
      error: () => {
        this.flights.set([]);
        this.error.set('The flight search service is unavailable right now.');
      },
    });
  }

  protected pickDate(date: string): void {
    const c = this.criteria();
    if (!c || date === c.departureDate) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { depart: date },
      queryParamsHandling: 'merge',
    });
  }

  protected setMaxPrice(value: string): void {
    const n = Number(value);
    this.filters.update((f) => ({ ...f, maxPrice: value === '' || Number.isNaN(n) ? null : n }));
  }

  protected setWindow(value: string): void {
    this.filters.update((f) => ({
      ...f,
      departureWindow: value === 'any' ? null : (value as 'morning' | 'afternoon' | 'evening'),
    }));
  }

  protected setRefundable(checked: boolean): void {
    this.filters.update((f) => ({ ...f, refundableOnly: checked }));
  }

  protected resetFilters(): void {
    this.filters.set({ refundableOnly: false, departureWindow: null, maxPrice: null });
  }

  protected openFilters(): void {
    this.filtersOpen.set(true);
    setTimeout(() => this.filtersCloseBtn()?.nativeElement?.focus(), 60);
  }

  protected closeFilters(): void {
    this.filtersOpen.set(false);
  }

  protected onEscape(): void {
    if (this.filtersOpen()) this.filtersOpen.set(false);
  }

  protected toggleExpand(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected select(flight: Flight, fare: Fare): void {
    const c = this.criteria();
    if (!c) return;
    this.draft.start(c, flight, fare);
    this.router.navigate(['/flights', flight.id]);
  }

  protected fareOf(f: Flight, c: SearchCriteria): Fare | undefined {
    return f.fares.find((x) => x.cabinClass === c.cabinClass) ?? f.fares[0];
  }

  protected fareTotal(fare: Fare): string {
    return formatMoney(fare.basePrice + fare.taxAmount + fare.feeAmount, fare.currency);
  }

  protected duration(f: Flight): string {
    return flightDurationLabel(f);
  }

  protected time(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected prettyDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  protected weekday(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(iso));
  }

  protected shortDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  protected money(amount: number): string {
    return formatMoney(amount, 'EUR');
  }

  protected passengerLabel(c: SearchCriteria): string {
    const p = c.passengers;
    const parts = [`${p.adults} adult${p.adults > 1 ? 's' : ''}`];
    if (p.children) parts.push(`${p.children} child${p.children > 1 ? 'ren' : ''}`);
    if (p.infants) parts.push(`${p.infants} infant${p.infants > 1 ? 's' : ''}`);
    return parts.join(', ');
  }

  protected cabinName(c: CabinClass): string {
    return cabinLabel(c);
  }

  protected goSearch(): void {
    this.router.navigate(['/search']);
  }

  private loadAdjacent(): void {
    const c = this.criteria();
    if (!c) return;
    this.flightsApi.adjacentDateAvailability(c).subscribe((days) => this.adjacent.set(days));
  }
}
