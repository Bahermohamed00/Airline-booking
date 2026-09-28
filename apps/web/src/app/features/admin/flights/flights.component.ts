import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { flightDurationLabel } from '../../../core/services/flight.service';
import { AdminCatalogService } from '../../../core/services/admin-catalog.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { Aircraft, Flight, FlightStatus, Route } from '../../../core/models/domain.model';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
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

interface FlightForm {
  flightNumber: string;
  routeId: string;
  aircraftId: string;
  departure: string;
  arrival: string;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'na-admin-flights',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaDataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <na-breadcrumbs [items]="[{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Flights' }]" />
      <header class="page__head">
        <div>
          <h1>Flight schedule</h1>
          <p class="subtitle">Manage scheduled flights, cancellations, reschedules and aircraft assignment.</p>
        </div>
        <na-button variant="cta" (clicked)="openCreate()">New flight</na-button>
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
            <ul class="segments">
              @for (seg of f.segments; track seg.id) {
                <li>
                  <span class="na-text-mono">{{ seg.origin.iataCode }} → {{ seg.destination.iataCode }}</span>
                  <span class="na-text-muted na-text-small">{{ formatTime(seg.departureTime) }} – {{ formatTime(seg.arrivalTime) }}</span>
                </li>
              }
            </ul>

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

            <h3>Actions</h3>
            <div class="actions">
              <na-button variant="danger" size="sm" [disabled]="f.status === 'CANCELLED'" (clicked)="cancelDialogOpen.set(true)">
                Cancel flight
              </na-button>
              <na-button variant="secondary" size="sm" (clicked)="rescheduleOpen.set(!rescheduleOpen())">
                Reschedule
              </na-button>
            </div>

            @if (rescheduleOpen()) {
              <form class="inline-form" (submit)="applyReschedule($event)">
                <div class="na-field">
                  <label class="na-label" for="reschedule-dep">New departure</label>
                  <input id="reschedule-dep" class="na-input" type="datetime-local" name="rescheduleDep" [(ngModel)]="rescheduleDep" required />
                </div>
                <div class="na-field">
                  <label class="na-label" for="reschedule-arr">New arrival</label>
                  <input id="reschedule-arr" class="na-input" type="datetime-local" name="rescheduleArr" [(ngModel)]="rescheduleArr" required />
                  @if (rescheduleError()) {
                    <p class="na-error" role="alert">{{ rescheduleError() }}</p>
                  }
                </div>
                <na-button variant="primary" size="sm" type="submit">Apply reschedule</na-button>
              </form>
            }

