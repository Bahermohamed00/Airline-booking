import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DashboardService,
  type DashboardData,
  type DashboardFlight,
  type DashboardBooking,
  type DashboardRange,
} from './dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP, BOOKING_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
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
  imports: [
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaAlert,
    NaSkeleton,
    NaEmptyState,
    NaSegmented,
    HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
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
    this.buildBars(
      (this.kpis()?.revenueTrend ?? []).map((p) => p.value),
      'Revenue',
      this.kpis()?.currency ?? 'EUR',
      true,
    ),
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
      {
        key: 'flights',
        label: 'Total flights',
        value: String(k.totalFlights),
        hint: 'Next 7 days scheduled',
      },
      {
        key: 'bookings',
        label: 'Bookings',
        value: String(k.totalBookings),
        hint: `${k.confirmedBookings} confirmed`,
      },
      {
        key: 'passengers',
        label: 'Passengers',
        value: String(k.passengers),
        hint: 'Across active bookings',
      },
      {
        key: 'occupancy',
        label: 'Occupancy',
        value: `${k.occupancyPercent}%`,
        hint: 'Average load factor (estimated)',
        accent: true,
      },
      { key: 'delayed', label: 'Delayed', value: String(k.delayedCount), hint: 'Needs monitoring' },
      {
        key: 'cancelled',
        label: 'Cancelled',
        value: String(k.cancelledCount),
        hint: 'Rebooking may be required',
      },
      {
        key: 'refunds',
        label: 'Pending refunds',
        value: String(k.pendingRefunds),
        hint: 'Awaiting approval',
      },
      {
        key: 'baggage',
        label: 'Open baggage cases',
        value: String(k.openBaggageCases),
        hint: 'Lost or delayed bags',
      },
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
