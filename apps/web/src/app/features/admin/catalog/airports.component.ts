import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type { Airport, Route } from '../../../core/models/domain.model';
import type { AirportPayload } from './catalog-api.model';
import { CatalogService } from './catalog.service';
import type { StatusTone } from '../../../core/status-maps';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface AirportRow {
  id: string;
  iataCode: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  status: string;
}

interface AirportForm {
  iataCode: string;
  icaoCode: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

const TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
];

const DUPLICATE_IATA_MESSAGE = 'An airport with this IATA code already exists.';

@Component({
  selector: 'na-admin-airports',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaDataTable, NaSkeleton],
  templateUrl: './airports.component.html',
  styleUrl: './airports.component.css',
})
export class AirportsPage {
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  readonly columns: TableColumn<AirportRow>[] = [
    { key: 'iataCode', label: 'IATA' },
    { key: 'name', label: 'Name' },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country', priority: 'low' },
    { key: 'timezone', label: 'Timezone', priority: 'low' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({ text: r.status, tone: r.status === 'Active' ? 'success' : 'neutral' }),
    },
  ];
  readonly timezones = TIMEZONES;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly airports = signal<Airport[]>([]);
  readonly routes = signal<Route[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(
    () => this.airports().find((a) => a.id === this.selectedId()) ?? null,
  );

  readonly createOpen = signal(false);
  readonly toggleDialogOpen = signal(false);
  readonly submitting = signal(false);
  readonly errors = signal<Partial<Record<keyof AirportForm, string>>>({});

  form: AirportForm = { iataCode: '', icaoCode: '', name: '', city: '', country: '', timezone: '' };

  readonly rows = computed<AirportRow[]>(() =>
    this.airports().map((a) => ({
      id: a.id,
      iataCode: a.iataCode,
      name: a.name,
      city: a.city,
      country: a.country,
      timezone: a.timezone,
      status: a.status === 'ACTIVE' ? 'Active' : 'Inactive',
    })),
  );

  constructor() {
    this.load();
  }

  /** Airports and routes load once together; route counts derive client-side. */
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      airports: this.catalog.listAirports(),
      routes: this.catalog.listRoutes(),
    }).subscribe({
      next: ({ airports, routes }) => {
        this.airports.set(airports);
        this.routes.set(routes);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load the airport catalog.'));
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

  routeCount(a: Airport, direction: 'origin' | 'destination'): number {
    return this.routes().filter((r) =>
      direction === 'origin' ? r.originAirportId === a.id : r.destinationAirportId === a.id,
    ).length;
  }

  associatedRoutes(a: Airport): Route[] {
    return this.routes().filter(
      (r) => r.originAirportId === a.id || r.destinationAirportId === a.id,
    );
  }

  statusTone(a: Airport): StatusTone {
    return a.status === 'ACTIVE' ? 'success' : 'neutral';
  }

  openCreate(): void {
    this.form = { iataCode: '', icaoCode: '', name: '', city: '', country: '', timezone: '' };
    this.errors.set({});
    this.createOpen.set(true);
  }

  submitCreate(event: Event): void {
    event.preventDefault();
    const errs: Partial<Record<keyof AirportForm, string>> = {};
    const iata = this.form.iataCode.trim().toUpperCase();
    const icao = this.form.icaoCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata))
      errs.iataCode = 'IATA code must be exactly three uppercase letters.';
    else if (this.airports().some((a) => a.iataCode === iata))
      errs.iataCode = DUPLICATE_IATA_MESSAGE;
    if (icao && !/^[A-Z]{4}$/.test(icao))
      errs.icaoCode = 'ICAO code must be four uppercase letters.';
    if (!this.form.name.trim()) errs.name = 'Airport name is required.';
    if (!this.form.city.trim()) errs.city = 'City is required.';
    if (!this.form.country.trim()) errs.country = 'Country is required.';
    if (!this.form.timezone) errs.timezone = 'Timezone is required.';
    this.errors.set(errs);
    if (Object.keys(errs).length > 0) return;

    // DTO fields only — the server assigns the id and the initial status.
    const payload: AirportPayload = {
      iataCode: iata,
      name: this.form.name.trim(),
      city: this.form.city.trim(),
      country: this.form.country.trim(),
      timezone: this.form.timezone,
    };
    if (icao) payload.icaoCode = icao;

    this.submitting.set(true);
    this.catalog.createAirport(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.airports.update((list) => [...list, created]);
        this.createOpen.set(false);
        this.toast.success(`Airport ${created.iataCode} added to the catalog.`);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const status = (err as { status?: number } | null)?.status;
        if (status === 409) {
          this.errors.set({ iataCode: DUPLICATE_IATA_MESSAGE });
        } else {
          this.toast.error(toErrorMessage(err, 'Could not add the airport. Please try again.'));
        }
      },
    });
  }

  confirmToggle(): void {
    this.toggleDialogOpen.set(false);
    const a = this.selected();
    if (!a) return;
    const next = a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.catalog.updateAirport(a.id, { status: next }).subscribe({
      next: (updated) => {
        this.airports.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.toast.success(
          next === 'ACTIVE' ? `${a.iataCode} reactivated.` : `${a.iataCode} deactivated.`,
        );
      },
      error: (err: unknown) =>
        this.toast.error(toErrorMessage(err, 'Could not update the airport status.')),
    });
  }
}
