import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DashboardService, type DashboardData, type DashboardFlight, type DashboardBooking, type DashboardRange } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP, BOOKING_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaSegmented, type SegmentOption } from '../../../shared/ui/segmented.component';

interface KpiCard {
  key: string;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}

interface ChartBar {
  label: string;
  value: number;
  heightPct: number;
  tooltip: string;
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

@Component({
  selector: 'na-admin-dashboard',
  standalone: true,
  imports: [NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState, NaSegmented, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <na-breadcrumbs [items]="[{ label: 'Overview' }]" />
      <header class="page__head">
        <div>
          <h1>Operations overview</h1>
          <p class="subtitle">Network performance, today's operations and alerts at a glance.</p>
        </div>
        <na-segmented
          [options]="rangeOptions"
          [value]="range()"
          ariaLabel="Trend time range"
          (valueChange)="setRange($event)"
        />
      </header>

      @if (loading()) {
        <div class="kpi-grid">
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8, 9]; track i) {
            <div class="na-card kpi"><na-skeleton [rows]="[1, 2]" height="1.2rem" /></div>
          }
        </div>
      } @else if (loadError()) {
        <div class="na-card load-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else if (kpis(); as k) {
        <!-- KPI grid -->
        <section class="kpi-grid" aria-label="Key performance indicators">
          @for (card of kpiCards(); track card.key) {
            <div class="na-card kpi" [class.kpi--accent]="card.accent">
              <p class="kpi__label">{{ card.label }}</p>
              <p class="kpi__value">{{ card.value }}</p>
              <p class="kpi__hint">{{ card.hint }}</p>
            </div>
          }
          <ng-container *naHasPermission="'payments:read'">
            <div class="na-card kpi kpi--accent">
              <p class="kpi__label">Revenue</p>
              <p class="kpi__value">{{ k.revenue === null ? '—' : formatMoney(k.revenue, k.currency) }}</p>
              <p class="kpi__hint">{{ k.revenue === null ? 'Available once payments are implemented' : revenueDeltaHint() }}</p>
            </div>
          </ng-container>
        </section>

        <!-- Trends -->
        <ng-container *naHasPermission="'payments:read'">
          <section class="trends">
            <div class="na-card chart-card">
              <h3>Revenue trend</h3>
              <p class="chart-card__sub">Gross bookings revenue · last {{ range() }}</p>
              @if (k.revenueTrend === null) {
                <na-empty-state
                  title="No payment data yet"
                  message="Revenue trends will appear here once payment processing is implemented."
                />
              } @else {
                <div class="chart" role="img" [attr.aria-label]="'Revenue bar chart, peak ' + formatMoney(maxOf(revenueBars()), k.currency)">
                  <svg [attr.viewBox]="viewBox()" preserveAspectRatio="none" aria-hidden="true">
                    @for (bar of revenueBars(); track bar.label; let i = $index) {
                      <rect
                        class="bar bar--cta"
                        [attr.x]="barX(i)"
                        [attr.y]="100 - bar.heightPct"
                        [attr.width]="barWidth()"
                        [attr.height]="bar.heightPct"
                        rx="1.5"
                      >
                        <title>{{ bar.tooltip }}</title>
                      </rect>
                    }
                  </svg>
                </div>
              }
            </div>
            <div class="na-card chart-card">
              <h3>Bookings trend</h3>
              <p class="chart-card__sub">Bookings per day · last {{ range() }}</p>
              <div class="chart" role="img" [attr.aria-label]="'Bookings bar chart, peak ' + maxOf(bookingBars()) + ' bookings'">
                <svg [attr.viewBox]="viewBox()" preserveAspectRatio="none" aria-hidden="true">
                  @for (bar of bookingBars(); track bar.label; let i = $index) {
                    <rect
                      class="bar bar--navy"
                      [attr.x]="barX(i)"
                      [attr.y]="100 - bar.heightPct"
                      [attr.width]="barWidth()"
                      [attr.height]="bar.heightPct"
                      rx="1.5"
                    >
                      <title>{{ bar.tooltip }}</title>
                    </rect>
                  }
                </svg>
              </div>
            </div>
          </section>
        </ng-container>
        @if (!canViewRevenue()) {
          <div class="na-card denied">
            <na-empty-state
              icon="🔒"
              title="Financial data restricted"
              message="Your role does not include the payments:read permission, so revenue KPIs and trends are hidden."
            />
          </div>
        }

        <div class="columns">
          <!-- Today's operations -->
          <section class="na-card ops">
            <h3>Today's operations</h3>
            <div class="chips" aria-label="Flight status counts">
              <na-badge tone="info">{{ k.scheduledCount }} scheduled</na-badge>
              <na-badge tone="warning">{{ k.delayedCount }} delayed</na-badge>
              <na-badge tone="danger">{{ k.cancelledCount }} cancelled</na-badge>
              <na-badge tone="success">{{ k.completedCount }} completed</na-badge>
            </div>
            @if (k.todaysFlights.length === 0) {
              <na-empty-state title="No flights today" message="There are no departures scheduled for today." />
            } @else {
              <div class="ops__table-wrap">
                <table>
                  <thead>
                    <tr><th>Flight</th><th>Route</th><th>Time</th><th>Aircraft</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    @for (f of k.todaysFlights; track f.id) {
                      <tr>
                        <td class="na-text-mono">{{ f.flightNumber }}</td>
                        <td>{{ f.originIata }} → {{ f.destinationIata }}</td>
                        <td>{{ formatTime(f.departureTime) }}</td>
                        <td>{{ f.aircraftRegistration }}</td>
                        <td><na-badge [tone]="flightStatus(f).tone">{{ flightStatus(f).label }}</na-badge></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <div class="side">
            <!-- Recent bookings -->
            <section class="na-card recent">
              <h3>Recent bookings</h3>
              @if (k.recentBookings.length === 0) {
                <na-empty-state title="No bookings yet" message="New bookings will appear here as customers book flights." />
              } @else {
                <ul>
                  @for (b of k.recentBookings; track b.id) {
                    <li>
                      <span class="na-text-mono">{{ b.bookingReference }}</span>
                      <span class="recent__amount">{{ formatMoney(b.totalAmount, b.currency) }}</span>
                      <na-badge [tone]="bookingStatus(b).tone">{{ bookingStatus(b).label }}</na-badge>
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Alerts -->
            <section class="alerts" aria-label="Operational alerts">
              @if (k.delayedCount > 0) {
                <na-alert tone="warning" title="Delayed flights" icon="⚠">
                  {{ k.delayedCount }} flight(s) are currently delayed. Review knock-on effects for connections.
                </na-alert>
              }
              @if (k.pendingRefunds > 0) {
                <na-alert tone="warning" title="Pending refunds" icon="↩">
                  {{ k.pendingRefunds }} refund request(s) are waiting for approval.
                </na-alert>
              }
              @if (k.cancelledCount > 0) {
                <na-alert tone="danger" title="Cancelled flights" icon="✕">
                  {{ k.cancelledCount }} flight(s) cancelled. Affected passengers may need rebooking.
                </na-alert>
              }
              @if (k.delayedCount === 0 && k.pendingRefunds === 0 && k.cancelledCount === 0) {
                <na-alert tone="success" title="All clear" icon="✓">
                  No operational issues require attention right now.
                </na-alert>
              }
            </section>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: var(--na-space-5); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .subtitle { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .load-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-danger); border-radius: var(--na-radius-md); color: var(--na-danger); }
    .kpi-grid {
      display: grid; gap: var(--na-space-4);
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
    .kpi { padding: var(--na-space-4); }
    .kpi--accent { border-top: 3px solid var(--na-cta); }
    .kpi__label { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--na-ink-500); font-weight: var(--na-font-semibold); }
    .kpi__value { font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); color: var(--na-ink-900); margin-top: var(--na-space-1); }
    .kpi__hint { font-size: var(--na-text-xs); color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .trends { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4); }
    .chart-card { padding: var(--na-space-5); }
    .chart-card__sub { font-size: var(--na-text-sm); color: var(--na-ink-500); margin: var(--na-space-1) 0 var(--na-space-4); }
    .chart { height: 160px; border-bottom: 1px solid var(--na-border); }
    .chart svg { width: 100%; height: 100%; display: block; }
    .bar--cta { fill: var(--na-cta); }
    .bar--navy { fill: var(--na-navy-500); }
    .bar:hover { opacity: 0.8; }
    .denied { margin-top: 0; }
    .columns { display: grid; grid-template-columns: 2fr 1fr; gap: var(--na-space-4); align-items: start; }
    .ops { padding: var(--na-space-5); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--na-space-2); margin: var(--na-space-3) 0 var(--na-space-4); }
    .ops__table-wrap { overflow-x: auto; }
    .ops table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    .ops th { text-align: left; padding: var(--na-space-2) var(--na-space-3); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); white-space: nowrap; }
    .ops td { padding: var(--na-space-2) var(--na-space-3); border-bottom: 1px solid var(--na-border); }
    .ops tr:last-child td { border-bottom: none; }
    .side { display: flex; flex-direction: column; gap: var(--na-space-4); }
    .recent { padding: var(--na-space-5); }
    .recent ul { list-style: none; margin: var(--na-space-3) 0 0; padding: 0; display: flex; flex-direction: column; }
    .recent li { display: flex; align-items: center; gap: var(--na-space-3); padding: var(--na-space-2) 0; border-bottom: 1px solid var(--na-border); font-size: var(--na-text-sm); }
    .recent li:last-child { border-bottom: none; }
    .recent__amount { margin-left: auto; font-weight: var(--na-font-semibold); color: var(--na-ink-900); }
    .alerts { display: flex; flex-direction: column; gap: var(--na-space-3); }
    @media (max-width: 900px) {
      .trends, .columns { grid-template-columns: 1fr; }
      // Grid children default to min-content width; let the ops card shrink so
      // its table uses the wrap's internal horizontal scroll instead of growing the page.
      .columns > *, .ops { min-width: 0; }
    }
    @media (max-width: 639px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .kpi { min-width: 0; }
      .kpi__value { font-size: var(--na-text-xl); }
      .ops, .recent, .chart-card { padding: var(--na-space-4); }
      .ops td, .ops th { padding: var(--na-space-2); }
    }
  `,
})
export class DashboardPage {
  private readonly dashboard = inject(DashboardService);
  private readonly auth = inject(AuthService);

  readonly rangeOptions: SegmentOption[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly kpis = signal<DashboardData | null>(null);
  readonly range = signal<DashboardRange>('30d');

  setRange(value: string): void {
    if (value === '7d' || value === '30d' || value === '90d') {
      this.range.set(value);
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dashboard.getDashboard(this.range()).subscribe({
      next: (data) => {
        this.kpis.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load the operations dashboard. Please try again.');
      },
    });
  }

  readonly canViewRevenue = computed(() => this.auth.hasPermission('payments:read'));

  readonly revenueDeltaHint = computed(() => {
    const points = (this.kpis()?.revenueTrend ?? []).map((p) => p.value);
    if (points.length < 2) return 'Awaiting trend data';
    const mid = Math.floor(points.length / 2);
    const previous = points.slice(0, mid).reduce((sum, v) => sum + v, 0);
    const current = points.slice(mid).reduce((sum, v) => sum + v, 0);
    if (previous <= 0) return 'Awaiting trend data';
    const delta = ((current - previous) / previous) * 100;
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs previous period`;
  });

