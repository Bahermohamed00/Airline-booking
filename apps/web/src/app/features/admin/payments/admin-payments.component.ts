import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPaymentsService } from './admin-payments.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  BOOKING_STATUS_MAP,
  PAYMENT_STATUS_MAP,
  REFUND_STATUS_MAP,
  statusLabel,
} from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { toErrorMessage, serverMessage } from '../../../shared/utils/http-error-message';
import type { PaymentStatus } from '../../../core/models/domain.model';
import type {
  AdminPayment,
  AdminPaymentQuery,
  RefundPaymentPayload,
} from '../../../core/models/payment.model';
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
  imports: [
    FormsModule,
    HasPermissionDirective,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaAlert,
    NaSkeleton,
    NaDataTable,
    NaRefundDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-payments.component.html',
  styleUrl: './admin-payments.component.css',
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

  readonly crumbs = [{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Payments' }];

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
