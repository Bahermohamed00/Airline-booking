import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { FlightService, flightDurationLabel } from '../../../core/services/flight.service';
import { FLIGHT_STATUS_MAP, SCHEDULE_STATUS_MAP, statusLabel } from '../../../shared/utils/status-maps';
import { AIRPORTS } from '../../../core/mock/mock-data';
import type { Flight } from '../../../core/models/domain.model';
import { NaTabs } from '../../../shared/ui/tabs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaAutocomplete, AutocompleteOption } from '../../../shared/ui/autocomplete.component';
import { NaTimeline, TimelineEvent } from '../../../shared/ui/timeline.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';
import { ToastService } from '../../../shared/ui/toast.service';

const MOCK_DELAY_MINUTES = 45;

type ProgressState = 'done' | 'current' | 'upcoming' | 'warning' | 'danger';

interface ProgressStep {
  label: string;
  state: ProgressState;
}

@Component({
  selector: 'app-flight-status',
  standalone: true,
  imports: [ReactiveFormsModule, NaTabs, NaBadge, NaButton, NaAlert, NaSkeleton, NaEmptyState, NaAutocomplete, NaTimeline, NaRouteLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>Track your flight</h1>
        <p class="page__sub">Live departure and arrival information, by flight number or route.</p>
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
        <na-skeleton [rows]="[1]" height="26rem" />
      } @else if (searched() && flights().length === 0) {
        <na-empty-state title="No flights found" message="Check the flight number, date, or route and try again." />
      } @else if (flights().length > 0) {
        <p class="na-text-muted na-text-small updated">Last updated {{ fmt(lastUpdated()!) }}</p>
        <ul class="results" role="list">
          @for (f of flights(); track f.id) {
            <li class="result na-card">
              <div class="result__head">
                <div class="result__id">
                  <p class="result__flight">{{ f.flightNumber }}</p>
                  <div class="result__badges">
                    <na-badge class="result__status" [tone]="statusLabel(FLIGHT_STATUS_MAP, f.status).tone">
                      {{ statusLabel(FLIGHT_STATUS_MAP, f.status).label }}
                    </na-badge>
                    <na-badge [tone]="statusLabel(SCHEDULE_STATUS_MAP, f.scheduleStatus).tone">
                      {{ statusLabel(SCHEDULE_STATUS_MAP, f.scheduleStatus).label }}
                    </na-badge>
                  </div>
                </div>
                <na-button variant="secondary" size="sm" (clicked)="subscribe(f)">Subscribe to updates</na-button>
              </div>

              <div class="board">
                <na-route-line
                  size="lg"
                  [origin]="f.route.origin.iataCode"
                  [destination]="f.route.destination.iataCode"
                  [originCity]="f.route.origin.city"
                  [destinationCity]="f.route.destination.city"
                />
                <p class="board__meta">Flight time {{ duration(f) }}</p>

                <dl class="times">
                  <div class="times__side">
                    <div class="times__cell">
                      <dt>Scheduled</dt>
                      <dd>
                        @if (isDelayed(f)) {
                          <s class="times__old">{{ timeFmt(f.departureTime) }}</s>
                        } @else {
                          {{ timeFmt(f.departureTime) }}
                        }
                      </dd>
                    </div>
                    <div class="times__cell">
                      <dt>{{ hasDeparted(f) ? 'Departed' : 'Estimated departure' }}</dt>
                      <dd [class.times__delay]="isDelayed(f)">
                        {{ isDelayed(f) ? timeFmt(estimate(f.departureTime)) : timeFmt(f.departureTime) }}
                        @if (isDelayed(f)) {
                          <span class="times__note">+{{ delayMinutes }} min</span>
                        }
                      </dd>
                    </div>
                  </div>
                  <div class="times__side times__side--to">
                    <div class="times__cell">
                      <dt>{{ hasDeparted(f) ? 'Estimated arrival' : 'Arrival' }}</dt>
                      <dd [class.times__delay]="isDelayed(f)">
                        {{ isDelayed(f) ? timeFmt(estimate(f.arrivalTime)) : timeFmt(f.arrivalTime) }}
                      </dd>
                    </div>
                  </div>
                </dl>

                <ol class="progress" [attr.aria-label]="'Progress of flight ' + f.flightNumber">
                  @for (step of progressOf(f); track step.label) {
                    <li class="progress__step progress__step--{{ step.state }}">
                      <span class="progress__dot" aria-hidden="true"></span>
                      <span class="progress__label">
                        {{ step.label }}
                        @if (step.state === 'current') {
                          <span class="na-visually-hidden">(current)</span>
                        }
                        @if (step.state === 'warning') {
                          <span class="na-visually-hidden">(current, delayed)</span>
                        }
                      </span>
                    </li>
                  }
                </ol>
              </div>

              <p class="result__sub">Journey</p>
              <na-timeline [events]="timelineOf(f)" />
            </li>
          }
        </ul>
      } @else {
        <na-empty-state
          image="/assets/img/tarmac-terminal.jpg"
          title="Live flight status"
          message="Search for a flight to see live status."
        />
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-2); }
    .search { margin-top: var(--na-space-4); padding: var(--na-space-6); }
    .search__row { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--na-space-4); align-items: end; }
    .search__row .na-field { margin-bottom: 0; }
    .updated { margin: var(--na-space-6) 0 var(--na-space-2); }
    .results { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-4); }
    .result { padding: var(--na-space-6); }
    .result__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .result__id { display: flex; align-items: center; gap: var(--na-space-4); flex-wrap: wrap; }
    .result__flight {
      font-family: var(--na-font-display);
      font-size: clamp(var(--na-text-2xl), 1.2rem + 2vw, var(--na-text-3xl));
      font-weight: var(--na-font-bold); letter-spacing: -0.01em; color: var(--na-ink-900);
    }
    .result__badges { display: flex; align-items: center; gap: var(--na-space-2); }
    .result__status { display: inline-block; transform: scale(1.35); transform-origin: left center; margin-right: var(--na-space-3); }
    .board { margin-top: var(--na-space-5); }
    .board__meta { margin-top: var(--na-space-2); text-align: center; color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .times {
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--na-space-4) var(--na-space-6);
      margin: var(--na-space-4) 0 0; padding: var(--na-space-4) 0 0;
      border-top: 1px solid var(--na-border);
    }
    .times__side { display: flex; gap: var(--na-space-5) var(--na-space-6); flex-wrap: wrap; }
    .times__side--to { text-align: right; justify-content: flex-end; }
    .times dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--na-ink-500); margin-bottom: var(--na-space-1); }
    .times dd { margin: 0; font-size: var(--na-text-xl); font-weight: var(--na-font-semibold); color: var(--na-ink-900); }
    .times__delay { color: var(--na-warning); }
    .times__old { color: var(--na-ink-500); font-weight: var(--na-font-regular); }
    .times__note { font-size: var(--na-text-xs); letter-spacing: 0.04em; margin-left: var(--na-space-1); }
    .progress {
      list-style: none; margin: var(--na-space-6) 0 0; padding: 0;
      display: flex; justify-content: space-between; gap: var(--na-space-4);
      position: relative;
    }
    .progress::before {
      content: ''; position: absolute; top: 6px; left: 7px; right: 7px; height: 1px;
      background: var(--na-border-strong);
    }
    .progress__step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--na-space-2); min-width: 0; }
    .progress__step:first-child { align-items: flex-start; }
    .progress__step:last-child { align-items: flex-end; }
    .progress__dot {
      position: relative;
      width: 13px; height: 13px; border-radius: 50%; flex: none;
      border: 2px solid var(--na-border-strong); background: var(--na-surface-raised);
    }
    .progress__step--done .progress__dot { background: var(--na-success); border-color: var(--na-success); }
    .progress__step--current .progress__dot {
      background: var(--na-cta); border-color: var(--na-cta);
      box-shadow: 0 0 0 3px var(--na-surface-raised), 0 0 0 4px var(--na-cta);
    }
    .progress__step--warning .progress__dot {
      background: var(--na-warning); border-color: var(--na-warning);
      box-shadow: 0 0 0 3px var(--na-surface-raised), 0 0 0 4px var(--na-warning);
    }
    .progress__step--danger .progress__dot {
      background: var(--na-danger); border-color: var(--na-danger);
      box-shadow: 0 0 0 3px var(--na-surface-raised), 0 0 0 4px var(--na-danger);
    }
    .progress__label {
      font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--na-ink-300); text-align: center;
    }
    .progress__step:first-child .progress__label { text-align: left; }
    .progress__step:last-child .progress__label { text-align: right; }
    .progress__step--done .progress__label { color: var(--na-ink-500); }
    .progress__step--current .progress__label,
    .progress__step--warning .progress__label,
    .progress__step--danger .progress__label { color: var(--na-ink-900); font-weight: var(--na-font-semibold); }
    .result__sub {
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--na-ink-500);
      margin: var(--na-space-6) 0 var(--na-space-4); padding-top: var(--na-space-5);
      border-top: 1px solid var(--na-border);
    }
    @media (max-width: 639px) {
      .search__row { grid-template-columns: 1fr; }
      .result { padding: var(--na-space-5); }
      .result__flight { font-size: var(--na-text-xl); }
      .times dd { font-size: var(--na-text-lg); }
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
  readonly delayMinutes = MOCK_DELAY_MINUTES;

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

  hasDeparted(f: Flight): boolean {
    return f.status === 'ACTIVE' || f.status === 'COMPLETED';
  }

  estimate(iso: string): string {
    return new Date(new Date(iso).getTime() + MOCK_DELAY_MINUTES * 60000).toISOString();
  }

  duration(f: Flight): string {
    return flightDurationLabel(f);
  }

  progressOf(f: Flight): ProgressStep[] {
    if (f.status === 'CANCELLED' || f.scheduleStatus === 'CANCELLED') {
      return [
        { label: 'Scheduled', state: 'done' },
        { label: 'Cancelled', state: 'danger' },
      ];
    }
    if (f.status === 'COMPLETED') {
      return [
        { label: 'Scheduled', state: 'done' },
        { label: 'Departed', state: 'done' },
        { label: 'Arrived', state: 'done' },
      ];
    }
    if (f.status === 'ACTIVE') {
      return [
        { label: 'Scheduled', state: 'done' },
        { label: 'Departed', state: 'current' },
        { label: 'Arrived', state: 'upcoming' },
      ];
    }
    return [
      { label: 'Scheduled', state: this.isDelayed(f) ? 'warning' : 'current' },
      { label: 'Departed', state: 'upcoming' },
      { label: 'Arrived', state: 'upcoming' },
    ];
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
