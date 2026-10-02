import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type { Airport, Flight, Route } from '../../../core/models/domain.model';
import type { RoutePayload } from '../../../core/models/catalog-api.model';
import { CatalogService } from '../../../core/services/catalog.service';
import { FlightService } from '../../../core/services/flight.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface RouteRow {
  id: string;
  route: string;
  distanceKm: string;
  duration: string;
  flights: string;
  status: string;
}

interface RouteForm {
  originAirportId: string;
  destinationAirportId: string;
  distanceKm: number | null;
  durationMinutes: number | null;
}

function durationLabel(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

@Component({
  selector: 'na-admin-routes',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaDialog, NaDataTable, NaSkeleton],
  template: `
    <div class="page">
      <na-breadcrumbs [items]="[{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Routes' }]" />
      <header class="page__head">
        <div>
          <h1>Routes</h1>
          <p class="subtitle">Origin–destination pairs available for flight scheduling.</p>
        </div>
        <na-button variant="cta" (clicked)="openCreate()">Add route</na-button>
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4, 5]" height="2.5rem" />
      } @else if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else {
        <na-data-table
          [columns]="columns"
          [rows]="rows()"
          emptyTitle="No routes"
          emptyMessage="Add a route to start scheduling flights."
          emptyActionLabel="Add route"
          (rowClick)="openDetail($event.id)"
          (emptyAction)="openCreate()"
        />
      }

      <!-- Detail drawer -->
      @if (selected(); as r) {
        <div class="backdrop" (click)="closeDetail()" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="'Route ' + r.origin.iataCode + ' to ' + r.destination.iataCode + ' details'">
          <header class="drawer__head">
            <div>
              <h2 class="na-text-mono">{{ r.origin.iataCode }} → {{ r.destination.iataCode }}</h2>
              <p class="subtitle">{{ r.origin.city }} – {{ r.destination.city }}</p>
            </div>
            <button type="button" class="drawer__close" aria-label="Close details" (click)="closeDetail()">×</button>
          </header>
          <div class="drawer__body">
            <dl class="facts">
              <div><dt>Status</dt><dd>{{ r.status === 'ACTIVE' ? 'Active' : 'Inactive' }}</dd></div>
              <div><dt>Distance</dt><dd>{{ r.distanceKm ?? '—' }} km</dd></div>
              <div><dt>Block time</dt><dd>{{ durationLabel(r.durationMinutes) }}</dd></div>
              <div><dt>Upcoming flights</dt><dd>{{ flightCount(r) }}</dd></div>
              <div><dt>Origin</dt><dd>{{ r.origin.name }} ({{ r.origin.iataCode }})</dd></div>
              <div><dt>Destination</dt><dd>{{ r.destination.name }} ({{ r.destination.iataCode }})</dd></div>
            </dl>
            <p class="na-hint">Upcoming flights reflects the current scheduling window.</p>

            <div class="actions">
              <na-button
                [variant]="r.status === 'ACTIVE' ? 'danger' : 'primary'"
                size="sm"
                (clicked)="toggleDialogOpen.set(true)"
              >
                {{ r.status === 'ACTIVE' ? 'Deactivate route' : 'Activate route' }}
              </na-button>
            </div>
          </div>
        </aside>
      }

      <!-- Add route drawer -->
      @if (createOpen()) {
        <div class="backdrop" (click)="createOpen.set(false)" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Add route">
          <header class="drawer__head">
            <h2>Add route</h2>
            <button type="button" class="drawer__close" aria-label="Close form" (click)="createOpen.set(false)">×</button>
          </header>
          <form class="drawer__body" (submit)="submitCreate($event)">
            <div class="na-field">
              <label class="na-label" for="rt-origin">Origin airport</label>
              <select id="rt-origin" class="na-select" name="rtOrigin" [(ngModel)]="form.originAirportId" required [attr.aria-invalid]="createError() ? 'true' : null">
                <option value="" disabled>Select origin…</option>
                @for (a of activeAirports(); track a.id) {
                  <option [value]="a.id">{{ a.iataCode }} — {{ a.name }}</option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="rt-dest">Destination airport</label>
              <select id="rt-dest" class="na-select" name="rtDest" [(ngModel)]="form.destinationAirportId" required [attr.aria-invalid]="createError() ? 'true' : null">
                <option value="" disabled>Select destination…</option>
                @for (a of activeAirports(); track a.id) {
                  <option [value]="a.id">{{ a.iataCode }} — {{ a.name }}</option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="rt-dist">Distance (km) <span class="na-hint">(optional)</span></label>
              <input id="rt-dist" class="na-input" type="number" name="rtDist" [(ngModel)]="form.distanceKm" min="1" max="25000" />
            </div>
            <div class="na-field">
              <label class="na-label" for="rt-dur">Block time (minutes) <span class="na-hint">(optional)</span></label>
              <input id="rt-dur" class="na-input" type="number" name="rtDur" [(ngModel)]="form.durationMinutes" min="1" max="3000" />
              @if (createError()) { <p class="na-error" role="alert">{{ createError() }}</p> }
            </div>
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="createOpen.set(false)">Cancel</na-button>
              <na-button variant="cta" type="submit" [disabled]="submitting()" [loading]="submitting()">Add route</na-button>
            </div>
          </form>
        </aside>
      }

      <na-dialog
        [open]="toggleDialogOpen()"
        [title]="selected()?.status === 'ACTIVE' ? 'Deactivate route?' : 'Activate route?'"
        [confirmLabel]="selected()?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'"
        [confirmDanger]="selected()?.status === 'ACTIVE'"
        (confirmed)="confirmToggle()"
        (cancelled)="toggleDialogOpen.set(false)"
      >
        Route {{ selected()?.origin.iataCode }} → {{ selected()?.destination.iataCode }} will
        {{ selected()?.status === 'ACTIVE' ? 'no longer accept new flight schedules' : 'become available for scheduling again' }}.
        Existing flights are not affected.
      </na-dialog>
    </div>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: var(--na-space-5); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .subtitle { color: var(--na-ink-500); margin-top: var(--na-space-1); }
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
    .drawer__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); margin-top: var(--na-space-4); }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-3); margin: 0; }
    .facts dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); }
    .facts dd { margin: var(--na-space-1) 0 0; font-weight: var(--na-font-medium); font-size: var(--na-text-sm); }
    .actions { margin-top: var(--na-space-6); }
    @media (max-width: 639px) {
      .facts { grid-template-columns: 1fr; }
    }
  `,
})
export class RoutesPage {
  private readonly catalog = inject(CatalogService);
  private readonly flights = inject(FlightService);
  private readonly toast = inject(ToastService);

