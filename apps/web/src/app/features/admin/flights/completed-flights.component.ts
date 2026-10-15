import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlightOpsService, type CompletedFlightItem } from './flight-ops.service';
import { FLIGHT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';

interface CompletedRow {
  id: string;
  publicId: string;
  flightNumber: string;
  route: string;
  aircraft: string;
  departure: string;
  arrival: string;
  tripType: string;
  bookedSeats: string;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Completed Flights: flights whose lifecycle reached COMPLETED, queried from
 * the Flight table by status (never deleted, never duplicated). The arrival
 * time is the completion timestamp. Search accepts NV numbers, FL-xxxx public
 * IDs and airport codes; date range applies to the operating date.
 */
@Component({
  selector: 'na-admin-completed-flights',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaDataTable],
  templateUrl: './completed-flights.component.html',
  styleUrl: './completed-flights.component.css',
})
export class CompletedFlightsPage {
  private readonly ops = inject(FlightOpsService);

  readonly columns: TableColumn<CompletedRow>[] = [
    { key: 'publicId', label: 'Flight ID' },
    { key: 'flightNumber', label: 'Number' },
    { key: 'route', label: 'Route' },
    { key: 'aircraft', label: 'Aircraft', priority: 'low' },
    { key: 'departure', label: 'Departure' },
    { key: 'arrival', label: 'Arrived (completed)' },
    { key: 'tripType', label: 'Trip', priority: 'low' },
    { key: 'bookedSeats', label: 'Booked seats', priority: 'low' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<CompletedFlightItem[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  filterSearch = '';
  filterFrom = '';
  filterTo = '';

  private readonly filterChanges = new Subject<void>();

  readonly rows = computed<CompletedRow[]>(() =>
    this.items().map((f) => ({
      id: f.id,
      publicId: `FL-${1000 + f.publicNumber}`,
      flightNumber: f.flightNumber,
      route: `${f.route.origin.iataCode} → ${f.route.destination.iataCode}`,
      aircraft: f.aircraft.registration,
      departure: dateTimeFmt.format(new Date(f.departureTime)),
      arrival: dateTimeFmt.format(new Date(f.arrivalTime)),
      tripType: f.tripType === 'ROUND_TRIP' ? 'Round trip' : 'One way',
      bookedSeats: String(f.bookedSeats),
    })),
  );

  readonly selected = signal<CompletedFlightItem | null>(null);

  constructor() {
    this.filterChanges
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.loadError.set(null);
          return this.ops.completed(this.currentQuery()).pipe(
            // Handle errors per emission so the outer stream — and the Retry
            // button that feeds it — survives a failed request.
            catchError((err: unknown) => {
              this.loadError.set(toErrorMessage(err, 'Could not load completed flights.'));
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result === null) {
          return;
        }
        this.items.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      });
    this.load();
  }

  load(): void {
    this.filterChanges.next();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.filterChanges.next();
  }

  clearFilters(): void {
    this.filterSearch = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.page.set(1);
    this.filterChanges.next();
  }

  private currentQuery() {
    return {
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

  openDetail(id: string): void {
    this.selected.set(this.items().find((f) => f.id === id) ?? null);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  statusOf(f: CompletedFlightItem) {
    return statusLabel(FLIGHT_STATUS_MAP, f.status);
  }

  economyFare(f: CompletedFlightItem) {
    return f.fares.find((fare) => fare.cabinClass === 'ECONOMY') ?? f.fares[0];
  }

  formatMoney(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  formatDate(iso: string): string {
    return dateTimeFmt.format(new Date(iso));
  }
}
