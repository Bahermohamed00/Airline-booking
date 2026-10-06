import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlightService, flightDurationLabel } from '../../../core/services/flight.service';
import { ScheduleRulesService } from './schedule-rules.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { Flight, FlightStatus } from '../../../core/models/domain.model';
import type { GenerationSummary } from './schedule-rule-api.model';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
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
  aircraft: string;
  status: string;
  capacity: string;
}

const MAX_GENERATE_RANGE_DAYS = 62;

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
  private readonly scheduleRules = inject(ScheduleRulesService);

  readonly maxRangeDays = MAX_GENERATE_RANGE_DAYS;

  readonly columns: TableColumn<FlightRow>[] = [
    { key: 'flightNumber', label: 'Flight' },
    { key: 'route', label: 'Route' },
    { key: 'departure', label: 'Departure' },
    { key: 'aircraft', label: 'Aircraft', priority: 'low' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({
        text: r.status,
        tone: Object.values(FLIGHT_STATUS_MAP).find((v) => v.label === r.status)?.tone ?? 'neutral',
      }),
    },
    { key: 'capacity', label: 'Capacity', priority: 'low' },
  ];
  readonly statusOptions: FlightStatus[] = [
    'SCHEDULED',
    'ACTIVE',
    'DELAYED',
    'CANCELLED',
    'COMPLETED',
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly flights = signal<Flight[]>([]);
  readonly query = signal('');
  readonly statusFilter = signal<'ALL' | FlightStatus>('ALL');

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(
    () => this.flights().find((f) => f.id === this.selectedId()) ?? null,
  );

  /** Full flight details (segments included) cached per id — the list endpoint omits segments. */
  private readonly detailCache = new Map<string, Flight>();
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly generateOpen = signal(false);
  readonly generating = signal(false);
  readonly generateError = signal<string | null>(null);
  readonly summary = signal<GenerationSummary | null>(null);
  generateFrom = '';
  generateTo = '';

  readonly rows = computed<FlightRow[]>(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.flights()
      .filter((f) => {
        if (status !== 'ALL' && f.status !== status) return false;
        if (!q) return true;
        return (
          f.flightNumber.toLowerCase().includes(q) ||
          f.route.origin.iataCode.toLowerCase().includes(q) ||
          f.route.destination.iataCode.toLowerCase().includes(q)
        );
      })
      .map((f) => ({
        id: f.id,
        flightNumber: f.flightNumber,
        route: `${f.route.origin.iataCode} → ${f.route.destination.iataCode}`,
        departure: dateTimeFmt.format(new Date(f.departureTime)),
        aircraft: f.aircraft.registration,
        status: statusLabel(FLIGHT_STATUS_MAP, f.status).label,
        capacity: `${f.fares[0]?.availableCount ?? 0}/${f.aircraft.capacity}`,
      }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.flightService.adminFlights().subscribe({
      next: (flights) => {
        this.flights.set([...flights]);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load the flight schedule.'));
        this.loading.set(false);
      },
    });
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
    this.detailError.set(null);
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

  clearFilters(): void {
    this.query.set('');
    this.statusFilter.set('ALL');
  }

  openGenerate(): void {
    this.generateFrom = '';
    this.generateTo = '';
    this.generateError.set(null);
    this.summary.set(null);
    this.generateOpen.set(true);
  }

  closeGenerate(): void {
    if (this.generating()) return;
    this.generateOpen.set(false);
  }

  submitGenerate(event: Event): void {
    event.preventDefault();
    if (this.generating()) return;
    const from = this.generateFrom;
    const to = this.generateTo;
    if (!from || !to) {
      this.generateError.set('Both from and to dates are required.');
      return;
    }
    if (from > to) {
      this.generateError.set('From must be on or before to.');
      return;
    }
    const rangeDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
    if (rangeDays > MAX_GENERATE_RANGE_DAYS) {
      this.generateError.set(`The range cannot exceed ${MAX_GENERATE_RANGE_DAYS} days.`);
      return;
    }
    this.generateError.set(null);
    this.generating.set(true);
    this.scheduleRules.generateFlights(from, to).subscribe({
      next: (summary) => {
        this.generating.set(false);
        this.summary.set(summary);
        this.detailCache.clear();
        this.load();
      },
      error: (err: unknown) => {
        this.generating.set(false);
        this.generateError.set(
          toErrorMessage(err, 'Could not generate flights. Please try again.'),
        );
      },
    });
  }

  flightStatus(f: Flight) {
    return statusLabel(FLIGHT_STATUS_MAP, f.status);
  }

  flightStatusLabel(s: FlightStatus): string {
    return statusLabel(FLIGHT_STATUS_MAP, s).label;
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
