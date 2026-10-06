import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type { Airport, Flight, Route } from '../../../core/models/domain.model';
import type { RoutePayload } from './catalog-api.model';
import { CatalogService } from './catalog.service';
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
  templateUrl: './routes.component.html',
  styleUrl: './routes.component.css',
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
  readonly selected = computed(
    () => this.routeList().find((r) => r.id === this.selectedId()) ?? null,
  );

  readonly createOpen = signal(false);
  readonly toggleDialogOpen = signal(false);
  readonly submitting = signal(false);
  readonly createError = signal<string | null>(null);

  form: RouteForm = {
    originAirportId: '',
    destinationAirportId: '',
    distanceKm: null,
    durationMinutes: null,
  };

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
    this.form = {
      originAirportId: '',
      destinationAirportId: '',
      distanceKm: null,
      durationMinutes: null,
    };
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
      (r) =>
        r.originAirportId === originAirportId && r.destinationAirportId === destinationAirportId,
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
        this.toast.success(
          `Route ${created.origin.iataCode} → ${created.destination.iataCode} added.`,
        );
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