            <div class="na-field assign">
              <label class="na-label" for="assign-aircraft">Assign aircraft</label>
              <div class="assign__row">
                <select id="assign-aircraft" class="na-select" name="assignAircraft" [(ngModel)]="assignAircraftId">
                  @for (a of aircraftOptions(); track a.id) {
                    <option [value]="a.id">{{ a.registration }} — {{ a.model }}</option>
                  }
                </select>
                <na-button variant="secondary" size="sm" (clicked)="applyAircraft()">Assign</na-button>
              </div>
            </div>
          </div>
        </aside>
      }

      <!-- New flight drawer -->
      @if (createOpen()) {
        <div class="backdrop" (click)="createOpen.set(false)" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Create new flight">
          <header class="drawer__head">
            <h2>New flight</h2>
            <button type="button" class="drawer__close" aria-label="Close form" (click)="createOpen.set(false)">×</button>
          </header>
          <form class="drawer__body" (submit)="submitCreate($event)">
            <div class="na-field">
              <label class="na-label" for="nf-number">Flight number</label>
              <input id="nf-number" class="na-input" name="nfNumber" [(ngModel)]="form.flightNumber" placeholder="e.g. NV720" required pattern="[A-Za-z]{2}[0-9]{1,4}" />
              <p class="na-hint">Two letters followed by up to four digits.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="nf-route">Route</label>
              <select id="nf-route" class="na-select" name="nfRoute" [(ngModel)]="form.routeId" required>
                <option value="" disabled>Select a route…</option>
                @for (r of routeOptions(); track r.id) {
                  <option [value]="r.id">{{ r.origin.iataCode }} → {{ r.destination.iataCode }} ({{ r.origin.city }} – {{ r.destination.city }})</option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="nf-aircraft">Aircraft</label>
              <select id="nf-aircraft" class="na-select" name="nfAircraft" [(ngModel)]="form.aircraftId" required>
                <option value="" disabled>Select an aircraft…</option>
                @for (a of aircraftOptions(); track a.id) {
                  <option [value]="a.id">{{ a.registration }} — {{ a.model }} ({{ a.capacity }} seats)</option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="nf-dep">Departure</label>
              <input id="nf-dep" class="na-input" type="datetime-local" name="nfDep" [(ngModel)]="form.departure" required />
            </div>
            <div class="na-field">
              <label class="na-label" for="nf-arr">Arrival</label>
              <input id="nf-arr" class="na-input" type="datetime-local" name="nfArr" [(ngModel)]="form.arrival" required />
              @if (createError()) {
                <p class="na-error" role="alert">{{ createError() }}</p>
              }
            </div>
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="createOpen.set(false)">Cancel</na-button>
              <na-button variant="cta" type="submit">Create flight</na-button>
            </div>
          </form>
        </aside>
      }

      <na-dialog
        [open]="cancelDialogOpen()"
        title="Cancel this flight?"
        confirmLabel="Cancel flight"
        [confirmDanger]="true"
        (confirmed)="confirmCancel()"
        (cancelled)="cancelDialogOpen.set(false)"
      >
        Passengers on {{ selected()?.flightNumber }} will need to be notified and rebooked. This cannot be undone.
      </na-dialog>
    </div>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: var(--na-space-5); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .subtitle { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .filters { display: flex; gap: var(--na-space-4); flex-wrap: wrap; align-items: flex-end; }
    .filters .na-field { margin-bottom: 0; }
    .filters__search { flex: 1 1 260px; }
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
    .actions { display: flex; gap: var(--na-space-3); flex-wrap: wrap; }
    .inline-form { margin-top: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-md); background: var(--na-surface-sunken); }
    .assign { margin-top: var(--na-space-5); }
    .assign__row { display: flex; gap: var(--na-space-2); align-items: center; }
    @media (max-width: 639px) {
      .facts { grid-template-columns: 1fr; }
      .filters { flex-direction: column; align-items: stretch; }
    }
  `,
})
export class FlightsPage {
  private readonly catalog = inject(AdminCatalogService);
  private readonly toast = inject(ToastService);

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
  readonly routeOptions = signal<Route[]>([]);
  readonly aircraftOptions = signal<Aircraft[]>([]);

  readonly loading = signal(true);
  readonly flights = signal<Flight[]>([]);
  readonly query = signal('');
  readonly statusFilter = signal<'ALL' | FlightStatus>('ALL');

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.flights().find((f) => f.id === this.selectedId()) ?? null);

  readonly createOpen = signal(false);
  readonly cancelDialogOpen = signal(false);
  readonly rescheduleOpen = signal(false);
  readonly rescheduleError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);

  form: FlightForm = { flightNumber: '', routeId: '', aircraftId: '', departure: '', arrival: '' };
  rescheduleDep = '';
  rescheduleArr = '';
  assignAircraftId = '';

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
    this.catalog.listFlights().subscribe((flights) => {
      this.flights.set(flights);
      this.loading.set(false);
    });
    this.catalog.listRoutes().subscribe((routes) => this.routeOptions.set(routes));
    this.catalog.listAircraft().subscribe((aircraft) => this.aircraftOptions.set(aircraft));
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
    this.rescheduleOpen.set(false);
    this.rescheduleError.set(null);
    const f = this.selected();
    if (f) {
      this.rescheduleDep = toLocalInput(f.departureTime);
      this.rescheduleArr = toLocalInput(f.arrivalTime);
      this.assignAircraftId = f.aircraftId;
    }
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  openCreate(): void {
    this.form = { flightNumber: '', routeId: '', aircraftId: '', departure: '', arrival: '' };
    this.createError.set(null);
    this.createOpen.set(true);
  }

  clearFilters(): void {
    this.query.set('');
    this.statusFilter.set('ALL');
  }

  confirmCancel(): void {
    this.cancelDialogOpen.set(false);
    const f = this.selected();
    if (!f) return;
    this.catalog.updateFlight(f.id, { status: 'CANCELLED' }).subscribe((updated) => {
      this.applyUpdated(updated);
      this.toast.success(`Flight ${f.flightNumber} cancelled. Passengers will be notified.`);
    });
  }

  applyReschedule(event: Event): void {
    event.preventDefault();
    const f = this.selected();
    if (!f) return;
    const dep = new Date(this.rescheduleDep);
    const arr = new Date(this.rescheduleArr);
    if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) {
      this.rescheduleError.set('Both departure and arrival are required.');
      return;
    }
    if (arr.getTime() <= dep.getTime()) {
      this.rescheduleError.set('Arrival must be after departure.');
      return;
    }
    this.rescheduleError.set(null);
    this.rescheduleOpen.set(false);
    this.catalog
      .updateFlight(f.id, { departureTime: dep.toISOString(), arrivalTime: arr.toISOString() })
      .subscribe((updated) => {
        this.applyUpdated(updated);
        this.toast.success(`Flight ${f.flightNumber} rescheduled to ${dateTimeFmt.format(dep)}.`);
      });
  }

  applyAircraft(): void {
    const f = this.selected();
    const aircraft = this.aircraftOptions().find((a) => a.id === this.assignAircraftId);
    if (!f || !aircraft) return;
    this.catalog.updateFlight(f.id, { aircraftId: aircraft.id }).subscribe((updated) => {
      this.applyUpdated(updated);
      this.toast.success(`${aircraft.registration} assigned to flight ${f.flightNumber}.`);
    });
  }

  submitCreate(event: Event): void {
    event.preventDefault();
    const route = this.routeOptions().find((r) => r.id === this.form.routeId);
    const aircraft = this.aircraftOptions().find((a) => a.id === this.form.aircraftId);
    if (!this.form.flightNumber.trim() || !route || !aircraft || !this.form.departure || !this.form.arrival) {
      this.createError.set('All fields are required.');
      return;
    }
    const dep = new Date(this.form.departure);
    const arr = new Date(this.form.arrival);
    if (arr.getTime() <= dep.getTime()) {
      this.createError.set('Arrival must be after departure.');
      return;
    }
    this.catalog
      .createFlight({
        flightNumber: this.form.flightNumber.trim().toUpperCase(),
        routeId: route.id,
        aircraftId: aircraft.id,
        departureTime: dep.toISOString(),
        arrivalTime: arr.toISOString(),
        economyFareSeats: aircraft.capacity,
      })
      .subscribe((newFlight) => {
        this.flights.update((list) => [newFlight, ...list]);
        this.createOpen.set(false);
        this.toast.success(`Flight ${newFlight.flightNumber} created on ${route.origin.iataCode} → ${route.destination.iataCode}.`);
      });
  }

  private applyUpdated(updated: Flight): void {
    this.flights.update((list) => list.map((f) => (f.id === updated.id ? updated : f)));
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
}
