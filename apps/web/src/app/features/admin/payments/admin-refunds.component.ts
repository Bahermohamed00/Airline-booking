import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPaymentsService, type AdminRefundQuery } from './admin-payments.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PAYMENT_STATUS_MAP, REFUND_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { formatMoney } from '../../../core/services/pricing.service';
import { toErrorMessage, serverMessage } from '../../../shared/utils/http-error-message';
import type { RefundStatus } from '../../../core/models/domain.model';
import type {
  AdminPayment,
  AdminRefund,
  OrphanProviderRefund,
  RefundOperations,
  RefundPaymentPayload,
} from '../../../core/models/payment.model';
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

/** Compact pending-age rendering: 42m / 3h 5m / 2d 4h. */
function fmtAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

/** A payment can be refunded while it is (partially) successful. */
function isRefundable(p: AdminPayment): boolean {
  return p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED';
}

type AgeBucket = 'ALL' | 'lt5m' | 'm5to15' | 'm15to60' | 'h1to6' | 'h6to24' | 'gt24h';

/** Presentation-only age ranges (minutes) mapped to backend pending-age filters. */
const AGE_RANGES: Record<Exclude<AgeBucket, 'ALL'>, { min?: number; max?: number }> = {
  lt5m: { max: 5 },
  m5to15: { min: 5, max: 15 },
  m15to60: { min: 15, max: 60 },
  h1to6: { min: 60, max: 360 },
  h6to24: { min: 360, max: 1440 },
  gt24h: { min: 1440 },
};

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
          <p class="page__sub">Refund operations, recovery and provider reconciliation.</p>
        </div>
        <span *naHasPermission="'payments:refund'">
          <na-button variant="primary" (clicked)="startRefund()">Issue refund</na-button>
        </span>
      </header>

      @if (ops(); as o) {
        @if (o.alerts.active.length > 0) {
          <div class="ops-alert" role="alert">
            <strong>Operational alert:</strong>
            <ul>
              @for (alert of o.alerts.active; track alert.code) {
                <li>{{ alert.detail }}</li>
              }
            </ul>
          </div>
        }
        <div class="ops-strip" aria-label="Refund operations summary">
          <span class="ops-chip">{{ o.pending.total }} pending</span>
          @if (o.pending.stuck > 0) {
            <span class="ops-chip ops-chip--danger">{{ o.pending.stuck }} stuck beyond {{ o.pending.stuckThresholdMinutes }}m</span>
          }
          @if (o.orphans.unmatched > 0) {
            <span class="ops-chip ops-chip--warning">{{ o.orphans.unmatched }} unmatched provider refund{{ o.orphans.unmatched === 1 ? '' : 's' }}</span>
          }
        </div>
      }

      <div class="toolbar">
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-status">Status</label>
          <select id="refund-status" class="na-select" [ngModel]="statusFilter()" (ngModelChange)="onFilterChange('status', $event)">
            <option value="ALL">All statuses</option>
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-age">Pending age</label>
          <select id="refund-age" class="na-select" [ngModel]="ageFilter()" (ngModelChange)="onFilterChange('age', $event)">
            @for (opt of ageOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-booking-ref">Booking reference</label>
          <input id="refund-booking-ref" class="na-input" type="text" placeholder="NVAB12"
            [ngModel]="bookingRefInput()" (ngModelChange)="bookingRefInput.set($event)" (change)="applyFilters()" />
        </div>
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-provider-ref">Provider reference</label>
          <input id="refund-provider-ref" class="na-input" type="text" placeholder="re_… or pi_…"
            [ngModel]="providerRefInput()" (ngModelChange)="providerRefInput.set($event)" (change)="applyFilters()" />
        </div>
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-id">Refund ID</label>
          <input id="refund-id" class="na-input" type="text" placeholder="Refund UUID"
            [ngModel]="refundIdInput()" (ngModelChange)="refundIdInput.set($event)" (change)="applyFilters()" />
        </div>
        <div class="na-field toolbar__filter">
          <label class="na-label" for="refund-payment-id">Payment ID</label>
          <input id="refund-payment-id" class="na-input" type="text" placeholder="Payment UUID"
            [ngModel]="paymentIdInput()" (ngModelChange)="paymentIdInput.set($event)" (change)="applyFilters()" />
        </div>
        <div class="na-field toolbar__filter toolbar__filter--date">
          <label class="na-label" for="refund-from">From</label>
          <input id="refund-from" class="na-input" type="date"
            [ngModel]="fromInput()" (ngModelChange)="fromInput.set($event)" (change)="applyFilters()" />
        </div>
        <div class="na-field toolbar__filter toolbar__filter--date">
          <label class="na-label" for="refund-to">To</label>
          <input id="refund-to" class="na-input" type="date"
            [ngModel]="toInput()" (ngModelChange)="toInput.set($event)" (change)="applyFilters()" />
        </div>
        <na-button variant="ghost" (clicked)="resetFilters()">Reset</na-button>
      </div>

      @if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (refunds().length === 0) {
        <na-empty-state icon="↩" title="No refunds" message="No refunds match the selected filters." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Age</th>
                <th>Provider</th>
                <th>Processed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of refunds(); track row.id) {
                <tr>
                  <td data-label="Booking" class="na-text-mono">{{ row.bookingReference }}</td>
                  <td data-label="Amount">{{ money(row.amount, row.currency) }}</td>
                  <td data-label="Reason">{{ row.reason ?? '—' }}</td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, row.status).tone">
                      {{ statusLabel(REFUND_STATUS_MAP, row.status).label }}
                    </na-badge>
                    @if (needsAttention(row)) {
                      <na-badge tone="danger">Needs attention</na-badge>
                    } @else if (row.status === 'PENDING' && row.pendingRecovery) {
                      <na-badge tone="warning">Recovery pending</na-badge>
                    }
                  </td>
                  <td data-label="Age">{{ row.pendingAgeMinutes !== null ? age(row.pendingAgeMinutes) : '—' }}</td>
                  <td data-label="Provider" class="na-text-mono">{{ row.providerReference ?? row.paymentProviderReference ?? '—' }}</td>
                  <td data-label="Processed">{{ fmt(row.processedAt ?? row.createdAt) }}</td>
                  <td data-label="Actions">
                    @if (row.status === 'PENDING') {
                      <span *naHasPermission="'payments:refund'">
                        <na-button variant="secondary" size="sm"
                          [disabled]="resumingId() !== null"
                          (clicked)="recover(row)">
                          {{ resumingId() === row.id ? 'Recovering…' : 'Recover' }}
                        </na-button>
                      </span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="pagination" aria-label="Refund pages">
          <na-button variant="secondary" size="sm" [disabled]="page() <= 1" (clicked)="prevPage()">Previous</na-button>
          <span class="pagination__info">Page {{ page() }} of {{ totalPages() }} · {{ total() }} records</span>
          <na-button variant="secondary" size="sm" [disabled]="page() >= totalPages()" (clicked)="nextPage()">Next</na-button>
        </nav>
      }

      @if (orphans().length > 0) {
        <section class="orphans" aria-label="Unmatched provider refunds">
          <h2>Unmatched provider refunds</h2>
          <p class="orphans__sub">
            These refunds exist at the payment provider but could not be matched to any NovaAir refund.
            They are never re-refunded automatically — investigate, then resolve.
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider refund</th>
                  <th>Payment reference</th>
                  <th>Amount</th>
                  <th>First seen</th>
                  <th>Resolution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (orphan of orphans(); track orphan.id) {
                  <tr>
                    <td data-label="Provider refund" class="na-text-mono">{{ orphan.providerRefundReference }}</td>
                    <td data-label="Payment reference" class="na-text-mono">{{ orphan.paymentProviderReference }}</td>
                    <td data-label="Amount">{{ money(orphan.amount, orphan.currency) }}</td>
                    <td data-label="First seen">{{ fmt(orphan.firstSeenAt) }}</td>
                    <td data-label="Resolution">
                      <input class="na-input na-input--sm" type="text" placeholder="Note (optional)"
                        [ngModel]="orphanNotes()[orphan.id] ?? ''"
                        (ngModelChange)="setOrphanNote(orphan.id, $event)" />
                    </td>
                    <td data-label="Actions">
                      <span *naHasPermission="'payments:refund'">
                        <na-button variant="secondary" size="sm"
                          [disabled]="resolvingId() !== null"
                          (clicked)="resolveOrphan(orphan)">
                          {{ resolvingId() === orphan.id ? 'Resolving…' : 'Resolve' }}
                        </na-button>
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
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
    .ops-alert { padding: var(--na-space-3) var(--na-space-4); border: 1px solid var(--na-danger, #c0392b); border-radius: var(--na-radius-lg); background: color-mix(in srgb, var(--na-danger, #c0392b) 8%, transparent); margin-bottom: var(--na-space-4); }
    .ops-alert ul { margin: var(--na-space-1) 0 0; padding-left: var(--na-space-5); }
    .ops-strip { display: flex; gap: var(--na-space-3); flex-wrap: wrap; margin-bottom: var(--na-space-4); }
    .ops-chip { padding: var(--na-space-1) var(--na-space-3); border: 1px solid var(--na-border); border-radius: 999px; font-size: var(--na-text-sm); background: var(--na-surface-raised); }
    .ops-chip--danger { border-color: var(--na-danger, #c0392b); color: var(--na-danger, #c0392b); font-weight: var(--na-font-semibold); }
    .ops-chip--warning { border-color: var(--na-warning, #b7791f); color: var(--na-warning, #b7791f); font-weight: var(--na-font-semibold); }
    .toolbar { display: flex; align-items: flex-end; gap: var(--na-space-4); margin: var(--na-space-4) 0; flex-wrap: wrap; }
    .toolbar__filter { margin-bottom: 0; min-width: 160px; }
    .toolbar__filter--date { min-width: 140px; }
    .list-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    .list-error p { margin: 0; color: var(--na-ink-500); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    td na-badge + na-badge { margin-left: var(--na-space-2); }
    .pagination { display: flex; align-items: center; gap: var(--na-space-4); justify-content: flex-end; margin-top: var(--na-space-4); }
    .pagination__info { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .orphans { margin-top: var(--na-space-8); }
    .orphans h2 { margin-bottom: var(--na-space-1); }
    .orphans__sub { color: var(--na-ink-500); font-size: var(--na-text-sm); margin-bottom: var(--na-space-4); max-width: 70ch; }
    .na-input--sm { padding: var(--na-space-1) var(--na-space-2); font-size: var(--na-text-sm); }
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
  readonly age = fmtAge;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Refunds' },
  ];

  readonly statusOptions = (Object.keys(REFUND_STATUS_MAP) as RefundStatus[]).map((value) => ({
    value,
    label: REFUND_STATUS_MAP[value].label,
  }));

  readonly ageOptions: Array<{ value: AgeBucket; label: string }> = [
    { value: 'ALL', label: 'Any pending age' },
    { value: 'lt5m', label: '< 5 minutes' },
    { value: 'm5to15', label: '5–15 minutes' },
    { value: 'm15to60', label: '15–60 minutes' },
    { value: 'h1to6', label: '1–6 hours' },
    { value: 'h6to24', label: '6–24 hours' },
    { value: 'gt24h', label: '> 24 hours' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly refunds = signal<AdminRefund[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  readonly statusFilter = signal<'ALL' | RefundStatus>('ALL');
  readonly ageFilter = signal<AgeBucket>('ALL');
  readonly bookingRefInput = signal('');
  readonly providerRefInput = signal('');
  readonly refundIdInput = signal('');
  readonly paymentIdInput = signal('');
  readonly fromInput = signal('');
  readonly toInput = signal('');

  readonly ops = signal<RefundOperations | null>(null);
  readonly orphans = signal<OrphanProviderRefund[]>([]);
  readonly orphanNotes = signal<Record<string, string>>({});
  readonly resumingId = signal<string | null>(null);
  readonly resolvingId = signal<string | null>(null);

  readonly refundOpen = signal(false);
  readonly refunding = signal(false);
  readonly refundablePayments = signal<AdminPayment[]>([]);
  readonly pickedPaymentId = signal('');

  constructor() {
    this.load();
    this.loadOperations();
    this.loadOrphans();
  }

  /** A stuck pending refund beyond the alert threshold needs attention. */
  needsAttention(row: AdminRefund): boolean {
    if (row.status !== 'PENDING' || row.pendingAgeMinutes === null) return false;
    const threshold = this.ops()?.pending.stuckThresholdMinutes ?? 60;
    return row.pendingAgeMinutes >= threshold;
  }

  private buildQuery(): AdminRefundQuery {
    const query: AdminRefundQuery = { page: this.page(), limit: this.limit() };
    const status = this.statusFilter();
    if (status !== 'ALL') query.status = status;
    const age = this.ageFilter();
    if (age !== 'ALL') {
      const range = AGE_RANGES[age];
      if (range.min !== undefined) query.pendingMinAgeMinutes = range.min;
      if (range.max !== undefined) query.pendingMaxAgeMinutes = range.max;
    }
    const bookingRef = this.bookingRefInput().trim();
    if (bookingRef) query.bookingReference = bookingRef;
    const providerRef = this.providerRefInput().trim();
    if (providerRef) query.providerReference = providerRef;
    const refundId = this.refundIdInput().trim();
    if (refundId) query.refundId = refundId;
    const paymentId = this.paymentIdInput().trim();
    if (paymentId) query.paymentId = paymentId;
    if (this.fromInput()) query.from = `${this.fromInput()}T00:00:00.000Z`;
    if (this.toInput()) query.to = `${this.toInput()}T23:59:59.999Z`;
    return query;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.listRefunds(this.buildQuery()).subscribe({
      next: (result) => {
        this.refunds.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load refunds. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  /** Operations strip is additive — failures never block the page. */
  loadOperations(): void {
    this.api.getRefundOperations().subscribe({
      next: (snapshot) => this.ops.set(snapshot),
      error: () => this.ops.set(null),
    });
  }

  loadOrphans(): void {
    this.api.listOrphanRefunds({ status: 'UNMATCHED', limit: 20 }).subscribe({
      next: (result) => this.orphans.set(result.items),
      error: () => this.orphans.set([]),
    });
  }

  onFilterChange(kind: 'status' | 'age', value: string): void {
    if (kind === 'status') this.statusFilter.set(value as 'ALL' | RefundStatus);
    else this.ageFilter.set(value as AgeBucket);
    this.applyFilters();
  }

  applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    this.statusFilter.set('ALL');
    this.ageFilter.set('ALL');
    this.bookingRefInput.set('');
    this.providerRefInput.set('');
    this.refundIdInput.set('');
    this.paymentIdInput.set('');
    this.fromInput.set('');
    this.toInput.set('');
    this.applyFilters();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  /**
   * Recovers a stuck PENDING refund through the existing Batch 1 recovery
   * core (same idempotency identity — never a new refund). The displayed
   * state is always reloaded from the server afterwards.
   */
  recover(row: AdminRefund): void {
    if (this.resumingId() !== null) return;
    this.resumingId.set(row.id);
    this.api.resumeRefund(row.id).subscribe({
      next: (result) => {
        this.resumingId.set(null);
        this.toast.success(
          `Refund of ${formatMoney(result.refund.amount, result.refund.currency)} recovered and processed for ${result.refund.bookingReference}.`,
        );
        this.refreshAll();
      },
      error: (err: unknown) => {
        this.resumingId.set(null);
        const status = (err as { status?: number } | null)?.status;
        if (status === 502) {
          this.toast.warning(
            'The refund outcome at the provider is still uncertain — it remains pending and can be recovered again safely.',
          );
        } else if (status === 409) {
          this.toast.error(
            serverMessage(err) ?? 'The refund was definitively rejected by the payment provider.',
          );
        } else {
          this.toast.error(toErrorMessage(err, 'Could not recover the refund. Please try again.'));
        }
        this.refreshAll();
      },
    });
  }

  setOrphanNote(id: string, note: string): void {
    this.orphanNotes.update((notes) => ({ ...notes, [id]: note }));
  }

  /** Marks an investigated orphan resolved (audited server-side). */
  resolveOrphan(orphan: OrphanProviderRefund): void {
    if (this.resolvingId() !== null) return;
    this.resolvingId.set(orphan.id);
    const note = (this.orphanNotes()[orphan.id] ?? '').trim() || undefined;
    this.api.resolveOrphanRefund(orphan.id, note).subscribe({
      next: () => {
        this.resolvingId.set(null);
        this.toast.success(`Orphan refund ${orphan.providerRefundReference} marked resolved.`);
        this.loadOrphans();
        this.loadOperations();
      },
      error: (err: unknown) => {
        this.resolvingId.set(null);
        this.toast.error(toErrorMessage(err, 'Could not resolve the orphan refund. Please try again.'));
      },
    });
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
        this.refreshAll();
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

  private refreshAll(): void {
    this.load();
    this.loadOperations();
    this.loadOrphans();
  }
}
