import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPaymentsService } from '../../../core/services/admin-payments.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { BOOKING_STATUS_MAP, PAYMENT_STATUS_MAP, REFUND_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { toErrorMessage, serverMessage } from '../../../shared/utils/http-error-message';
import type { PaymentStatus } from '../../../core/models/domain.model';
import type { AdminPayment, AdminPaymentQuery, RefundPaymentPayload } from '../../../core/models/payment.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaRefundDialog, type RefundRequest } from './refund-dialog.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function fmtDateTime(iso: string | null | undefined): string {
  return iso ? DATE_TIME.format(new Date(iso)) : '—';
}

interface PaymentRow {
  id: string;
  reference: string;
  amount: string;
  provider: string;
  providerReference: string;
  status: string;
  statusKey: PaymentStatus;
  paidAt: string;
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
  imports: [FormsModule, HasPermissionDirective, NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaSkeleton, NaDataTable, NaRefundDialog],
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
          <select id="payment-status" class="na-select" [ngModel]="statusFilter()" (ngModelChange)="onStatusChange($event)">
            <option value="ALL">All statuses</option>
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
        <na-button variant="secondary" [disabled]="payments().length === 0" (clicked)="exportCsv()">Export CSV</na-button>
      </div>

      @if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else {
        <na-data-table
          [columns]="columns"
          [rows]="tableRows()"
          [loading]="loading()"
          emptyTitle="No payments"
          emptyMessage="No payment transactions match the selected status."
          (rowClick)="openPayment($event.id)"
        />
      }

      @if (selectedId()) {
        <div class="backdrop" (click)="closeDrawer()" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Payment details"
          tabindex="-1"
          (keydown.escape)="closeDrawer()"
        >
          <header class="drawer__head">
            <h2 class="drawer__title">Payment details</h2>
            <button type="button" class="drawer__close" aria-label="Close payment details" (click)="closeDrawer()">×</button>
          </header>

          @if (detailLoading()) {
            <na-skeleton [rows]="[1, 2, 3, 4]" height="1.2rem" />
          } @else if (detailError()) {
            <div class="list-error" role="alert">
              <p>{{ detailError() }}</p>
              <na-button variant="secondary" size="sm" (clicked)="retryDetail()">Retry</na-button>
            </div>
          } @else if (detail(); as p) {
            <dl class="facts">
              <div>
                <dt>Booking</dt>
                <dd class="na-text-mono">{{ p.bookingReference }}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{{ p.contactEmail }}</dd>
              </div>
              <div>
                <dt>Booking status</dt>
                <dd>
                  <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, p.bookingStatus).tone">
                    {{ statusLabel(BOOKING_STATUS_MAP, p.bookingStatus).label }}
                  </na-badge>
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{{ money(p.amount, p.currency) }}</dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>
                  <na-badge [tone]="statusLabel(PAYMENT_STATUS_MAP, p.status).tone">
                    {{ statusLabel(PAYMENT_STATUS_MAP, p.status).label }}
                  </na-badge>
                </dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{{ p.provider }}</dd>
              </div>
              <div>
                <dt>Provider reference</dt>
                <dd class="na-text-mono">{{ p.providerReference ?? '—' }}</dd>
              </div>
              <div>
                <dt>Paid at</dt>
                <dd>{{ fmt(p.paidAt) }}</dd>
              </div>
              @if (p.failedAt) {
                <div>
                  <dt>Failed at</dt>
                  <dd>{{ fmt(p.failedAt) }}</dd>
                </div>
              }
              <div>
                <dt>Created</dt>
                <dd>{{ fmt(p.createdAt) }}</dd>
              </div>
            </dl>

            <h3 class="drawer__section">Refunds</h3>
            @if (p.refunds.length) {
              <ul class="plain-list">
                @for (r of p.refunds; track r.id) {
                  <li>
                    <strong>{{ money(r.amount, r.currency) }}</strong>
                    <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, r.status).tone">
                      {{ statusLabel(REFUND_STATUS_MAP, r.status).label }}
                    </na-badge>
                    <p class="na-text-small na-text-muted">
                      {{ r.reason ?? 'No reason given' }} ·
                      {{ r.processedAt ? 'processed ' + fmt(r.processedAt) : 'requested ' + fmt(r.createdAt) }}
                    </p>
                  </li>
                }
              </ul>
            } @else {
              <p class="na-text-muted na-text-small">No refunds issued against this payment.</p>
            }

