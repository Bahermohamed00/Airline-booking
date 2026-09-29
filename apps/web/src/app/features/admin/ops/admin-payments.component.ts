import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/ui/toast.service';
import { PAYMENT_STATUS_MAP, statusLabel } from '../../../shared/utils/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { BOOKINGS } from '../../../core/mock/mock-data';
import type { PaymentStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

interface PaymentRow {
  id: string;
  bookingReference: string;
  amount: number;
  currency: string;
  provider: string;
  providerReference: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
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
  selector: 'na-admin-payments',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Payments</h1>
        <p class="page__sub">All payment transactions across bookings.</p>
      </header>

      <na-alert tone="info" icon="🔒">
        Card data is tokenized by the payment provider — no raw card data is stored or displayed.
      </na-alert>

      <div class="toolbar">
        <div class="na-field toolbar__filter">
          <label class="na-label" for="payment-status">Status</label>
          <select id="payment-status" class="na-select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="ALL">All statuses</option>
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
        <na-button variant="secondary" [disabled]="filtered().length === 0" (clicked)="exportCsv()">Export CSV</na-button>
      </div>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else if (filtered().length === 0) {
        <na-empty-state icon="€" title="No payments" message="No payment transactions match the selected status." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Amount</th>
                <th>Provider</th>
                <th>Provider reference</th>
                <th>Status</th>
                <th>Paid at</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filtered(); track row.id) {
                <tr>
                  <td data-label="Booking" class="na-text-mono">{{ row.bookingReference }}</td>
                  <td data-label="Amount">{{ money(row.amount, row.currency) }}</td>
                  <td data-label="Provider">{{ row.provider }}</td>
                  <td data-label="Provider reference" class="na-text-mono">{{ row.providerReference || '—' }}</td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(PAYMENT_STATUS_MAP, row.status).tone">
                      {{ statusLabel(PAYMENT_STATUS_MAP, row.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Paid at">{{ fmtDate(row.paidAt ?? row.createdAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .toolbar { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--na-space-4); margin: var(--na-space-4) 0; flex-wrap: wrap; }
    .toolbar__filter { margin-bottom: 0; min-width: 220px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminPaymentsPage {
  private readonly toast = inject(ToastService);

  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly money = formatMoney;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Payments' },
  ];

  readonly statusOptions = (Object.keys(PAYMENT_STATUS_MAP) as PaymentStatus[]).map((value) => ({
    value,
    label: PAYMENT_STATUS_MAP[value].label,
  }));

  readonly loading = signal(true);
  readonly payments = signal<PaymentRow[]>([]);
  readonly statusFilter = signal<'ALL' | PaymentStatus>('ALL');

  readonly filtered = computed(() => {
    const filter = this.statusFilter();
    return this.payments().filter((p) => filter === 'ALL' || p.status === filter);
  });

  constructor() {
    setTimeout(() => {
      this.payments.set(
        BOOKINGS.flatMap((b) =>
          b.payments.map((p) => ({
            id: p.id,
            bookingReference: b.bookingReference,
            amount: p.amount,
            currency: p.currency,
            provider: p.provider,
            providerReference: p.providerReference ?? '',
            status: p.status,
            paidAt: p.paidAt ?? null,
            createdAt: p.createdAt,
          })),
        ),
      );
      this.loading.set(false);
    }, 300);
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  exportCsv(): void {
    downloadCsv(
      'payments.csv',
      ['Booking', 'Amount', 'Currency', 'Provider', 'Provider reference', 'Status', 'Paid at'],
      this.filtered().map((p) => [
        p.bookingReference,
        p.amount.toFixed(2),
        p.currency,
        p.provider,
        p.providerReference,
        p.status,
        p.paidAt ?? p.createdAt,
      ]),
    );
    this.toast.success(`Exported ${this.filtered().length} payment(s) to CSV.`);
  }
}
