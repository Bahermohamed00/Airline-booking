import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { FlightService, flightDurationLabel } from '../../../core/services/flight.service';
import { FLIGHT_STATUS_MAP, SCHEDULE_STATUS_MAP, statusLabel } from '../../../core/status-maps';
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
  imports: [
    ReactiveFormsModule,
    NaTabs,
    NaBadge,
    NaButton,
    NaAlert,
    NaSkeleton,
    NaEmptyState,
    NaAutocomplete,
    NaTimeline,
    NaRouteLine,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flight-status.component.html',
  styleUrl: './flight-status.component.css',
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

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
      {
        label: 'Scheduled',
        detail: `${f.route.origin.iataCode} → ${f.route.destination.iataCode}`,
        timestamp: this.fmt(f.departureTime),
        tone: 'info',
      },
    ];
    if (f.status === 'CANCELLED' || f.scheduleStatus === 'CANCELLED') {
      events.push({
        label: 'Flight cancelled',
        detail: 'Contact NovaAir support for rebooking options.',
        tone: 'danger',
      });
      return events;
    }
    if (this.isDelayed(f)) {
      events.push({
        label: 'Delayed',
        detail: `New estimated departure ${this.timeFmt(this.estimate(f.departureTime))}`,
        tone: 'warning',
      });
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
