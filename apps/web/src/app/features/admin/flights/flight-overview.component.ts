import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlightOpsService, type FlightOverview, type HistoryItem } from './flight-ops.service';
import { mapFlight } from '../../../core/models/flight-api.model';
import { DashboardRealtimeService } from '../dashboard/dashboard-realtime.service';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface KpiCard {
  key: string;
  icon: string;
  label: string;
  value: number;
  hint: string;
}

interface UpcomingRow {
  id: string;
  publicId: string;
  flightNumber: string;
  route: string;
  departure: string;
  arrival: string;
  status: string;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_ORDER = ['SCHEDULED', 'BOARDING', 'DEPARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'ACTIVE', 'DELAYED'] as const;

/**
 * Flight Manager operational overview — FM-domain data only, live from the
 * database. Real-time: any flight-domain mutation invalidates via the
 * existing dashboard WebSocket channel and the overview re-fetches (REST
 * remains the source of truth).
 */
@Component({
  selector: 'na-admin-flight-overview',
  imports: [RouterLink, NaBreadcrumbs, NaButton, NaBadge, NaDataTable, NaSkeleton],
  templateUrl: './flight-overview.component.html',
  styleUrl: './flight-overview.component.css',
})
export class FlightOverviewPage {
  private readonly ops = inject(FlightOpsService);
  private readonly realtime = inject(DashboardRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly data = signal<FlightOverview | null>(null);

  readonly kpis = computed<KpiCard[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { key: 'total', icon: '✈', label: 'Total flights', value: d.totalFlights, hint: 'All flights in the system' },
      { key: 'upcoming', icon: '→', label: 'Upcoming', value: d.upcomingFlights, hint: 'Scheduled, not yet departed' },
      { key: 'active', icon: '◉', label: 'Active now', value: d.activeFlights, hint: 'Boarding · departed · arrived' },
      { key: 'completed', icon: '✓', label: 'Completed', value: d.completedFlights, hint: 'Finished operations' },
      { key: 'cancelled', icon: '✕', label: 'Cancelled', value: d.cancelledFlights, hint: 'Terminal cancellations' },
      { key: 'routes', icon: '◎', label: 'Routes', value: d.routes, hint: 'Active airport pairs' },
      { key: 'airports', icon: '⌂', label: 'Airports', value: d.airports, hint: 'Registered airports' },
      { key: 'aircraft', icon: '▲', label: 'Aircraft', value: d.aircraft, hint: 'Fleet aircraft' },
    ];
  });

  readonly statusBars = computed(() => {
    const d = this.data();
    if (!d) return [];
    const total = Math.max(1, d.totalFlights);
    return STATUS_ORDER.filter((s) => (d.statusBreakdown[s] ?? 0) > 0).map((status) => ({
      status,
      label: statusLabel(FLIGHT_STATUS_MAP, status).label,
      tone: statusLabel(FLIGHT_STATUS_MAP, status).tone,
      count: d.statusBreakdown[status] ?? 0,
      pct: Math.max(2, Math.round(((d.statusBreakdown[status] ?? 0) / total) * 100)),
    }));
  });

  readonly upcomingColumns: TableColumn<UpcomingRow>[] = [
    { key: 'publicId', label: 'Flight ID' },
    { key: 'flightNumber', label: 'Number' },
    { key: 'route', label: 'Route' },
    { key: 'departure', label: 'Departure' },
    { key: 'arrival', label: 'Arrival' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({
        text: r.status,
        tone: Object.values(FLIGHT_STATUS_MAP).find((v) => v.label === r.status)?.tone ?? 'neutral',
      }),
    },
  ];

  readonly upcomingRows = computed<UpcomingRow[]>(() =>
    (this.data()?.upcoming ?? []).map(mapFlight).map((f) => ({
      id: f.id,
      publicId: `FL-${1000 + f.publicNumber}`,
      flightNumber: f.flightNumber,
      route: `${f.route.origin.iataCode} → ${f.route.destination.iataCode}`,
      departure: dateTimeFmt.format(new Date(f.departureTime)),
      arrival: dateTimeFmt.format(new Date(f.arrivalTime)),
      status: statusLabel(FLIGHT_STATUS_MAP, f.status).label,
    })),
  );

  readonly recentActivity = computed(() => this.data()?.recentActivity ?? []);

  constructor() {
    this.load();
    this.realtime.connect();
    this.realtime.invalidate$
      .pipe(debounceTime(400), takeUntilDestroyed())
      .subscribe(() => this.load());
    this.destroyRef.onDestroy(() => this.realtime.disconnect());
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.ops.overview().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load the flight overview.'));
        this.loading.set(false);
      },
    });
  }

  activityLabel(item: HistoryItem): string {
    return item.action.replaceAll('_', ' ').toLowerCase();
  }

  activityDetail(item: HistoryItem): string {
    const metadata = item.metadata ?? {};
    const previous = metadata['previousStatus'];
    const next = metadata['newStatus'];
    if (typeof previous === 'string' && typeof next === 'string') {
      return `${previous} → ${next}`;
    }
    const flightNumber = metadata['flightNumber'];
    if (typeof flightNumber === 'string') return flightNumber;
    const iata = metadata['iataCode'];
    if (typeof iata === 'string') return iata;
    const registration = metadata['registration'];
    if (typeof registration === 'string') return registration;
    return item.targetId ?? item.targetType;
  }

  formatActivityTime(iso: string): string {
    return dateTimeFmt.format(new Date(iso));
  }

  formatMoney(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }
}
