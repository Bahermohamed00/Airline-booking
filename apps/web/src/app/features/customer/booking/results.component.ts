import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FlightService,
  applyFilters,
  applySort,
  flightDurationLabel,
} from '../../../core/services/flight.service';
import { BookingDraftService } from './booking-draft.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { Fare, Flight, CabinClass } from '../../../core/models/domain.model';
import type {
  ResultFilters,
  ResultSort,
  SearchCriteria,
  TripType,
} from '../../../core/models/booking-flow.model';
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
  imports: [
    RouterLink,
    NaButton,
    NaBadge,
    NaAlert,
    NaSkeleton,
    NaEmptyState,
    NaSegmented,
    NaRouteLine,
  ],
  host: { '(document:keydown.escape)': 'onEscape()' },
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
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
  protected readonly filters = signal<ResultFilters>({
    refundableOnly: false,
    departureWindow: null,
    maxPrice: null,
  });
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
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  }

  protected prettyDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso));
  }

  protected weekday(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(iso));
  }

  protected shortDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(iso),
    );
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
