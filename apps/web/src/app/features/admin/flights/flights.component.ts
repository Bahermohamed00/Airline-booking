import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlightService, flightDurationLabel, type AdminFlightFilters } from '../../../core/services/flight.service';
import { CatalogService } from '../catalog/catalog.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { Aircraft, CabinClass, Flight, FlightStatus, Route, Seat } from '../../../core/models/domain.model';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface FlightRow {
  id: string;
  flightNumber: string;
  route: string;
  departure: string;
  arrival: string;
  aircraft: string;
  status: string;
}

const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Business-facing flight number: NV + one or more digits (NV100, NV720, NV901). */
const FLIGHT_NUMBER_PATTERN = /^NV\d+$/;

/** Cabin base-price multipliers — mirror of apps/api/src/flights/flight-generator.ts. */
const CABIN_FARE_MULTIPLIERS: Partial<Record<CabinClass, number>> = {
  ECONOMY: 1,
  BUSINESS: 3.5,
  FIRST: 5.5,
};

/** Mirror of the backend lifecycle map (apps/api/src/flights/flight-status-transitions.ts). */
const FLIGHT_STATUS_TRANSITIONS: Readonly<Record<FlightStatus, readonly FlightStatus[]>> = {
  SCHEDULED: ['BOARDING', 'CANCELLED'],
  BOARDING: ['DEPARTED', 'CANCELLED'],
  DEPARTED: ['ARRIVED'],
  ARRIVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  ACTIVE: [],
  DELAYED: [],
};

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Compact rendering of a UUID; the full ID stays visible in the detail drawer. */
export function shortId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

