import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlightOpsService, type HistoryItem, type HistoryQuery } from './flight-ops.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';

interface HistoryRow {
  id: string;
  time: string;
  action: string;
  target: string;
  actor: string;
  detail: string;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Action filter options grouped by Flight Management domain. */
const EVENT_OPTIONS: { group: string; events: string[] }[] = [
  {
    group: 'Flights',
    events: ['FLIGHT_CREATED', 'FLIGHT_UPDATED', 'FLIGHT_STATUS_CHANGED', 'FLIGHTS_GENERATED'],
  },
  { group: 'Airports', events: ['AIRPORT_CREATED', 'AIRPORT_UPDATED'] },
  { group: 'Aircraft', events: ['AIRCRAFT_CREATED', 'AIRCRAFT_UPDATED'] },
  {
    group: 'Routes',
    events: ['ROUTE_CREATED', 'ROUTE_UPDATED', 'SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_UPDATED'],
  },
];

/** Display labels for Flight Management audit actions. Raw values are preserved for the API. */
const EVENT_LABELS: Record<string, string> = {
  FLIGHT_CREATED: 'Flight created',
  FLIGHT_UPDATED: 'Flight updated',
  FLIGHT_STATUS_CHANGED: 'Flight status changed',
  FLIGHTS_GENERATED: 'Flights generated',
  AIRPORT_CREATED: 'Airport created',
  AIRPORT_UPDATED: 'Airport updated',
  AIRCRAFT_CREATED: 'Aircraft created',
  AIRCRAFT_UPDATED: 'Aircraft updated',
  ROUTE_CREATED: 'Route created',
  ROUTE_UPDATED: 'Route updated',
  SCHEDULE_RULE_CREATED: 'Schedule rule created',
  SCHEDULE_RULE_UPDATED: 'Schedule rule updated',
};

/** Display labels for the audit record type ("target"): the record the action affected. */
const TARGET_TYPE_LABELS: Record<string, string> = {
  Flight: 'Flight',
  Airport: 'Airport',
  Aircraft: 'Aircraft',
  Route: 'Route',
  ScheduleRule: 'Schedule rule',
};

/** Readable action label; unknown event names fall back to the raw value. */
export function eventLabel(action: string): string {
  return EVENT_LABELS[action] ?? action;
}

/** Readable record-type label; unknown types fall back to the raw value. */
export function targetTypeLabel(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? targetType;
}

/**
 * Flight Manager History — the immutable audit log, scoped to Flight
 * Management domain events. Read-only by design: no delete, no edit, no
 * bulk actions exist in the UI or the API.
 */
@Component({
  selector: 'na-admin-flight-history',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaDataTable],
  templateUrl: './flight-history.component.html',
  styleUrl: './flight-history.component.css',
})
export class FlightHistoryPage {
  private readonly ops = inject(FlightOpsService);

  readonly eventGroups = EVENT_OPTIONS;
  readonly actorTypes = ['Staff', 'User', 'Guest', 'System'];
  /** Display-only mapping; option values sent to the API stay raw. */
  readonly eventLabel = eventLabel;

  readonly columns: TableColumn<HistoryRow>[] = [
    { key: 'time', label: 'Time' },
    { key: 'action', label: 'Action' },
    // "Target" in the audit API = the record the action affected (targetType +
    // targetId UUID). Shown as the readable record type; the UUID stays
    // searchable via the search filter but is not displayed.
    { key: 'target', label: 'Affected record' },
    { key: 'actor', label: 'Actor', priority: 'low' },
    { key: 'detail', label: 'Details' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<HistoryItem[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  filterDomain: '' | NonNullable<HistoryQuery['domain']> = '';
  filterEvent = '';
  filterActorType = '';
  filterSearch = '';
  filterFrom = '';
  filterTo = '';

  private readonly filterChanges = new Subject<void>();

  readonly rows = computed<HistoryRow[]>(() =>
    this.items().map((item) => ({
      id: item.id,
      time: dateTimeFmt.format(new Date(item.createdAt)),
      action: eventLabel(item.action),
      target: targetTypeLabel(item.targetType),
      actor: item.actorType,
      detail: this.detail(item),
    })),
  );

  constructor() {
    this.filterChanges
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.loadError.set(null);
          return this.ops.history(this.currentQuery());
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.total.set(result.total);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loadError.set(toErrorMessage(err, 'Could not load history.'));
          this.loading.set(false);
        },
      });
    this.load();
  }

  load(): void {
    this.filterChanges.next();
  }

  onFilterChange(): void {
    this.page.set(1);
    if (this.filterEvent && this.filterDomain) {
      // An explicit event implies its domain; keep both consistent.
      const group = EVENT_OPTIONS.find((g) => g.group.toLowerCase() === this.filterDomain);
      if (group && !group.events.includes(this.filterEvent)) {
        this.filterEvent = '';
      }
    }
    this.filterChanges.next();
  }

  onDomainChange(): void {
    this.filterEvent = '';
    this.onFilterChange();
  }

  clearFilters(): void {
    this.filterDomain = '';
    this.filterEvent = '';
    this.filterActorType = '';
    this.filterSearch = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.page.set(1);
    this.filterChanges.next();
  }

  private currentQuery(): HistoryQuery {
    return {
      domain: this.filterDomain || undefined,
      event: this.filterEvent || undefined,
      actorType: this.filterActorType || undefined,
      search: this.filterSearch.trim() || undefined,
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
      page: this.page(),
      limit: this.limit(),
    };
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.filterChanges.next();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.filterChanges.next();
    }
  }

  /** Human-readable before/after detail derived from audit metadata. */
  detail(item: HistoryItem): string {
    const metadata = item.metadata ?? {};
    const previous = metadata['previousStatus'];
    const next = metadata['newStatus'];
    if (typeof previous === 'string' && typeof next === 'string') {
      // Status enum values render via the shared status-label convention.
      return `${statusLabel(FLIGHT_STATUS_MAP, previous).label} → ${statusLabel(FLIGHT_STATUS_MAP, next).label}`;
    }
    for (const key of ['flightNumber', 'publicId', 'iataCode', 'registration', 'name']) {
      const value = metadata[key];
      if (typeof value === 'string' && value) return value;
    }
    return '—';
  }
}
