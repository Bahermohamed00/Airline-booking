import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPaymentsService } from '../../../core/services/admin-payments.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { PAYMENT_STATUS_MAP, REFUND_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { toErrorMessage, serverMessage } from '../../../shared/utils/http-error-message';
import type { RefundStatus } from '../../../core/models/domain.model';
import type { AdminPayment, AdminRefund, RefundPaymentPayload } from '../../../core/models/payment.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaRefundDialog, type RefundRequest } from './refund-dialog.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function fmtDateTime(iso: string | null | undefined): string {
  return iso ? DATE_TIME.format(new Date(iso)) : '—';
}

/** A payment can be refunded while it is (partially) successful. */
function isRefundable(p: AdminPayment): boolean {
  return p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED';
}

@Component({
  selector: 'na-admin-refunds',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState, NaRefundDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <div>
          <h1>Refunds</h1>
          <p class="page__sub">Refunds are processed by the payment provider as soon as they are issued.</p>
        </div>
        <span *naHasPermission="'payments:refund'">
          <na-button variant="primary" (clicked)="startRefund()">Issue refund</na-button>
        </span>
      </header>

      <div class="toolbar">
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-status">Status</label>
          <select id="refund-status" class="na-select" [ngModel]="statusFilter()" (ngModelChange)="onStatusChange($event)">
            <option value="ALL">All statuses</option>
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
      </div>

      @if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (refunds().length === 0) {
        <na-empty-state icon="↩" title="No refunds" message="No refunds match the selected status." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Processed</th>
              </tr>
            </thead>
            <tbody>
              @for (row of refunds(); track row.id) {
                <tr>
                  <td data-label="Booking" class="na-text-mono">{{ row.bookingReference }}</td>
                  <td data-label="Amount">{{ money(row.amount, row.currency) }}</td>
                  <td data-label="Reason">{{ row.reason ?? '—' }}</td>
                  <td data-label="Contact">{{ row.contactEmail }}</td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, row.status).tone">
                      {{ statusLabel(REFUND_STATUS_MAP, row.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Processed">{{ fmt(row.processedAt ?? row.createdAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <na-refund-dialog
        [open]="refundOpen()"
        [payment]="null"
        [payments]="refundablePayments()"
        [(paymentId)]="pickedPaymentId"
        (submitted)="onRefund($event)"
        (cancelled)="onRefundCancelled()"
      />
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); margin-bottom: var(--na-space-6); flex-wrap: wrap; }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .toolbar { display: flex; align-items: flex-end; gap: var(--na-space-4); margin: var(--na-space-4) 0; }
    .toolbar__filter { margin-bottom: 0; min-width: 220px; }
    .list-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    .list-error p { margin: 0; color: var(--na-ink-500); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminRefundsPage {
  private readonly api = inject(AdminPaymentsService);
  private readonly toast = inject(ToastService);

  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly money = formatMoney;
  readonly fmt = fmtDateTime;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Refunds' },
  ];

  readonly statusOptions = (Object.keys(REFUND_STATUS_MAP) as RefundStatus[]).map((value) => ({
    value,
    label: REFUND_STATUS_MAP[value].label,
  }));

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly refunds = signal<AdminRefund[]>([]);
  readonly statusFilter = signal<'ALL' | RefundStatus>('ALL');

  readonly refundOpen = signal(false);
  readonly refunding = signal(false);
  readonly refundablePayments = signal<AdminPayment[]>([]);
  readonly pickedPaymentId = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const status = this.statusFilter();
    this.api.listRefunds(status === 'ALL' ? {} : { status }).subscribe({
      next: (list) => {
        this.refunds.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load refunds. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as 'ALL' | RefundStatus);
    this.load();
  }

  /** Opens the refund dialog and loads the payments that can be refunded. */
  startRefund(): void {
    this.pickedPaymentId.set('');
    this.refundOpen.set(true);
    this.api.listPayments({}).subscribe({
      next: (list) => this.refundablePayments.set(list.filter(isRefundable)),
      error: (err: unknown) => {
        this.refundOpen.set(false);
        this.toast.error(toErrorMessage(err, 'Could not load refundable payments. Please try again.'));
      },
    });
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
        this.toast.success(
          `Refund of ${formatMoney(result.refund.amount, result.refund.currency)} issued for ${result.refund.bookingReference}.`,
        );
        this.load();
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
}
