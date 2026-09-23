import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { FlightService, flightDurationLabel } from '../../core/services/flight.service';
import { FLIGHT_STATUS_MAP, SCHEDULE_STATUS_MAP, statusLabel } from '../../core/status-maps';
import { AIRPORTS } from '../../core/mock/mock-data';
import type { Flight } from '../../core/models/domain.model';
import { NaTabs } from '../../shared/ui/tabs.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';
import { NaAutocomplete, AutocompleteOption } from '../../shared/ui/autocomplete.component';
import { NaTimeline, TimelineEvent } from '../../shared/ui/timeline.component';
import { ToastService } from '../../shared/ui/toast.service';

const MOCK_DELAY_MINUTES = 45;

@Component({
  selector: 'app-flight-status',
  standalone: true,
  imports: [ReactiveFormsModule, NaTabs, NaBadge, NaButton, NaAlert, NaSkeleton, NaEmptyState, NaAutocomplete, NaTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>Flight status</h1>
        <p class="na-text-muted">Check live departure and arrival information.</p>
      </header>

      <na-tabs [tabs]="modeTabs" [active]="mode()" ariaLabel="Flight status search mode" (tabChange)="setMode($event)" />

      <div class="search na-card">
        @if (mode() === 'number') {
          <form [formGroup]="numberForm" (ngSubmit)="searchByNumber()" class="search__row">
            <div class="na-field">
              <label class="na-label" for="flightNumber">Flight number</label>
              <input id="flightNumber" class="na-input" type="text" formControlName="flightNumber" placeholder="e.g. NV100" autocomplete="off" />
              @if (numberForm.controls.flightNumber.touched && numberForm.controls.flightNumber.errors?.['required']) {
                <span class="na-error">Flight number is required.</span>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="date">Date (optional)</label>
              <input id="date" class="na-input" type="date" formControlName="date" />
            </div>
            <na-button variant="cta" type="submit" [loading]="loading()" [disabled]="numberForm.invalid">Search</na-button>
          </form>
        } @else {
          <form class="search__row" (submit)="$event.preventDefault(); searchByRoute()">
            <na-autocomplete
              label="From"
              placeholder="Origin airport"
              [options]="airportOptions"
              (selected)="origin.set($event.value)"
            />
            <na-autocomplete
              label="To"
              placeholder="Destination airport"
              [options]="airportOptions"
              (selected)="destination.set($event.value)"
            />
            <na-button variant="cta" type="submit" [loading]="loading()" [disabled]="!origin() || !destination()">Search</na-button>
          </form>
        }
      </div>

      @if (error()) {
        <na-alert tone="danger" title="Status search failed" retryable (retry)="retry()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2]" height="8rem" />
      } @else if (searched() && flights().length === 0) {
        <na-empty-state title="No flights found" message="Check the flight number, date, or route and try again." />
      } @else if (flights().length > 0) {
        <p class="na-text-muted na-text-small updated">Last updated {{ fmt(lastUpdated()!) }}</p>
        <ul class="results">
          @for (f of flights(); track f.id) {
            <li class="result na-card">
              <div class="result__head">
                <div>
                  <p class="result__flight"><strong>{{ f.flightNumber }}</strong> · {{ f.route.origin.iataCode }}→{{ f.route.destination.iataCode }}</p>
                  <p class="na-text-muted na-text-small">{{ f.route.origin.city }} to {{ f.route.destination.city }} · {{ duration(f) }}</p>
                </div>
                <div class="result__badges">
                  <na-badge [tone]="statusLabel(FLIGHT_STATUS_MAP, f.status).tone">
                    {{ statusLabel(FLIGHT_STATUS_MAP, f.status).label }}
                  </na-badge>
                  <na-badge [tone]="statusLabel(SCHEDULE_STATUS_MAP, f.scheduleStatus).tone">
                    {{ statusLabel(SCHEDULE_STATUS_MAP, f.scheduleStatus).label }}
                  </na-badge>
                </div>
              </div>

              <div class="result__times">
                <div>
                  <p class="time-label">Departure</p>
                  @if (isDelayed(f)) {
                    <p><s class="na-text-muted">{{ timeFmt(f.departureTime) }}</s> <strong class="delay">{{ timeFmt(estimate(f.departureTime)) }} est.</strong></p>
                  } @else {
                    <p class="time">{{ timeFmt(f.departureTime) }}</p>
                  }
                  <p class="na-text-muted na-text-small">Terminal 1 · Gate A14</p>
                </div>
                <div>
                  <p class="time-label">Arrival</p>
                  @if (isDelayed(f)) {
                    <p><s class="na-text-muted">{{ timeFmt(f.arrivalTime) }}</s> <strong class="delay">{{ timeFmt(estimate(f.arrivalTime)) }} est.</strong></p>
                  } @else {
                    <p class="time">{{ timeFmt(f.arrivalTime) }}</p>
                  }
                  <p class="na-text-muted na-text-small">Terminal 4 · Belt 6</p>
                </div>
                <div class="result__subscribe">
                  <na-button variant="secondary" size="sm" (clicked)="subscribe(f)">Subscribe to updates</na-button>
                </div>
              </div>

              <na-timeline [events]="timelineOf(f)" />
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .page__head { margin-bottom: var(--na-space-6); }
    .search { margin-top: var(--na-space-4); padding: var(--na-space-5); }
    .search__row { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--na-space-4); align-items: end; }
    .updated { margin: var(--na-space-4) 0 var(--na-space-2); }
    .results { list-style: none; margin: var(--na-space-2) 0 0; padding: 0; display: grid; gap: var(--na-space-4); }
    .result { padding: var(--na-space-5); }
    .result__head { display: flex; justify-content: space-between; gap: var(--na-space-4); flex-wrap: wrap; margin-bottom: var(--na-space-4); }
    .result__flight { font-size: var(--na-text-lg); }
    .result__badges { display: flex; gap: var(--na-space-2); align-items: flex-start; }
    .result__times { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--na-space-4); padding: var(--na-space-4); background: var(--na-surface-sunken); border-radius: var(--na-radius-md); margin-bottom: var(--na-space-4); }
    .time-label { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); }
    .time { font-size: var(--na-text-xl); font-weight: var(--na-font-semibold); }
    .delay { color: var(--na-warning); font-size: var(--na-text-lg); }
    .result__subscribe { align-self: center; }
    @media (max-width: 639px) {
      .search__row { grid-template-columns: 1fr; }
      .result__times { grid-template-columns: 1fr; }
    }
  `,
})
export class FlightStatusPage {
  private readonly fb = inject(FormBuilder);
  private readonly flightService = inject(FlightService);
  private readonly toast = inject(ToastService);

  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly SCHEDULE_STATUS_MAP = SCHEDULE_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly modeTabs = [
    { id: 'number', label: 'By flight number' },
    { id: 'route', label: 'By route' },
  ];

  readonly mode = signal<'number' | 'route'>('number');
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly searched = signal(false);
  readonly flights = signal<Flight[]>([]);
  readonly lastUpdated = signal<Date | null>(null);
  readonly origin = signal<string | null>(null);
  readonly destination = signal<string | null>(null);

  readonly airportOptions: AutocompleteOption[] = AIRPORTS.map((a) => ({
    value: a.iataCode,
    label: `${a.iataCode} — ${a.city}`,
    hint: a.name,
  }));

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  private readonly tFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  readonly numberForm = this.fb.nonNullable.group({
    flightNumber: ['', Validators.required],
    date: [''],
  });

  setMode(id: string): void {
    this.mode.set(id === 'route' ? 'route' : 'number');
    this.error.set(false);
  }

  searchByNumber(): void {
    if (this.numberForm.invalid) return;
    const { flightNumber, date } = this.numberForm.getRawValue();
    this.run(() => this.flightService.flightStatusByNumber(flightNumber, date || undefined));
  }

  searchByRoute(): void {
    if (!this.origin() || !this.destination()) return;
    this.run(() => this.flightService.flightStatusByRoute(this.origin()!, this.destination()!));
  }

  retry(): void {
    if (this.mode() === 'number') this.searchByNumber();
    else this.searchByRoute();
  }

  subscribe(flight: Flight): void {
    this.toast.success(`You will receive status updates for ${flight.flightNumber}.`);
  }

  isDelayed(f: Flight): boolean {
    return f.status === 'DELAYED' || f.scheduleStatus === 'DELAYED';
  }

  estimate(iso: string): string {
    return new Date(new Date(iso).getTime() + MOCK_DELAY_MINUTES * 60000).toISOString();
  }

  duration(f: Flight): string {
    return flightDurationLabel(f);
  }

  timelineOf(f: Flight): TimelineEvent[] {
    const events: TimelineEvent[] = [
      { label: 'Scheduled', detail: `${f.route.origin.iataCode} → ${f.route.destination.iataCode}`, timestamp: this.fmt(f.departureTime), tone: 'info' },
    ];
    if (f.status === 'CANCELLED' || f.scheduleStatus === 'CANCELLED') {
      events.push({ label: 'Flight cancelled', detail: 'Contact NovaAir support for rebooking options.', tone: 'danger' });
      return events;
    }
    if (this.isDelayed(f)) {
      events.push({ label: 'Delayed', detail: `New estimated departure ${this.timeFmt(this.estimate(f.departureTime))}`, tone: 'warning' });
    }
    if (f.status === 'ACTIVE' || f.status === 'COMPLETED') {
      events.push({ label: 'Boarding completed', tone: 'neutral' });
      events.push({ label: 'Departed', timestamp: this.fmt(f.departureTime), tone: 'success' });
    }
    if (f.status === 'COMPLETED') {
      events.push({ label: 'Arrived', timestamp: this.fmt(f.arrivalTime), tone: 'success' });
    }
    return events;
  }

  fmt(value: string | Date): string {
    return this.dtFmt.format(typeof value === 'string' ? new Date(value) : value);
  }

  timeFmt(iso: string): string {
    return this.tFmt.format(new Date(iso));
  }

  private run(query: () => Observable<Flight[]>): void {
    this.loading.set(true);
    this.error.set(false);
    query().subscribe({
      next: (flights) => {
        this.flights.set(flights);
        this.loading.set(false);
        this.searched.set(true);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
