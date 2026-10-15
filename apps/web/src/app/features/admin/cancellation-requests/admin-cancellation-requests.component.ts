import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import {
  CancellationRequestsService,
  type AdminCancellationRequest,
} from '../../../core/services/cancellation-requests.service';
import type { CancellationRequestStatus } from '../../../core/models/customer-booking.model';
import { formatMoney } from '../../../core/services/pricing.service';
import { REFUND_STATUS_MAP, statusLabel, type StatusTone } from '../../../core/status-maps';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaDialog } from '../../../shared/ui/dialog.component';

const STATUS_TONE: Record<CancellationRequestStatus, StatusTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};
const STATUSES: CancellationRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

@Component({
  selector: 'na-admin-cancellation-requests',
  imports: [
    ReactiveFormsModule,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaSkeleton,
    NaEmptyState,
    NaDialog,
  ],
  templateUrl: './admin-cancellation-requests.component.html',
  styleUrl: './admin-cancellation-requests.component.css',
})
export class AdminCancellationRequestsPage {
  private readonly auth = inject(AuthService);
  private readonly requestsService = inject(CancellationRequestsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly crumbs = [
    { label: 'Admin', path: '/admin/dashboard' },
    { label: 'Cancellation requests', path: '/admin/cancellation-requests' },
  ];
  protected readonly statuses = STATUSES;

  protected readonly canManage = computed(() => this.auth.hasPermission('bookings:manage'));
  protected readonly requests = signal<AdminCancellationRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** Pending is the operational default — the review queue. */
  protected readonly filter = signal<CancellationRequestStatus | ''>('PENDING');
  protected readonly approving = signal<AdminCancellationRequest | null>(null);
  protected readonly rejecting = signal<AdminCancellationRequest | null>(null);
  protected readonly saving = signal(false);

  protected readonly rejectForm = this.fb.nonNullable.group({
    rejectionReason: ['', Validators.maxLength(500)],
  });

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  constructor() {
    if (this.canManage()) {
      this.load();
    } else {
      this.loading.set(false);
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.requestsService.list(this.filter() || undefined).subscribe({
      next: (requests) => {
        this.requests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load cancellation requests. Please try again.');
      },
    });
  }

  protected setFilter(value: string): void {
    this.filter.set(value as CancellationRequestStatus | '');
    this.load();
  }

  protected toneOf(status: CancellationRequestStatus): StatusTone {
    return STATUS_TONE[status];
  }

  protected refundLabel(status: string): string {
    return statusLabel(REFUND_STATUS_MAP, status).label;
  }

  protected refundTone(status: string): StatusTone {
    return statusLabel(REFUND_STATUS_MAP, status).tone;
  }

  /**
   * A REJECTED refund on an APPROVED request means the money movement failed —
   * the admin may approve again to retry the refund.
   */
  protected refundRetryable(r: AdminCancellationRequest): boolean {
    return r.status === 'APPROVED' && r.refund?.status === 'REJECTED';
  }

  protected money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  protected fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }

  protected askApprove(r: AdminCancellationRequest): void {
    this.approving.set(r);
  }

  protected confirmApprove(): void {
    const r = this.approving();
    if (!r || this.saving()) return;
    this.saving.set(true);
    this.requestsService.approve(r.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.approving.set(null);
        this.toast.success(
          r.policy
            ? `Cancellation approved — refund of ${this.money(r.policy.refundableAmount, r.policy.currency)} initiated.`
            : 'Cancellation approved.',
        );
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.approving.set(null);
        this.onReviewError(err, 'approve');
      },
    });
  }

  protected askReject(r: AdminCancellationRequest): void {
    this.rejectForm.reset({ rejectionReason: '' });
    this.rejecting.set(r);
  }

  protected confirmReject(): void {
    const r = this.rejecting();
    if (!r || this.saving() || this.rejectForm.invalid) return;
    this.saving.set(true);
    const reason = this.rejectForm.getRawValue().rejectionReason.trim();
    this.requestsService.reject(r.id, reason === '' ? undefined : reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.rejecting.set(null);
        this.toast.success('Cancellation request rejected.');
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.rejecting.set(null);
        this.onReviewError(err, 'reject');
      },
    });
  }

  /** 409 = another staff member already reviewed it — refresh to the truth. */
  private onReviewError(err: unknown, action: 'approve' | 'reject'): void {
    const status = (err as { status?: number } | null)?.status;
    if (status === 409) {
      this.toast.error('This request was already reviewed. The list has been refreshed.');
      this.load();
      return;
    }
    this.toast.error(`Could not ${action} the request. Please try again.`);
  }
}
