import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { REFUND_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { BOOKINGS } from '../../../core/mock/mock-data';
import type { RefundStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

interface RefundRow {
  id: string;
  bookingReference: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  createdAt: string;
}

@Component({
  selector: 'na-admin-refunds',
  standalone: true,
  imports: [HasPermissionDirective, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Refunds</h1>
        <p class="page__sub">Review the refund queue and approve or reject requests.</p>
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (refunds().length === 0) {
        <na-empty-state icon="↩" title="Queue is empty" message="There are no refund requests at the moment." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Requested</th>
                <th><span class="na-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of refunds(); track row.id) {
                <tr>
                  <td data-label="Booking" class="na-text-mono">{{ row.bookingReference }}</td>
                  <td data-label="Amount">{{ money(row.amount, row.currency) }}</td>
                  <td data-label="Reason">{{ row.reason }}</td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, row.status).tone">
                      {{ statusLabel(REFUND_STATUS_MAP, row.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Requested">{{ fmtDate(row.createdAt) }}</td>
                  <td data-label="Actions" class="actions">
                    @if (row.status === 'PENDING') {
                      <span *naHasPermission="'payments:refund'" class="actions__group">
                        <na-button variant="primary" size="sm" (clicked)="ask(row, 'APPROVED')">Approve</na-button>
                        <na-button variant="danger" size="sm" (clicked)="ask(row, 'REJECTED')">Reject</na-button>
                      </span>
                    } @else {
                      <span class="na-text-muted na-text-small">Decided</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <na-dialog
        [open]="pending() !== null"
        [title]="pending()?.decision === 'APPROVED' ? 'Approve refund' : 'Reject refund'"
        [confirmLabel]="pending()?.decision === 'APPROVED' ? 'Approve' : 'Reject'"
        [confirmDanger]="pending()?.decision === 'REJECTED'"
        (confirmed)="confirm()"
        (cancelled)="pending.set(null)"
      >
        @if (pending(); as p) {
          <p>
            {{ p.decision === 'APPROVED' ? 'Approve' : 'Reject' }} the refund of
            <strong>{{ money(p.row.amount, p.row.currency) }}</strong> for booking
            <span class="na-text-mono">{{ p.row.bookingReference }}</span>?
          </p>
          <p class="na-text-muted na-text-small">
            {{ p.decision === 'APPROVED'
              ? 'Approved refunds are handed to the payment provider for processing.'
              : 'The customer will be notified that the refund request was rejected.' }}
          </p>
        }
      </na-dialog>
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    .actions { white-space: nowrap; }
    .actions__group { display: inline-flex; gap: var(--na-space-2); }
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
  private readonly toast = inject(ToastService);

  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly money = formatMoney;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Refunds' },
  ];

  readonly loading = signal(true);
  readonly refunds = signal<RefundRow[]>([]);
  readonly pending = signal<{ row: RefundRow; decision: 'APPROVED' | 'REJECTED' } | null>(null);

  constructor() {
    setTimeout(() => {
      this.refunds.set(
        BOOKINGS.flatMap((b) =>
          b.refunds.map((r) => ({
            id: r.id,
            bookingReference: b.bookingReference,
            amount: r.amount,
            currency: r.currency,
            reason: r.reason ?? 'No reason given',
            status: r.status,
            createdAt: r.createdAt,
          })),
        ),
      );
      this.loading.set(false);
    }, 300);
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  ask(row: RefundRow, decision: 'APPROVED' | 'REJECTED'): void {
    this.pending.set({ row, decision });
  }

  confirm(): void {
    const p = this.pending();
    if (!p) return;
    this.refunds.update((list) =>
      list.map((r) => (r.id === p.row.id ? { ...r, status: p.decision } : r)),
    );
    this.toast.success(
      p.decision === 'APPROVED'
        ? `Refund for ${p.row.bookingReference} approved and queued for processing.`
        : `Refund for ${p.row.bookingReference} rejected.`,
    );
    this.pending.set(null);
  }
}
