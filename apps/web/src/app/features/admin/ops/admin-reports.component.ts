import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { formatMoney } from '../../../core/services/pricing.service';
import { BOOKINGS, FLIGHTS } from '../../../core/mock/mock-data';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

type ReportType = 'bookings' | 'revenue' | 'passengers' | 'occupancy' | 'cancellations';

interface ReportCard {
  id: ReportType;
  label: string;
  icon: string;
  description: string;
}

interface PreviewRow {
  metric: string;
  value: string;
}

const REPORT_CARDS: ReportCard[] = [
  { id: 'bookings', label: 'Bookings', icon: '▦', description: 'Volume and status breakdown of bookings.' },
  { id: 'revenue', label: 'Revenue', icon: '€', description: 'Ticket revenue and average booking value.' },
  { id: 'passengers', label: 'Passengers', icon: '◔', description: 'Traveller counts per booking.' },
  { id: 'occupancy', label: 'Occupancy', icon: '◨', description: 'Estimated seat load factor by flight.' },
  { id: 'cancellations', label: 'Cancellations', icon: '↩', description: 'Cancelled bookings and refunded amounts.' },
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, header: string[], rows: string[][]): void {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'na-admin-reports',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective, NaBreadcrumbs, NaButton, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Reports &amp; Analytics</h1>
        <p class="page__sub">Generate operational reports for a date range and export them as CSV.</p>
      </header>

      <div class="cards" role="radiogroup" aria-label="Report type">
        @for (card of cards; track card.id) {
          <button
            type="button"
            class="card na-card"
            [class.card--active]="reportType() === card.id"
            role="radio"
            [attr.aria-checked]="reportType() === card.id"
            (click)="selectType(card.id)"
          >
            <span class="card__icon" aria-hidden="true">{{ card.icon }}</span>
            <span class="card__label">{{ card.label }}</span>
            <span class="card__desc">{{ card.description }}</span>
          </button>
        }
      </div>

      <div class="range na-card">
        <div class="na-field range__field">
          <label class="na-label" for="report-from">From</label>
          <input id="report-from" class="na-input" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
        </div>
        <div class="na-field range__field">
          <label class="na-label" for="report-to">To</label>
          <input id="report-to" class="na-input" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
        </div>
        <na-button variant="primary" [loading]="generating()" (clicked)="generate()">Generate report</na-button>
      </div>

      @if (generating()) {
        <p class="na-text-muted na-text-small" role="status">Generating {{ activeCard().label }} report…</p>
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else if (preview().length) {
        <div class="result-head">
          <h2 class="result-title">{{ activeCard().label }} — {{ from() }} to {{ to() }}</h2>
          <span *naHasPermission="'reports:read'">
            <na-button variant="secondary" size="sm" (clicked)="exportCsv()">Export CSV</na-button>
          </span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Metric</th><th>Value</th></tr>
            </thead>
            <tbody>
              @for (row of preview(); track row.metric) {
                <tr>
                  <td data-label="Metric">{{ row.metric }}</td>
                  <td data-label="Value">{{ row.value }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <na-empty-state
          icon="◨"
          title="No report generated"
          message="Pick a report type and date range, then generate a preview."
        />
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--na-space-4); margin-bottom: var(--na-space-5); }
    .card { padding: var(--na-space-4); text-align: left; display: grid; gap: var(--na-space-1); cursor: pointer; transition: border-color var(--na-motion-fast), box-shadow var(--na-motion-fast); min-height: 44px; }
    .card:hover { border-color: var(--na-navy-300); }
    .card--active { border-color: var(--na-blue-600); box-shadow: var(--na-focus-ring); }
    .card__icon { font-size: var(--na-text-xl); color: var(--na-blue-600); }
    .card__label { font-weight: var(--na-font-semibold); }
    .card__desc { font-size: var(--na-text-xs); color: var(--na-ink-500); }
    .range { display: flex; gap: var(--na-space-4); align-items: flex-end; padding: var(--na-space-4); margin-bottom: var(--na-space-6); flex-wrap: wrap; }
    .range__field { margin-bottom: 0; min-width: 180px; }
    .result-head { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); margin-bottom: var(--na-space-3); flex-wrap: wrap; }
    .result-title { font-size: var(--na-text-xl); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
  `,
})
export class AdminReportsPage {
  private readonly toast = inject(ToastService);

  readonly crumbs = [
    { label: 'Admin', link: '/admin/dashboard' },
    { label: 'Reports & Analytics' },
  ];

  readonly cards = REPORT_CARDS;

  readonly reportType = signal<ReportType>('bookings');
  readonly from = signal(isoDay(new Date(Date.now() - 30 * 24 * 3600 * 1000)));
  readonly to = signal(isoDay(new Date(Date.now() + 14 * 24 * 3600 * 1000)));
  readonly generating = signal(false);
  readonly preview = signal<PreviewRow[]>([]);

  readonly activeCard = computed(() => this.cards.find((c) => c.id === this.reportType()) ?? this.cards[0]);

  selectType(id: ReportType): void {
    this.reportType.set(id);
    this.preview.set([]);
  }

  generate(): void {
    if (this.from() > this.to()) {
      this.toast.error('The "from" date must be before the "to" date.');
      return;
    }
    this.generating.set(true);
    this.preview.set([]);
    setTimeout(() => {
      this.preview.set(this.buildReport());
      this.generating.set(false);
      this.toast.success(`${this.activeCard().label} report generated.`);
    }, 600);
  }

  private bookingsInRange() {
    const { from, to } = { from: this.from(), to: this.to() };
    return BOOKINGS.filter((b) => {
      const day = isoDay(new Date(b.bookedAt));
      return day >= from && day <= to;
    });
  }

  private flightsInRange() {
    const { from, to } = { from: this.from(), to: this.to() };
    return FLIGHTS.filter((f) => {
      const day = isoDay(new Date(f.departureTime));
      return day >= from && day <= to;
    });
  }

  private buildReport(): PreviewRow[] {
    const bookings = this.bookingsInRange();
    const flights = this.flightsInRange();
    const active = bookings.filter((b) => b.status !== 'CANCELLED');
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED');
    const revenue = active.reduce((s, b) => s + b.totalAmount, 0);
    const passengers = bookings.reduce((s, b) => s + b.passengers.length, 0);

    switch (this.reportType()) {
      case 'bookings':
        return [
          { metric: 'Total bookings', value: String(bookings.length) },
          { metric: 'Confirmed / active', value: String(active.length) },
          { metric: 'Cancelled', value: String(cancelled.length) },
          { metric: 'Bookings per day (avg)', value: bookings.length ? (bookings.length / Math.max(1, this.rangeDays())).toFixed(1) : '0' },
        ];
      case 'revenue':
        return [
          { metric: 'Gross revenue (excl. cancelled)', value: formatMoney(revenue, 'EUR') },
          { metric: 'Average booking value', value: active.length ? formatMoney(revenue / active.length, 'EUR') : formatMoney(0, 'EUR') },
          { metric: 'Refunded amount', value: formatMoney(bookings.flatMap((b) => b.refunds).reduce((s, r) => s + r.amount, 0), 'EUR') },
        ];
      case 'passengers':
        return [
          { metric: 'Total passengers', value: String(passengers) },
          { metric: 'Adults', value: String(bookings.flatMap((b) => b.passengers).filter((p) => p.passengerType === 'ADULT').length) },
          { metric: 'Children', value: String(bookings.flatMap((b) => b.passengers).filter((p) => p.passengerType === 'CHILD').length) },
          { metric: 'Avg passengers per booking', value: bookings.length ? (passengers / bookings.length).toFixed(2) : '0' },
        ];
      case 'occupancy': {
        const occupancy = flights.map((f) => {
          const available = f.fares.reduce((s, fare) => s + fare.availableCount, 0);
          const sold = Math.max(0, f.aircraft.capacity - available);
          return sold / f.aircraft.capacity;
        });
        const avg = occupancy.length ? occupancy.reduce((a, b) => a + b, 0) / occupancy.length : 0;
        return [
          { metric: 'Flights in range', value: String(flights.length) },
          { metric: 'Average load factor (estimated)', value: `${Math.round(avg * 100)}%` },
          { metric: 'Seats offered', value: String(flights.reduce((s, f) => s + f.aircraft.capacity, 0)) },
        ];
      }
      case 'cancellations':
        return [
          { metric: 'Cancelled bookings', value: String(cancelled.length) },
          { metric: 'Cancellation rate', value: bookings.length ? `${Math.round((cancelled.length / bookings.length) * 100)}%` : '0%' },
          { metric: 'Refunds issued', value: formatMoney(cancelled.flatMap((b) => b.refunds).reduce((s, r) => s + r.amount, 0), 'EUR') },
          { metric: 'Revenue lost (cancelled)', value: formatMoney(cancelled.reduce((s, b) => s + b.totalAmount, 0), 'EUR') },
        ];
    }
  }

  private rangeDays(): number {
    return Math.round((new Date(this.to()).getTime() - new Date(this.from()).getTime()) / (24 * 3600 * 1000)) + 1;
  }

  exportCsv(): void {
    downloadCsv(
      `${this.reportType()}-report-${this.from()}_${this.to()}.csv`,
      ['Metric', 'Value'],
      this.preview().map((r) => [r.metric, r.value]),
    );
    this.toast.success('Report exported to CSV.');
  }
}
