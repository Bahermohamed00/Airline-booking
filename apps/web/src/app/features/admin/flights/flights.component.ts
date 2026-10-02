import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlightService, flightDurationLabel } from '../../../core/services/flight.service';
import { ScheduleRulesService } from '../../../core/services/schedule-rules.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { Flight, FlightStatus } from '../../../core/models/domain.model';
import type { GenerationSummary } from '../../../core/models/schedule-rule-api.model';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
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
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

@Component({
  selector: 'na-admin-flights',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDataTable, NaSkeleton, HasPermissionDirective],
  template: `
    <div class="page">
      <na-breadcrumbs [items]="[{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Flights' }]" />
      <header class="page__head">
        <div>
          <h1>Flight schedule</h1>
          <p class="subtitle">
            Flights are created from schedule rules via generation — there is no manual flight creation or
            per-flight editing.
          </p>
        </div>
        <na-button variant="cta" *naHasPermission="'flights:manage'" (clicked)="openGenerate()">Generate flights</na-button>
      </header>

      <div class="filters">
        <div class="na-field filters__search">
          <label class="na-label" for="flight-search">Search</label>
          <input
            id="flight-search"
            class="na-input"
            type="search"
            placeholder="Flight number or airport code…"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </div>
        <div class="na-field">
          <label class="na-label" for="status-filter">Status</label>
          <select
            id="status-filter"
            class="na-select"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
          >
            <option value="ALL">All statuses</option>
            @for (s of statusOptions; track s) {
              <option [value]="s">{{ flightStatusLabel(s) }}</option>
            }
          </select>
        </div>
      </div>

      @if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else {
        <na-data-table
          [columns]="columns"
          [rows]="rows()"
          [loading]="loading()"
          emptyTitle="No flights match"
          emptyMessage="Try a different search term or status filter."
          emptyActionLabel="Clear filters"
          (rowClick)="openDetail($event.id)"
          (emptyAction)="clearFilters()"
        />
      }

      <!-- Detail drawer -->
      @if (selected(); as f) {
        <div class="backdrop" (click)="closeDetail()" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="'Flight ' + f.flightNumber + ' details'">
          <header class="drawer__head">
            <div>
              <h2>{{ f.flightNumber }}</h2>
              <p class="subtitle">{{ f.route.origin.city }} ({{ f.route.origin.iataCode }}) → {{ f.route.destination.city }} ({{ f.route.destination.iataCode }})</p>
            </div>
            <button type="button" class="drawer__close" aria-label="Close details" (click)="closeDetail()">×</button>
          </header>

          <div class="drawer__body">
            <dl class="facts">
              <div><dt>Status</dt><dd><na-badge [tone]="flightStatus(f).tone">{{ flightStatus(f).label }}</na-badge></dd></div>
              <div><dt>Departure</dt><dd>{{ formatDate(f.departureTime) }} · {{ formatTime(f.departureTime) }}</dd></div>
              <div><dt>Arrival</dt><dd>{{ formatDate(f.arrivalTime) }} · {{ formatTime(f.arrivalTime) }}</dd></div>
              <div><dt>Duration</dt><dd>{{ duration(f) }}</dd></div>
              <div><dt>Aircraft</dt><dd>{{ f.aircraft.registration }} — {{ f.aircraft.model }}</dd></div>
              <div><dt>Distance</dt><dd>{{ f.route.distanceKm ?? '—' }} km</dd></div>
            </dl>

            <h3>Segments</h3>
            @if (detailLoading()) {
              <na-skeleton [rows]="[1, 2]" height="1.5rem" />
            } @else if (detailError()) {
              <div class="list-error" role="alert">
                <p>{{ detailError() }}</p>
                <na-button variant="secondary" size="sm" (clicked)="retryDetail()">Retry</na-button>
              </div>
            } @else {
              <ul class="segments">
                @for (seg of f.segments; track seg.id) {
                  <li>
                    <span class="na-text-mono">{{ seg.origin.iataCode }} → {{ seg.destination.iataCode }}</span>
                    <span class="na-text-muted na-text-small">{{ formatTime(seg.departureTime) }} – {{ formatTime(seg.arrivalTime) }}</span>
                  </li>
                }
              </ul>
            }

            <h3>Fares</h3>
            <div class="fares-wrap">
              <table class="fares">
                <thead><tr><th>Cabin</th><th>Base</th><th>Taxes &amp; fees</th><th>Available</th></tr></thead>
                <tbody>
                  @for (fare of f.fares; track fare.id) {
                    <tr>
                      <td>{{ fare.cabinClass.replace('_', ' ') }}</td>
                      <td>{{ formatMoney(fare.basePrice, fare.currency) }}</td>
                      <td>{{ formatMoney(fare.taxAmount + fare.feeAmount, fare.currency) }}</td>
                      <td>{{ fare.availableCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      }

      <!-- Generate flights drawer -->
      @if (generateOpen()) {
        <div class="backdrop" (click)="closeGenerate()" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Generate flights from schedule rules">
          <header class="drawer__head">
            <h2>Generate flights</h2>
            <button type="button" class="drawer__close" aria-label="Close form" (click)="closeGenerate()">×</button>
          </header>
          <form class="drawer__body" (submit)="submitGenerate($event)">
            <p class="na-hint">
              Creates and updates flights from the ACTIVE schedule rules whose operating days fall inside the
              range (max {{ maxRangeDays }} days). Generation is idempotent — re-running the same range updates
              existing flights instead of duplicating them.
            </p>
            <div class="na-field">
              <label class="na-label" for="gen-from">From</label>
              <input id="gen-from" class="na-input" type="date" name="genFrom" [(ngModel)]="generateFrom" required />
            </div>
            <div class="na-field">
              <label class="na-label" for="gen-to">To</label>
              <input id="gen-to" class="na-input" type="date" name="genTo" [(ngModel)]="generateTo" required />
              @if (generateError()) {
                <p class="na-error" role="alert">{{ generateError() }}</p>
              }
            </div>

            @if (summary(); as s) {
              <section class="gen-summary" aria-label="Generation summary">
                <h3>Generation summary</h3>
                <dl class="facts">
                  <div><dt>Rules evaluated</dt><dd>{{ s.rulesEvaluated }}</dd></div>
                  <div><dt>Operating dates</dt><dd>{{ s.operatingDates }}</dd></div>
                  <div><dt>Flights created</dt><dd>{{ s.flightsCreated }}</dd></div>
                  <div><dt>Flights updated</dt><dd>{{ s.flightsUpdated }}</dd></div>
                  <div><dt>Segments created</dt><dd>{{ s.segmentsCreated }}</dd></div>
                  <div><dt>Segments updated</dt><dd>{{ s.segmentsUpdated }}</dd></div>
                  <div><dt>Fares created</dt><dd>{{ s.faresCreated }}</dd></div>
                  <div><dt>Fares updated</dt><dd>{{ s.faresUpdated }}</dd></div>
                </dl>
                @if (s.skippedRules.length > 0) {
                  <h3>Skipped rules</h3>
                  <ul class="skipped">
                    @for (skip of s.skippedRules; track skip.flightNumber) {
                      <li>
                        <span class="na-text-mono">{{ skip.flightNumber }}</span>
                        <span class="na-text-muted na-text-small">{{ skip.reason }}</span>
                      </li>
                    }
                  </ul>
                }
              </section>
            }

            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="closeGenerate()">Close</na-button>
              <na-button variant="cta" type="submit" [disabled]="generating()" [loading]="generating()">Generate</na-button>
            </div>
          </form>
        </aside>
      }
    </div>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: var(--na-space-5); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .subtitle { color: var(--na-ink-500); margin-top: var(--na-space-1); max-width: 64ch; }
    .filters { display: flex; gap: var(--na-space-4); flex-wrap: wrap; align-items: flex-end; }
    .filters .na-field { margin-bottom: 0; }
    .filters__search { flex: 1 1 260px; }
    .list-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    .list-error p { margin: 0; color: var(--na-ink-500); }
    .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 99; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 100;
      width: min(480px, 100vw); background: var(--na-surface-raised);
      border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg); display: flex; flex-direction: column;
    }
    .drawer__head {
      display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3);
      padding: var(--na-space-5); border-bottom: 1px solid var(--na-border);
    }
    .drawer__close { background: none; border: none; font-size: 1.6rem; line-height: 1; color: var(--na-ink-500); min-width: 44px; min-height: 44px; }
    .drawer__body { padding: var(--na-space-5); overflow-y: auto; }
    .drawer__body h3 { margin: var(--na-space-5) 0 var(--na-space-2); font-size: var(--na-text-base); }
    .drawer__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); margin-top: var(--na-space-4); }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-3); margin: 0; }
    .facts dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); }
    .facts dd { margin: var(--na-space-1) 0 0; font-weight: var(--na-font-medium); font-size: var(--na-text-sm); }
    .segments { list-style: none; margin: 0; padding: 0; }
    .segments li { display: flex; justify-content: space-between; gap: var(--na-space-3); padding: var(--na-space-2) 0; border-bottom: 1px solid var(--na-border); }
    .fares-wrap { overflow-x: auto; }
    .fares { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    .fares th { text-align: left; padding: var(--na-space-2); font-size: var(--na-text-xs); text-transform: uppercase; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); }
    .fares td { padding: var(--na-space-2); border-bottom: 1px solid var(--na-border); }
    .gen-summary { margin-top: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-md); background: var(--na-surface-sunken); }
    .gen-summary h3:first-child { margin-top: 0; }
    .skipped { list-style: none; margin: 0; padding: 0; }
    .skipped li { display: flex; justify-content: space-between; gap: var(--na-space-3); padding: var(--na-space-2) 0; border-bottom: 1px solid var(--na-border); }
    @media (max-width: 639px) {
      .facts { grid-template-columns: 1fr; }
      .filters { flex-direction: column; align-items: stretch; }
    }
  `,
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
  readonly statusOptions: FlightStatus[] = ['SCHEDULED', 'ACTIVE', 'DELAYED', 'CANCELLED', 'COMPLETED'];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly flights = signal<Flight[]>([]);
  readonly query = signal('');
  readonly statusFilter = signal<'ALL' | FlightStatus>('ALL');

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.flights().find((f) => f.id === this.selectedId()) ?? null);

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
        this.generateError.set(toErrorMessage(err, 'Could not generate flights. Please try again.'));
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
