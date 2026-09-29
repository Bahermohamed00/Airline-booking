import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AIRPORTS, ROUTES } from '../../../core/mock/mock-data';
import type { Airport } from '../../../core/models/domain.model';
import type { StatusTone } from '../../../core/status-maps';
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
  'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Amsterdam',
  'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore',
];

@Component({
  selector: 'na-admin-airports',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaDataTable, NaSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <na-breadcrumbs [items]="[{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Airports' }]" />
      <header class="page__head">
        <div>
          <h1>Airports</h1>
          <p class="subtitle">Airport catalog served by the NovaAir network.</p>
        </div>
        <na-button variant="cta" (clicked)="openCreate()">Add airport</na-button>
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4, 5]" height="2.5rem" />
      } @else {
        <na-data-table
          [columns]="columns"
          [rows]="rows()"
          emptyTitle="No airports"
          emptyMessage="The airport catalog is empty."
          (rowClick)="openDetail($event.id)"
        />
      }

      <!-- Detail drawer -->
      @if (selected(); as a) {
        <div class="backdrop" (click)="closeDetail()" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="a.name + ' details'">
          <header class="drawer__head">
            <div>
              <h2>{{ a.iataCode }} — {{ a.city }}</h2>
              <p class="subtitle">{{ a.name }}</p>
            </div>
            <button type="button" class="drawer__close" aria-label="Close details" (click)="closeDetail()">×</button>
          </header>
          <div class="drawer__body">
            <dl class="facts">
              <div><dt>Status</dt><dd><na-badge [tone]="statusTone(a)">{{ a.status === 'ACTIVE' ? 'Active' : 'Inactive' }}</na-badge></dd></div>
              <div><dt>ICAO code</dt><dd>{{ a.icaoCode ?? '—' }}</dd></div>
              <div><dt>Country</dt><dd>{{ a.country }}</dd></div>
              <div><dt>Timezone</dt><dd>{{ a.timezone }}</dd></div>
              <div><dt>Routes from here</dt><dd>{{ routeCount(a, 'origin') }}</dd></div>
              <div><dt>Routes to here</dt><dd>{{ routeCount(a, 'destination') }}</dd></div>
            </dl>

            @if (associatedRoutes(a).length > 0) {
              <h3>Associated routes</h3>
              <ul class="routes">
                @for (r of associatedRoutes(a); track r.id) {
                  <li class="na-text-mono">{{ r.origin.iataCode }} → {{ r.destination.iataCode }}</li>
                }
              </ul>
            }

            <div class="actions">
              <na-button
                [variant]="a.status === 'ACTIVE' ? 'danger' : 'primary'"
                size="sm"
                (clicked)="toggleDialogOpen.set(true)"
              >
                {{ a.status === 'ACTIVE' ? 'Deactivate airport' : 'Reactivate airport' }}
              </na-button>
            </div>
          </div>
        </aside>
      }

      <!-- Add airport drawer -->
      @if (createOpen()) {
        <div class="backdrop" (click)="createOpen.set(false)" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Add airport">
          <header class="drawer__head">
            <h2>Add airport</h2>
            <button type="button" class="drawer__close" aria-label="Close form" (click)="createOpen.set(false)">×</button>
          </header>
          <form class="drawer__body" (submit)="submitCreate($event)">
            <div class="na-field">
              <label class="na-label" for="ap-iata">IATA code</label>
              <input
                id="ap-iata" class="na-input" name="apIata" [(ngModel)]="form.iataCode"
                placeholder="FRA" required pattern="[A-Z]{3}" maxlength="3"
                [attr.aria-invalid]="errors().iataCode ? 'true' : null"
              />
              @if (errors().iataCode) { <p class="na-error" role="alert">{{ errors().iataCode }}</p> }
              <p class="na-hint">Exactly three uppercase letters.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="ap-icao">ICAO code <span class="na-hint">(optional)</span></label>
              <input
                id="ap-icao" class="na-input" name="apIcao" [(ngModel)]="form.icaoCode"
                placeholder="EDDF" pattern="[A-Z]{4}" maxlength="4"
                [attr.aria-invalid]="errors().icaoCode ? 'true' : null"
              />
              @if (errors().icaoCode) { <p class="na-error" role="alert">{{ errors().icaoCode }}</p> }
              <p class="na-hint">Four uppercase letters when provided.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="ap-name">Airport name</label>
              <input id="ap-name" class="na-input" name="apName" [(ngModel)]="form.name" required [attr.aria-invalid]="errors().name ? 'true' : null" />
              @if (errors().name) { <p class="na-error" role="alert">{{ errors().name }}</p> }
            </div>
            <div class="na-field">
              <label class="na-label" for="ap-city">City</label>
              <input id="ap-city" class="na-input" name="apCity" [(ngModel)]="form.city" required [attr.aria-invalid]="errors().city ? 'true' : null" />
              @if (errors().city) { <p class="na-error" role="alert">{{ errors().city }}</p> }
            </div>
            <div class="na-field">
              <label class="na-label" for="ap-country">Country</label>
              <input id="ap-country" class="na-input" name="apCountry" [(ngModel)]="form.country" required [attr.aria-invalid]="errors().country ? 'true' : null" />
              @if (errors().country) { <p class="na-error" role="alert">{{ errors().country }}</p> }
            </div>
            <div class="na-field">
              <label class="na-label" for="ap-tz">Timezone</label>
              <select id="ap-tz" class="na-select" name="apTz" [(ngModel)]="form.timezone" required [attr.aria-invalid]="errors().timezone ? 'true' : null">
                <option value="" disabled>Select a timezone…</option>
                @for (tz of timezones; track tz) {
                  <option [value]="tz">{{ tz }}</option>
                }
              </select>
              @if (errors().timezone) { <p class="na-error" role="alert">{{ errors().timezone }}</p> }
            </div>
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="createOpen.set(false)">Cancel</na-button>
              <na-button variant="cta" type="submit">Add airport</na-button>
            </div>
          </form>
        </aside>
      }

      <na-dialog
        [open]="toggleDialogOpen()"
        [title]="selected()?.status === 'ACTIVE' ? 'Deactivate airport?' : 'Reactivate airport?'"
        [confirmLabel]="selected()?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'"
        [confirmDanger]="selected()?.status === 'ACTIVE'"
        (confirmed)="confirmToggle()"
        (cancelled)="toggleDialogOpen.set(false)"
      >
        {{ selected()?.iataCode }} ({{ selected()?.name }}) will
        {{ selected()?.status === 'ACTIVE' ? 'no longer be available for new routes and flights' : 'become available for scheduling again' }}.
      </na-dialog>
    </div>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: var(--na-space-5); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .subtitle { color: var(--na-ink-500); margin-top: var(--na-space-1); }
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
    .routes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--na-space-2); }
    .actions { margin-top: var(--na-space-6); }
    @media (max-width: 639px) {
      .facts { grid-template-columns: 1fr; }
    }
  `,
})
export class AirportsPage {
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
  readonly airports = signal<Airport[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.airports().find((a) => a.id === this.selectedId()) ?? null);

  readonly createOpen = signal(false);
  readonly toggleDialogOpen = signal(false);
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
    setTimeout(() => {
      this.airports.set(AIRPORTS.map((a) => ({ ...a })));
      this.loading.set(false);
    }, 300);
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  routeCount(a: Airport, direction: 'origin' | 'destination'): number {
    return ROUTES.filter((r) =>
      direction === 'origin' ? r.originAirportId === a.id : r.destinationAirportId === a.id,
    ).length;
  }

  associatedRoutes(a: Airport) {
    return ROUTES.filter((r) => r.originAirportId === a.id || r.destinationAirportId === a.id);
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
    if (!/^[A-Z]{3}$/.test(iata)) errs.iataCode = 'IATA code must be exactly three uppercase letters.';
    else if (this.airports().some((a) => a.iataCode === iata)) errs.iataCode = 'An airport with this IATA code already exists.';
    if (icao && !/^[A-Z]{4}$/.test(icao)) errs.icaoCode = 'ICAO code must be four uppercase letters.';
    if (!this.form.name.trim()) errs.name = 'Airport name is required.';
    if (!this.form.city.trim()) errs.city = 'City is required.';
    if (!this.form.country.trim()) errs.country = 'Country is required.';
    if (!this.form.timezone) errs.timezone = 'Timezone is required.';
    this.errors.set(errs);
    if (Object.keys(errs).length > 0) return;

    this.airports.update((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        iataCode: iata,
        icaoCode: icao || null,
        name: this.form.name.trim(),
        city: this.form.city.trim(),
        country: this.form.country.trim(),
        timezone: this.form.timezone,
        status: 'ACTIVE',
      },
    ]);
    this.createOpen.set(false);
    this.toast.success(`Airport ${iata} added to the catalog.`);
  }

  confirmToggle(): void {
    this.toggleDialogOpen.set(false);
    const a = this.selected();
    if (!a) return;
    const next = a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.airports.update((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    this.toast.success(
      next === 'ACTIVE' ? `${a.iataCode} reactivated.` : `${a.iataCode} deactivated.`,
    );
  }
}