@Component({
  selector: 'na-admin-flights',
  imports: [
    FormsModule,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaDataTable,
    NaSkeleton,
    HasPermissionDirective,
  ],
  templateUrl: './flights.component.html',
  styleUrl: './flights.component.css',
})
export class FlightsPage {
  private readonly flightService = inject(FlightService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  readonly columns: TableColumn<FlightRow>[] = [
    { key: 'id', label: 'ID', priority: 'low' },
    { key: 'flightNumber', label: 'Flight' },
    { key: 'route', label: 'Route' },
    { key: 'departure', label: 'Departure' },
    { key: 'arrival', label: 'Arrival' },
    { key: 'aircraft', label: 'Aircraft', priority: 'low' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({
        text: r.status,
        tone: Object.values(FLIGHT_STATUS_MAP).find((v) => v.label === r.status)?.tone ?? 'neutral',
      }),
    },
  ];
  readonly statusOptions: FlightStatus[] = [
    'SCHEDULED',
    'BOARDING',
    'DEPARTED',
    'ARRIVED',
    'COMPLETED',
    'CANCELLED',
    'ACTIVE',
    'DELAYED',
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly flights = signal<Flight[]>([]);

  filterFlightNumber = '';
  readonly statusFilter = signal<'ALL' | FlightStatus>('ALL');
  filterFrom = '';
  filterTo = '';

  /** Server-driven filtering; switchMap cancels superseded requests. */
  private readonly filterChanges = new Subject<void>();

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(
    () => this.flights().find((f) => f.id === this.selectedId()) ?? null,
  );

  /** Full flight details (segments included) cached per id — the list endpoint omits segments. */
  private readonly detailCache = new Map<string, Flight>();
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly statusChanging = signal(false);
  readonly statusError = signal<string | null>(null);

  readonly editOpen = signal(false);
  readonly editSaving = signal(false);
  readonly editError = signal<string | null>(null);
  editDeparture = '';
  editArrival = '';
  editPrice = '';

  // ---- Generate (explicit single-flight creation) ----
  // Every form field is a signal: the preview and the Generate button's
  // enabled state are computed from them, and Angular computeds only
  // re-evaluate when signal dependencies change — plain [(ngModel)] string
  // properties would leave previewReady permanently stale (button stuck
  // disabled). This is the bug this signal-based wiring prevents.
  readonly generateOpen = signal(false);
  readonly generating = signal(false);
  readonly generateError = signal<string | null>(null);
  readonly formRoutes = signal<Route[]>([]);
  readonly formAircraft = signal<Aircraft[]>([]);
  readonly genRouteId = signal('');
  readonly genAircraftId = signal('');
  readonly genDepartureDate = signal('');
  readonly genDepartureTime = signal('');
  readonly genArrivalDate = signal('');
  readonly genArrivalTime = signal('');
  readonly genFlightNumber = signal('');
  readonly genPrice = signal('');
  readonly genTripType = signal<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY');
  /** Seat map of the selected aircraft — drives the cabin-class preview. */
  readonly genAircraftSeats = signal<Seat[]>([]);

  readonly selectedRoute = computed(() => this.formRoutes().find((r) => r.id === this.genRouteId()) ?? null);
  readonly selectedAircraft = computed(() => this.formAircraft().find((a) => a.id === this.genAircraftId()) ?? null);

  /** Cabins offered by the selected aircraft, derived from its seat map (no separate cabin model). */
  readonly genCabinSummary = computed(() => {
    const counts = new Map<CabinClass, number>();
    for (const seat of this.genAircraftSeats()) {
      counts.set(seat.cabinClass, (counts.get(seat.cabinClass) ?? 0) + 1);
    }
    const order: CabinClass[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
    return order
      .filter((c) => counts.has(c))
      .map((cabinClass) => ({ cabinClass, seats: counts.get(cabinClass)! }));
  });

  /** Estimated base fare per cabin (same multipliers the backend generator applies). */
  readonly genCabinFares = computed(() => {
    const base = this.parsedGenPrice();
    if (base === null) return [];
    return this.genCabinSummary().map((cabin) => ({
      ...cabin,
      basePrice: Math.round(base * (CABIN_FARE_MULTIPLIERS[cabin.cabinClass] ?? 1)),
    }));
  });

  onGenAircraftChange(id: string): void {
    this.genAircraftId.set(id);
    this.genAircraftSeats.set([]);
    if (id !== '') {
      this.catalog.getAircraftSeats(id).subscribe({
        next: (seats) => this.genAircraftSeats.set(seats),
        error: () => this.genAircraftSeats.set([]),
      });
    }
  }

  // ---- Generate form validation state ----
  /** Fields the user has blurred; errors show on touch or on Generate attempt. */
  readonly touchedFields = signal<ReadonlySet<string>>(new Set());
  readonly attemptedSubmit = signal(false);
  /** Cross-field rule that only the backend can validate correctly across timezones. */
  readonly arrivalOrderError = signal<string | null>(null);

  markTouched(field: string): void {
    this.touchedFields.update((set) => new Set(set).add(field));
  }

  showFieldError(field: string): boolean {
    return this.attemptedSubmit() || this.touchedFields().has(field);
  }

  readonly routeError = computed(() => {
    if (this.genRouteId() !== '') return null;
    const first = this.formRoutes()[0];
    return first
      ? `Please select a route. Example: ${first.origin.iataCode} → ${first.destination.iataCode}`
      : 'Please select a route.';
  });
  readonly aircraftError = computed(() => {
    if (this.genAircraftId() !== '') return null;
    const first = this.formAircraft()[0];
    return first ? `Please select an aircraft. Example: ${first.registration}` : 'Please select an aircraft.';
  });
  readonly departureDateError = computed(() =>
    this.genDepartureDate() === '' ? 'Departure date is required (yyyy-mm-dd).' : null,
  );
  readonly departureTimeError = computed(() => {
    const v = this.genDepartureTime();
    if (v === '') return 'Departure time is required.';
    if (!LOCAL_TIME_PATTERN.test(v)) return 'Enter time in 24-hour HH:mm format. Example: 14:45';
    return null;
  });
  readonly arrivalDateError = computed(() =>
    this.genArrivalDate() === '' ? 'Arrival date is required (yyyy-mm-dd).' : null,
  );
  readonly arrivalTimeError = computed(() => {
    const v = this.genArrivalTime();
    if (v === '') return 'Arrival time is required.';
    if (!LOCAL_TIME_PATTERN.test(v)) return 'Enter time in 24-hour HH:mm format. Example: 14:45';
    return null;
  });
  readonly flightNumberError = computed(() => {
    const v = this.normalizedFlightNumber();
    if (v === '') return 'Flight number is required.';
    if (!FLIGHT_NUMBER_PATTERN.test(v)) return 'Flight number must start with NV followed by digits. Example: NV720';
    return null;
  });
  readonly priceError = computed(() => {
    // type="number" inputs hand Angular a number, not a string — coerce first.
    const raw = String(this.genPrice() ?? '').trim();
    if (raw === '') return 'Flight price is required. Example: 15000 or 250.00';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Enter a valid price. Use numbers only, for example: 15000 or 250.00';
    if (n <= 0) return 'Price must be greater than 0. Example: 15000';
    if (Math.abs(n - Math.round(n * 100) / 100) > 1e-9)
      return 'Price can have up to 2 decimal places. Example: 15000 or 15000.50';
    return null;
  });
  readonly hasFormErrors = computed(
    () =>
      this.routeError() !== null ||
      this.aircraftError() !== null ||
      this.departureDateError() !== null ||
      this.departureTimeError() !== null ||
      this.arrivalDateError() !== null ||
      this.arrivalTimeError() !== null ||
      this.flightNumberError() !== null ||
      this.priceError() !== null,
  );

  /** Entered price as a number, or null when absent/invalid. */
  /** Parsed price, or null when absent/invalid (same rules as priceError). */
  readonly parsedGenPrice = () => {
    const raw = String(this.genPrice() ?? '').trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n <= 0) return null;
    if (Math.abs(n - Math.round(n * 100) / 100) > 1e-9) return null;
    return Math.round(n * 100) / 100;
  };

  /** Preview is shown only once every required selection is made (flight number and price included). */
  readonly previewReady = computed(
    () =>
      this.selectedRoute() !== null &&
      this.selectedAircraft() !== null &&
      this.genDepartureDate() !== '' &&
      LOCAL_TIME_PATTERN.test(this.genDepartureTime()) &&
      this.genArrivalDate() !== '' &&
      LOCAL_TIME_PATTERN.test(this.genArrivalTime()) &&
      FLIGHT_NUMBER_PATTERN.test(this.normalizedFlightNumber()) &&
      this.parsedGenPrice() !== null,
  );

  /** Entered flight number normalized the same way the backend does (UppercaseString). */
  readonly normalizedFlightNumber = () => this.genFlightNumber().trim().toUpperCase();

  readonly rows = computed<FlightRow[]>(() =>
    this.flights().map((f) => ({
      id: shortId(f.id),
      flightNumber: f.flightNumber,
      route: `${f.route.origin.iataCode} → ${f.route.destination.iataCode}`,
      departure: dateTimeFmt.format(new Date(f.departureTime)),
      arrival: dateTimeFmt.format(new Date(f.arrivalTime)),
      aircraft: f.aircraft.registration,
      status: statusLabel(FLIGHT_STATUS_MAP, f.status).label,
    })),
  );

  constructor() {
    this.filterChanges
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.loadError.set(null);
          return this.flightService.adminFlights(this.currentFilters()).pipe(
            // Handle errors per emission so the outer stream — and the Retry
            // button that feeds it — survives a failed request.
            catchError((err: unknown) => {
              this.loadError.set(toErrorMessage(err, 'Could not load the flight schedule.'));
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((flights) => {
        if (flights === null) {
          return;
        }
        this.flights.set([...flights]);
        this.loading.set(false);
      });
    this.load();
  }

  load(): void {
    this.filterChanges.next();
  }

  onFilterChange(): void {
    this.filterChanges.next();
  }

  private currentFilters(): AdminFlightFilters {
    const status = this.statusFilter();
    return {
      flightNumber: this.filterFlightNumber.trim() || undefined,
      status: status === 'ALL' ? undefined : status,
      // Operational view: COMPLETED flights live in the Completed Flights section.
      // An explicit status choice (incl. COMPLETED) always wins over this default.
      excludeCompleted: status === 'ALL',
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
    };
  }

  clearFilters(): void {
    this.filterFlightNumber = '';
    this.statusFilter.set('ALL');
    this.filterFrom = '';
    this.filterTo = '';
    this.filterChanges.next();
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
    this.detailError.set(null);
    this.statusError.set(null);
    this.editOpen.set(false);
    const cached = this.detailCache.get(id);
    if (cached) {
      this.mergeDetail(cached);
      this.detailLoading.set(false);
      return;
    }
    this.loadDetail(id);
  }

  retryDetail(): void {
    const id = this.selectedId();
    if (id) this.loadDetail(id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
  }

  /** Row ids are rendered compactly; resolve the real flight id from the row index context. */
  openDetailByRow(rowId: string): void {
    const flight = this.flights().find((f) => shortId(f.id) === rowId);
    if (flight) this.openDetail(flight.id);
  }

  openGenerate(): void {
    this.genRouteId.set('');
    this.genAircraftId.set('');
    this.genDepartureDate.set('');
    this.genDepartureTime.set('');
    this.genArrivalDate.set('');
    this.genArrivalTime.set('');
    this.genFlightNumber.set('');
    this.genPrice.set('');
    this.genTripType.set('ONE_WAY');
    this.genAircraftSeats.set([]);
    this.touchedFields.set(new Set());
    this.attemptedSubmit.set(false);
    this.arrivalOrderError.set(null);
    this.generateError.set(null);
    this.generateOpen.set(true);
    this.catalog.listRoutes().subscribe((routes) => this.formRoutes.set(routes));
    this.catalog.listAircraft().subscribe((aircraft) => this.formAircraft.set(aircraft));
  }

  closeGenerate(): void {
    if (this.generating()) return;
    this.generateOpen.set(false);
  }

  submitGenerate(event: Event): void {
    event.preventDefault();
    // Reveal every validation message; never silently refuse to generate.
    this.attemptedSubmit.set(true);
    this.touchAllGenerateFields();
    if (this.generating()) return;
    if (this.hasFormErrors()) {
      this.generateError.set(null);
      return; // inline field errors guide the user; the API is not called
    }
    this.generateError.set(null);
    this.arrivalOrderError.set(null);
    this.generating.set(true);
    this.flightService
      .createFlight({
        routeId: this.genRouteId(),
        aircraftId: this.genAircraftId(),
        departureDate: this.genDepartureDate(),
        departureTime: this.genDepartureTime(),
        arrivalDate: this.genArrivalDate(),
        arrivalTime: this.genArrivalTime(),
        flightNumber: this.normalizedFlightNumber(),
        price: this.parsedGenPrice()!,
        tripType: this.genTripType(),
      })
      .subscribe({
        next: (created) => {
          this.generating.set(false);
          this.generateOpen.set(false);
          this.toast.success(`Flight ${created.flightNumber} created.`);
          this.detailCache.set(created.id, created);
          // Straight to the newly created flight's details.
          this.openDetail(created.id);
          this.load();
        },
        error: (err: unknown) => {
          this.generating.set(false);
          // Timezone-correct cross-field rule: only the backend can evaluate
          // it (origin/destination timezones differ) — surface it at the field.
          const message = err instanceof Object && 'error' in err && typeof (err as { error?: { message?: unknown } }).error?.message === 'string'
            ? (err as { error: { message: string } }).error.message
            : '';
          if (message.includes('arrivalTime must be after departureTime')) {
            this.arrivalOrderError.set('Arrival must be after departure.');
            return;
          }
          this.generateError.set(toErrorMessage(err, 'Could not create the flight. Please check the values.'));
        },
      });
  }

  private touchAllGenerateFields(): void {
    for (const field of ['route', 'aircraft', 'departureDate', 'departureTime', 'arrivalDate', 'arrivalTime', 'flightNumber', 'price']) {
      this.markTouched(field);
    }
  }

  flightStatus(f: Flight) {
    return statusLabel(FLIGHT_STATUS_MAP, f.status);
  }

  /** Lifecycle statuses the selected flight may transition to (empty for terminal states). */
  allowedTransitions(f: Flight): readonly FlightStatus[] {
    return FLIGHT_STATUS_TRANSITIONS[f.status];
  }

  transitionLabel(target: FlightStatus): string {
    return target === 'CANCELLED' ? 'Cancel flight' : `Mark as ${this.flightStatusLabel(target)}`;
  }

  changeStatus(f: Flight, status: FlightStatus): void {
    if (this.statusChanging()) return;
    this.statusError.set(null);
    this.statusChanging.set(true);
    this.flightService.updateFlightStatus(f.id, status).subscribe({
      next: (updated) => {
        this.statusChanging.set(false);
        this.detailCache.set(updated.id, updated);
        this.mergeDetail(updated);
      },
      error: (err: unknown) => {
        this.statusChanging.set(false);
        this.statusError.set(toErrorMessage(err, 'Could not change the flight status.'));
      },
    });
  }

  /** Terminal flights are immutable — never edited, never resurrected. */
  canEdit(f: Flight): boolean {
    return f.status !== 'CANCELLED' && f.status !== 'COMPLETED';
  }

  openEdit(f: Flight): void {
    this.editDeparture = this.toInputValue(f.departureTime);
    this.editArrival = this.toInputValue(f.arrivalTime);
    const economy = f.fares.find((x) => x.cabinClass === 'ECONOMY') ?? f.fares[0];
    this.editPrice = economy ? String(economy.basePrice) : '';
    this.editError.set(null);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    if (this.editSaving()) return;
    this.editOpen.set(false);
  }

  submitEdit(f: Flight): void {
    if (this.editSaving()) return;
    if (!this.editDeparture || !this.editArrival) {
      this.editError.set('Both departure and arrival times are required.');
      return;
    }
    const departureTime = new Date(this.editDeparture);
    const arrivalTime = new Date(this.editArrival);
    if (departureTime >= arrivalTime) {
      this.editError.set('Departure must be before arrival.');
      return;
    }
    this.editError.set(null);
    this.editSaving.set(true);
    const payload: { departureTime: string; arrivalTime: string; price?: number } = {
      departureTime: departureTime.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
    };
    // Optional price update: included only when a valid positive amount is entered.
    // type="number" inputs hand Angular a number, not a string — coerce first.
    const priceRaw = String(this.editPrice ?? '').trim();
    const priceInput = Number(priceRaw);
    if (priceRaw !== '' && Number.isFinite(priceInput) && priceInput > 0) {
      payload.price = Math.round(priceInput * 100) / 100;
    }
    this.flightService
      .updateFlight(f.id, payload)
      .subscribe({
        next: (updated) => {
          this.editSaving.set(false);
          this.editOpen.set(false);
          this.detailCache.set(updated.id, updated);
          this.mergeDetail(updated);
        },
        error: (err: unknown) => {
          this.editSaving.set(false);
          this.editError.set(toErrorMessage(err, 'Could not update the flight times.'));
        },
      });
  }

  /** datetime-local value ("yyyy-MM-ddTHH:mm", browser-local) for an ISO instant. */
  private toInputValue(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  flightStatusLabel(s: FlightStatus): string {
    return statusLabel(FLIGHT_STATUS_MAP, s).label;
  }

  /** Customer-facing public flight identifier (e.g. FL-1024); the UUID stays internal. */
  publicId(f: Flight): string {
    return `FL-${1000 + f.publicNumber}`;
  }

  /** The economy fare (the Flight Manager's price lives on the base fare). */
  economyFare(f: Flight) {
    return f.fares.find((x) => x.cabinClass === 'ECONOMY') ?? f.fares[0];
  }

  formatMoney(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  formatDate(iso: string): string {
    return dateFmt.format(new Date(iso));
  }

  formatTime(iso: string): string {
    return timeFmt.format(new Date(iso));
  }

  duration(f: Flight): string {
    return flightDurationLabel(f);
  }

  private loadDetail(id: string): void {
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.flightService.getFlight(id).subscribe((flight) => {
      if (this.selectedId() !== id) return;
      this.detailLoading.set(false);
      if (!flight) {
        this.detailError.set('Could not load the flight details. Please try again.');
        return;
      }
      this.detailCache.set(id, flight);
      this.mergeDetail(flight);
    });
  }

  private mergeDetail(flight: Flight): void {
    this.flights.update((list) => list.map((f) => (f.id === flight.id ? flight : f)));
  }
}