  readonly columns: TableColumn<RouteRow>[] = [
    { key: 'route', label: 'Route' },
    { key: 'distanceKm', label: 'Distance' },
    { key: 'duration', label: 'Block time', priority: 'low' },
    { key: 'flights', label: 'Upcoming flights' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({ text: r.status, tone: r.status === 'Active' ? 'success' : 'neutral' }),
    },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly routeList = signal<Route[]>([]);
  readonly airports = signal<Airport[]>([]);
  readonly upcomingFlights = signal<Flight[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.routeList().find((r) => r.id === this.selectedId()) ?? null);

  readonly createOpen = signal(false);
  readonly toggleDialogOpen = signal(false);
  readonly submitting = signal(false);
  readonly createError = signal<string | null>(null);

  form: RouteForm = { originAirportId: '', destinationAirportId: '', distanceKm: null, durationMinutes: null };

  readonly activeAirports = computed<Airport[]>(() =>
    this.airports().filter((a) => a.status === 'ACTIVE'),
  );

  readonly rows = computed<RouteRow[]>(() =>
    this.routeList().map((r) => ({
      id: r.id,
      route: `${r.origin.iataCode} → ${r.destination.iataCode}`,
      distanceKm: r.distanceKm != null ? `${r.distanceKm} km` : '—',
      duration: durationLabel(r.durationMinutes),
      flights: String(this.flightCount(r)),
      status: r.status === 'ACTIVE' ? 'Active' : 'Inactive',
    })),
  );

  constructor() {
    this.load();
  }

  /**
   * Routes, airports and the generated flight window load once together.
   * GET /flights (no params) returns the rolling scheduling window, so the
   * per-route counts are "upcoming flights", never an all-time count.
   */
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      routes: this.catalog.listRoutes(),
      airports: this.catalog.listAirports(),
      flights: this.flights.adminFlights(),
    }).subscribe({
      next: ({ routes, airports, flights }) => {
        this.routeList.set(routes);
        this.airports.set(airports);
        this.upcomingFlights.set(flights);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load the route catalog.'));
        this.loading.set(false);
      },
    });
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  flightCount(r: Route): number {
    return this.upcomingFlights().filter((f) => f.routeId === r.id).length;
  }

  durationLabel(minutes: number | null | undefined): string {
    return durationLabel(minutes);
  }

  openCreate(): void {
    this.form = { originAirportId: '', destinationAirportId: '', distanceKm: null, durationMinutes: null };
    this.createError.set(null);
    this.createOpen.set(true);
  }

  submitCreate(event: Event): void {
    event.preventDefault();
    const { originAirportId, destinationAirportId } = this.form;
    if (!originAirportId || !destinationAirportId) {
      this.createError.set('Both origin and destination are required.');
      return;
    }
    if (originAirportId === destinationAirportId) {
      this.createError.set('Origin and destination must be different airports.');
      return;
    }
    const exists = this.routeList().some(
      (r) => r.originAirportId === originAirportId && r.destinationAirportId === destinationAirportId,
    );
    if (exists) {
      this.createError.set(this.duplicateMessage(originAirportId, destinationAirportId));
      return;
    }

    const payload: RoutePayload = { originAirportId, destinationAirportId };
    if (this.form.distanceKm != null && this.form.distanceKm > 0) {
      payload.distanceKm = Math.round(Number(this.form.distanceKm));
    }
    if (this.form.durationMinutes != null && this.form.durationMinutes > 0) {
      payload.durationMinutes = Math.round(Number(this.form.durationMinutes));
    }

    this.submitting.set(true);
    this.catalog.createRoute(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.routeList.update((list) => [...list, created]);
        this.createOpen.set(false);
        this.toast.success(`Route ${created.origin.iataCode} → ${created.destination.iataCode} added.`);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.createError.set(
          toErrorMessage(
            err,
            'Could not add the route. Please try again.',
            this.duplicateMessage(originAirportId, destinationAirportId),
          ),
        );
      },
    });
  }

  confirmToggle(): void {
    this.toggleDialogOpen.set(false);
    const r = this.selected();
    if (!r) return;
    const next = r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.catalog.updateRoute(r.id, { status: next }).subscribe({
      next: (updated) => {
        this.routeList.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.toast.success(
          `Route ${updated.origin.iataCode} → ${updated.destination.iataCode} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`,
        );
      },
      error: (err: unknown) =>
        this.toast.error(toErrorMessage(err, 'Could not update the route status.')),
    });
  }

  private duplicateMessage(originAirportId: string, destinationAirportId: string): string {
    return `Route ${this.iataOf(originAirportId)} → ${this.iataOf(destinationAirportId)} already exists.`;
  }

  private iataOf(airportId: string): string {
    return this.airports().find((a) => a.id === airportId)?.iataCode ?? airportId;
  }
}