            @if (refundable()) {
              <footer class="drawer__actions">
                <span *naHasPermission="'payments:refund'">
                  <na-button variant="primary" (clicked)="refundOpen.set(true)">Issue refund</na-button>
                </span>
              </footer>
            }
          }
        </aside>
      }

      <na-refund-dialog
        [open]="refundOpen()"
        [payment]="detail()"
        (submitted)="onRefund($event)"
        (cancelled)="onRefundCancelled()"
      />
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .toolbar { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--na-space-4); margin: var(--na-space-4) 0; flex-wrap: wrap; }
    .toolbar__filter { margin-bottom: 0; min-width: 220px; }
    .list-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    .list-error p { margin: 0; color: var(--na-ink-500); }
    .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 99; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 100; width: min(480px, 100vw); background: var(--na-surface-raised); border-left: 1px solid var(--na-border); box-shadow: var(--na-shadow-lg); display: flex; flex-direction: column; padding: var(--na-space-6); overflow-y: auto; }
    .drawer__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3); margin-bottom: var(--na-space-4); }
    .drawer__title { font-size: var(--na-text-xl); }
    .drawer__close { background: none; border: none; font-size: 1.5rem; color: var(--na-ink-500); min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md); }
    .drawer__close:hover { background: var(--na-surface-sunken); color: var(--na-ink-900); }
    .drawer__section { font-size: var(--na-text-base); margin: var(--na-space-4) 0 var(--na-space-2); }
    .drawer__actions { display: flex; gap: var(--na-space-3); flex-wrap: wrap; border-top: 1px solid var(--na-border); padding-top: var(--na-space-4); margin-top: var(--na-space-4); }
    .facts { margin: 0; display: grid; gap: var(--na-space-3); }
    .facts div { display: grid; grid-template-columns: 140px 1fr; gap: var(--na-space-3); }
    .facts dt { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .facts dd { margin: 0; }
    .plain-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .plain-list li { padding: var(--na-space-3); border: 1px solid var(--na-border); border-radius: var(--na-radius-md); }
    @media (max-width: 639px) {
      .drawer { width: 100vw; padding: var(--na-space-4); }
    }
  `,
})
export class AdminPaymentsPage {
  private readonly api = inject(AdminPaymentsService);
  private readonly toast = inject(ToastService);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly money = formatMoney;
  readonly fmt = fmtDateTime;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Payments' },
  ];

  readonly statusOptions = (Object.keys(PAYMENT_STATUS_MAP) as PaymentStatus[]).map((value) => ({
    value,
    label: PAYMENT_STATUS_MAP[value].label,
  }));

  readonly columns: TableColumn<PaymentRow>[] = [
    { key: 'reference', label: 'Booking' },
    { key: 'amount', label: 'Amount' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({ text: r.status, tone: statusLabel(PAYMENT_STATUS_MAP, r.statusKey).tone }),
    },
    { key: 'provider', label: 'Provider' },
    { key: 'providerReference', label: 'Provider reference', priority: 'low' },
    { key: 'paidAt', label: 'Paid at', priority: 'low' },
    { key: 'createdAt', label: 'Created', priority: 'low' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly payments = signal<AdminPayment[]>([]);
  readonly statusFilter = signal<'ALL' | PaymentStatus>('ALL');

  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<AdminPayment | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly refundOpen = signal(false);
  readonly refunding = signal(false);

  readonly tableRows = computed<PaymentRow[]>(() =>
    this.payments().map((p) => ({
      id: p.id,
      reference: p.bookingReference,
      amount: formatMoney(p.amount, p.currency),
      provider: p.provider,
      providerReference: p.providerReference ?? '—',
      status: statusLabel(PAYMENT_STATUS_MAP, p.status).label,
      statusKey: p.status,
      paidAt: fmtDateTime(p.paidAt),
      createdAt: fmtDateTime(p.createdAt),
    })),
  );

  /** Only a successful (or partially refunded) payment can be refunded further. */
  readonly refundable = computed(() => {
    const p = this.detail();
    return p !== null && (p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED');
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const status = this.statusFilter();
    const query: AdminPaymentQuery = status === 'ALL' ? {} : { status };
    this.api.listPayments(query).subscribe({
      next: (list) => {
        this.payments.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load payments. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as 'ALL' | PaymentStatus);
    this.load();
  }

  openPayment(id: string): void {
    this.selectedId.set(id);
    this.loadDetail(id);
  }

  closeDrawer(): void {
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
  }

  retryDetail(): void {
    const id = this.selectedId();
    if (id) this.loadDetail(id);
  }

  onRefund(request: RefundRequest): void {
    if (this.refunding()) return;
    this.refunding.set(true);
    const payload: RefundPaymentPayload = {};
    if (request.amount !== undefined) payload.amount = request.amount;
    if (request.reason !== undefined) payload.reason = request.reason;
    this.api.refund(request.paymentId, payload).subscribe({
      next: (result) => {
        this.refunding.set(false);
        this.refundOpen.set(false);
        this.detail.set(result.payment);
        this.load();
        this.toast.success(
          `Refund of ${formatMoney(result.refund.amount, result.refund.currency)} issued for ${result.refund.bookingReference}.`,
        );
      },
      error: (err: unknown) => {
        this.refunding.set(false);
        this.toast.error(
          toErrorMessage(
            err,
            'Could not issue the refund. Please try again.',
            serverMessage(err) ?? 'This payment is not refundable.',
          ),
        );
      },
    });
  }

  onRefundCancelled(): void {
    if (this.refunding()) return;
    this.refundOpen.set(false);
  }

  exportCsv(): void {
    downloadCsv(
      'payments.csv',
      ['Booking', 'Amount', 'Currency', 'Provider', 'Provider reference', 'Status', 'Paid at'],
      this.payments().map((p) => [
        p.bookingReference,
        p.amount.toFixed(2),
        p.currency,
        p.provider,
        p.providerReference ?? '',
        p.status,
        p.paidAt ?? p.createdAt,
      ]),
    );
    this.toast.success(`Exported ${this.payments().length} payment(s) to CSV.`);
  }

  private loadDetail(id: string): void {
    this.detail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.api.getPayment(id).subscribe({
      next: (payment) => {
        if (this.selectedId() !== id) return;
        this.detail.set(payment);
        this.detailLoading.set(false);
      },
      error: (err: unknown) => {
        if (this.selectedId() !== id) return;
        this.detailError.set(toErrorMessage(err, 'Could not load the payment details.'));
        this.detailLoading.set(false);
      },
    });
  }
}