  readonly revenueBars = computed<ChartBar[]>(() =>
    this.buildBars((this.kpis()?.revenueTrend ?? []).map((p) => p.value), 'Revenue', this.kpis()?.currency ?? 'EUR', true),
  );
  readonly bookingBars = computed<ChartBar[]>(() =>
    this.buildBars(this.kpis()?.bookingsTrend.map((p) => p.value) ?? [], 'Bookings', '', false),
  );

  constructor() {
    this.load();
  }

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.kpis();
    if (!k) return [];
    return [
      { key: 'flights', label: 'Total flights', value: String(k.totalFlights), hint: 'Next 7 days scheduled' },
      { key: 'bookings', label: 'Bookings', value: String(k.totalBookings), hint: `${k.confirmedBookings} confirmed` },
      { key: 'passengers', label: 'Passengers', value: String(k.passengers), hint: 'Across active bookings' },
      { key: 'occupancy', label: 'Occupancy', value: `${k.occupancyPercent}%`, hint: 'Average load factor (estimated)', accent: true },
      { key: 'delayed', label: 'Delayed', value: String(k.delayedCount), hint: 'Needs monitoring' },
      { key: 'cancelled', label: 'Cancelled', value: String(k.cancelledCount), hint: 'Rebooking may be required' },
      { key: 'refunds', label: 'Pending refunds', value: String(k.pendingRefunds), hint: 'Awaiting approval' },
      { key: 'baggage', label: 'Open baggage cases', value: String(k.openBaggageCases), hint: 'Lost or delayed bags' },
    ];
  });

  private buildBars(values: number[], label: string, currency: string, money: boolean): ChartBar[] {
    const points = this.range() === '7d' ? values.slice(-7) : values;
    const max = Math.max(...points, 1);
    return points.map((v, i) => ({
      label: `${label} ${i}`,
      value: v,
      heightPct: Math.max(4, Math.round((v / max) * 100)),
      tooltip: `${label} day ${i + 1}: ${money ? formatMoney(v, currency) : v}`,
    }));
  }

  viewBox(): string {
    return `0 0 ${this.revenueBars().length * 10} 100`;
  }

  barWidth(): number {
    return 7;
  }

  barX(index: number): number {
    return index * 10 + 1.5;
  }

  maxOf(bars: ChartBar[]): number {
    return bars.reduce((m, b) => Math.max(m, b.value), 0);
  }

  formatMoney(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  formatTime(iso: string): string {
    return timeFmt.format(new Date(iso));
  }

  flightStatus(f: DashboardFlight) {
    return statusLabel(FLIGHT_STATUS_MAP, f.status);
  }

  bookingStatus(b: DashboardBooking) {
    return statusLabel(BOOKING_STATUS_MAP, b.status);
  }
}
