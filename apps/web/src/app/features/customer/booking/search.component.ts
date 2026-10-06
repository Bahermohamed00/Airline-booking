import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { FlightService } from '../../../core/services/flight.service';
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

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'na-search-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgOptimizedImage,
    NaSegmented,
    NaAutocomplete,
    NaButton,
    NaAlert,
    NaQuantityStepper,
    NaRouteLine,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchPage {
  private readonly router = inject(Router);
  private readonly flightsApi = inject(FlightService);

  private readonly fromField = viewChild('fromField', { read: NaAutocomplete });
  private readonly toField = viewChild('toField', { read: NaAutocomplete });

  protected readonly tripOptions: SegmentOption[] = [
    { value: 'ONE_WAY', label: 'One way' },
    { value: 'ROUND_TRIP', label: 'Round trip' },
    { value: 'MULTI_CITY', label: 'Multi-city' },
  ];

  protected readonly airportOptions = signal<AutocompleteOption[]>([]);
  protected readonly airportsLoading = signal(true);
  protected readonly airportsError = signal(false);

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

  constructor() {
    this.loadAirports();
  }

  protected loadAirports(): void {
    this.airportsLoading.set(true);
    this.airportsError.set(false);
    this.flightsApi.listAirports().subscribe({
      next: (airports) => {
        this.airportOptions.set(
          airports.map((a) => ({
            value: a.iataCode,
            label: `${a.iataCode} — ${a.name}`,
            hint: `${a.city}, ${a.country}`,
          })),
        );
        this.airportsLoading.set(false);
      },
      error: () => {
        this.airportOptions.set([]);
        this.airportsLoading.set(false);
        this.airportsError.set(true);
      },
    });
  }

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
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(iso),
    );
  }

  private remember(c: SearchCriteria): void {
    const list = [
      c,
      ...this.recentSearches().filter(
        (r) =>
          !(
            r.originCode === c.originCode &&
            r.destinationCode === c.destinationCode &&
            r.departureDate === c.departureDate
          ),
      ),
    ].slice(0, 3);
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
