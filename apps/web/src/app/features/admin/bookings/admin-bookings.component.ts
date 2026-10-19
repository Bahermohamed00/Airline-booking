import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AdminPaymentsService } from '../payments/admin-payments.service';
import { AdminNotificationsService, type AdminNotificationItem } from '../notifications/admin-notifications.service';
import { AuditService, type AuditLogItem } from '../audit/audit.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  BOOKING_STATUS_MAP,
  FLIGHT_STATUS_MAP,
  PAYMENT_STATUS_MAP,
  REFUND_STATUS_MAP,
  SEAT_HOLD_STATUS_MAP,
  statusLabel,
} from '../../../core/status-maps';
import type { BookingStatus, CabinClass } from '../../../core/models/domain.model';
import type {
  AdminBookingQuery,
  CustomerBooking,
} from '../../../core/models/customer-booking.model';
import type { AdminPayment, RefundPaymentPayload } from '../../../core/models/payment.model';
import { toErrorMessage, serverMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaTabs, type TabItem } from '../../../shared/ui/tabs.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaRefundDialog, type RefundRequest } from '../payments/refund-dialog.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function fmtDateTime(iso: string | null | undefined): string {
  return iso ? DATE_TIME.format(new Date(iso)) : '—';
}

function fmtDate(iso: string | null | undefined): string {
  return iso ? DATE_ONLY.format(new Date(iso)) : '—';
}

const CABIN_LABELS: Record<CabinClass, string> = {
  FIRST: 'First',
  BUSINESS: 'Business',
  PREMIUM_ECONOMY: 'Premium economy',
  ECONOMY: 'Economy',
};

function cabinLabel(cabin: CabinClass | null): string {
  return cabin ? CABIN_LABELS[cabin] : '—';
}

interface BookingRow {
  id: string;
  reference: string;
  contact: string;
  flight: string;
  cabin: string;
  total: string;
  bookedAt: string;
  status: string;
  statusKey: BookingStatus;
}

@Component({
  selector: 'na-admin-bookings',
  imports: [
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaTabs,
    NaDataTable,
    NaEmptyState,
    NaSkeleton,
    NaRefundDialog,
  ],
  templateUrl: './admin-bookings.component.html',
  styleUrl: './admin-bookings.component.css',
})
export class AdminBookingsPage {
  private readonly bookingsService = inject(CustomerBookingService);
  private readonly paymentsService = inject(AdminPaymentsService);
  private readonly notificationsService = inject(AdminNotificationsService);
  private readonly auditService = inject(AuditService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly SEAT_HOLD_STATUS_MAP = SEAT_HOLD_STATUS_MAP;
  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly fmt = fmtDateTime;
  readonly fmtDay = fmtDate;
  readonly money = formatMoney;
  readonly cabin = cabinLabel;

  readonly crumbs = [{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Bookings' }];

  readonly columns: TableColumn<BookingRow>[] = [
    { key: 'reference', label: 'Reference' },
    { key: 'contact', label: 'Contact', priority: 'low' },
    { key: 'flight', label: 'Flight' },
    { key: 'cabin', label: 'Cabin', priority: 'low' },
    { key: 'total', label: 'Total' },
    { key: 'bookedAt', label: 'Booked', priority: 'low' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({
        text: r.status,
        tone: statusLabel(BOOKING_STATUS_MAP, r.statusKey).tone,
      }),
    },
  ];

  readonly tabs: TabItem[] = [
    { id: 'itinerary', label: 'Itinerary' },
    { id: 'passengers', label: 'Passengers & Seats' },
    { id: 'payments', label: 'Payments & Refunds' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'audit', label: 'Audit' },
  ];

  readonly statusOptions = (Object.keys(BOOKING_STATUS_MAP) as BookingStatus[]).map((value) => ({
    value,
    label: BOOKING_STATUS_MAP[value].label,
  }));

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly bookings = signal<CustomerBooking[]>([]);
  readonly activeQuery = signal<AdminBookingQuery>({});

  readonly referenceInput = signal('');
  readonly emailInput = signal('');
  readonly statusInput = signal<'ALL' | BookingStatus>('ALL');

  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<CustomerBooking | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  private readonly detailCache = new Map<string, CustomerBooking>();

  readonly activeTab = signal('itinerary');
  readonly auditLogs = signal<AuditLogItem[]>([]);
  readonly auditLoading = signal(false);
  readonly auditError = signal<string | null>(null);
  readonly auditForbidden = signal(false);
  private readonly auditLoadedFor = signal<string | null>(null);

  // Payments tab state (per selected booking).
  readonly payments = signal<AdminPayment[]>([]);
  readonly paymentsLoading = signal(false);
  readonly paymentsError = signal<string | null>(null);
  readonly paymentsForbidden = signal(false);
  private readonly paymentsLoadedFor = signal<string | null>(null);

  // Refund dialog state (direct mode — the payment is chosen in the list).
  readonly refundOpen = signal(false);
  readonly refunding = signal(false);
  readonly refundTarget = signal<AdminPayment | null>(null);

  // Notifications tab state (per selected booking).
  readonly bookingNotifications = signal<AdminNotificationItem[]>([]);
  readonly notificationsLoading = signal(false);
  readonly notificationsError = signal<string | null>(null);
  readonly notificationsForbidden = signal(false);
  private readonly notificationsLoadedFor = signal<string | null>(null);

  /** Existing permissions; the backend remains the enforcement authority. */
  readonly canReadPayments = computed(() => this.auth.hasPermission('payments:read'));
  readonly canRefund = computed(() => this.auth.hasPermission('payments:refund'));
  readonly canReadNotifications = computed(() => this.auth.hasPermission('notifications:read'));

  readonly selectedSummary = computed(
    () => this.bookings().find((b) => b.id === this.selectedId()) ?? null,
  );

  readonly tableRows = computed<BookingRow[]>(() =>
    this.bookings().map((b) => ({
      id: b.id,
      reference: b.bookingReference,
      contact: b.contactEmail,
      flight: b.flight
        ? `${b.flight.flightNumber} ${b.flight.origin}→${b.flight.destination}`
        : '—',
      cabin: cabinLabel(b.cabinClass),
      total: formatMoney(b.totalAmount, b.currency),
      bookedAt: fmtDateTime(b.bookedAt),
      status: statusLabel(BOOKING_STATUS_MAP, b.status).label,
      statusKey: b.status,
    })),
  );

  private readonly route = inject(ActivatedRoute);

  constructor() {
    // Deep link from Users & Passengers: /admin/bookings?email=<customer email>
    // opens the list already filtered to that customer. A subscription (not a
    // snapshot) re-fires when the param changes while already on the page, so
    // picking a different customer always reloads — stale rows from a previous
    // customer are never shown for a new selection.
    let first = true;
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const email = params.get('email')?.trim() ?? '';
      const changed = email !== this.emailInput().trim();
      if (!first && !changed) return;
      first = false;
      if (changed) this.emailInput.set(email);
      this.load(this.currentQuery());
    });
  }

  private loadEpoch = 0;

  load(query: AdminBookingQuery): void {
    // Latest-request-wins: a slower response for a previous filter (e.g. an
    // earlier customer deep link) must never overwrite newer results.
    const epoch = ++this.loadEpoch;
    this.activeQuery.set(query);
    this.loading.set(true);
    this.loadError.set(null);
    this.bookingsService.listAdmin(query).subscribe({
      next: (list) => {
        if (epoch !== this.loadEpoch) return;
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        if (epoch !== this.loadEpoch) return;
        this.loadError.set(toErrorMessage(err, 'Could not load bookings. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  reload(): void {
    this.load(this.activeQuery());
  }

  applyFilters(event: Event): void {
    event.preventDefault();
    this.load(this.currentQuery());
  }

  onStatusChange(value: string): void {
    this.statusInput.set(value as 'ALL' | BookingStatus);
    this.load(this.currentQuery());
  }

  clearFilters(): void {
    this.referenceInput.set('');
    this.emailInput.set('');
    this.statusInput.set('ALL');
    this.load({});
  }

  openBooking(id: string): void {
    this.selectedId.set(id);
    this.activeTab.set('itinerary');
    this.resetAudit();
    this.resetPayments();
    this.resetNotifications();
    this.loadDetail(id);
  }

  closeDrawer(): void {
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
    this.resetAudit();
    this.resetPayments();
    this.resetNotifications();
  }

  retryDetail(): void {
    const id = this.selectedId();
    if (id) this.loadDetail(id);
  }

  onTabChange(tab: string): void {
    this.activeTab.set(tab);
    const id = this.selectedId();
    if (!id) return;
    if (tab === 'audit' && this.auth.hasPermission('audit:read')) this.loadAudit(id);
    if (tab === 'payments') this.loadPayments(id);
    if (tab === 'notifications') this.loadNotifications(id);
  }

  retryNotifications(): void {
    const id = this.selectedId();
    if (id) this.loadNotifications(id, true);
  }

  retryPayments(): void {
    const id = this.selectedId();
    if (id) this.loadPayments(id, true);
  }

  /** Only a successful (or partially refunded) payment can be refunded further
   *  — same rule as the payments page; the backend enforces it authoritatively. */
  refundable(payment: AdminPayment): boolean {
    return payment.status === 'SUCCESS' || payment.status === 'PARTIALLY_REFUNDED';
  }

  openRefund(payment: AdminPayment): void {
    if (!this.canRefund() || !this.refundable(payment)) return;
    this.refundTarget.set(payment);
    this.refundOpen.set(true);
  }

  onRefundCancelled(): void {
    this.refundOpen.set(false);
    this.refundTarget.set(null);
  }

  onRefund(request: RefundRequest): void {
    if (this.refunding()) return;
    this.refunding.set(true);
    const payload: RefundPaymentPayload = {};
    if (request.amount !== undefined) payload.amount = request.amount;
    if (request.reason !== undefined) payload.reason = request.reason;
    this.paymentsService.refund(request.paymentId, payload).subscribe({
      next: (result) => {
        this.refunding.set(false);
        this.onRefundCancelled();
        this.toast.success(
          `Refund of ${formatMoney(result.refund.amount, result.refund.currency)} issued for ${result.refund.bookingReference}.`,
        );
        // Refresh the booking's payments so the new refund row appears.
        const id = this.selectedId();
        if (id) this.loadPayments(id, true);
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

  private resetNotifications(): void {
    this.bookingNotifications.set([]);
    this.notificationsLoading.set(false);
    this.notificationsError.set(null);
    this.notificationsForbidden.set(false);
    this.notificationsLoadedFor.set(null);
  }

  /** Booking-scoped notification rows — server-filtered by the bookingId FK. */
  private loadNotifications(bookingId: string, force = false): void {
    if (!force && this.notificationsLoadedFor() === bookingId) return;
    if (!this.canReadNotifications()) {
      this.notificationsForbidden.set(true);
      return;
    }
    this.notificationsLoadedFor.set(bookingId);
    this.notificationsLoading.set(true);
    this.notificationsError.set(null);
    this.notificationsForbidden.set(false);
    this.notificationsService.list({ bookingId, limit: 20 }).subscribe({
      next: (page) => {
        // A response for a previously selected booking must never surface.
        if (this.selectedId() !== bookingId) return;
        this.bookingNotifications.set(page.data);
        this.notificationsLoading.set(false);
      },
      error: (err: unknown) => {
        if (this.selectedId() !== bookingId) return;
        if ((err as { status?: number } | null)?.status === 403) {
          this.notificationsForbidden.set(true);
        } else {
          this.notificationsError.set(toErrorMessage(err, 'Could not load notifications for this booking.'));
        }
        this.notificationsLoading.set(false);
      },
    });
  }

  private resetPayments(): void {
    this.payments.set([]);
    this.paymentsLoading.set(false);
    this.paymentsError.set(null);
    this.paymentsForbidden.set(false);
    this.paymentsLoadedFor.set(null);
    this.onRefundCancelled();
  }

  /** Payments of the selected booking only — server-filtered by bookingId. */
  private loadPayments(bookingId: string, force = false): void {
    if (!force && this.paymentsLoadedFor() === bookingId) return;
    if (!this.canReadPayments()) {
      this.paymentsForbidden.set(true);
      return;
    }
    this.paymentsLoadedFor.set(bookingId);
    this.paymentsLoading.set(true);
    this.paymentsError.set(null);
    this.paymentsForbidden.set(false);
    this.paymentsService.listPayments({ bookingId }).subscribe({
      next: (list) => {
        // A response for a previously selected booking must never surface.
        if (this.selectedId() !== bookingId) return;
        this.payments.set(list);
        this.paymentsLoading.set(false);
      },
      error: (err: unknown) => {
        if (this.selectedId() !== bookingId) return;
        if ((err as { status?: number } | null)?.status === 403) {
          this.paymentsForbidden.set(true);
        } else {
          this.paymentsError.set(toErrorMessage(err, 'Could not load payments for this booking.'));
        }
        this.paymentsLoading.set(false);
      },
    });
  }

  retryAudit(): void {
    const id = this.selectedId();
    if (id) this.loadAudit(id, true);
  }

  private currentQuery(): AdminBookingQuery {
    const query: AdminBookingQuery = {};
    const reference = this.referenceInput().trim();
    const email = this.emailInput().trim();
    const status = this.statusInput();
    if (reference) query.reference = reference;
    if (email) query.email = email;
    if (status !== 'ALL') query.status = status;
    return query;
  }

  private loadDetail(id: string): void {
    const cached = this.detailCache.get(id);
    if (cached) {
      this.detail.set(cached);
      this.detailLoading.set(false);
      this.detailError.set(null);
      return;
    }
    this.detail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.bookingsService.getAdmin(id).subscribe({
      next: (booking) => {
        this.detailCache.set(id, booking);
        if (this.selectedId() !== id) return;
        this.detail.set(booking);
        this.detailLoading.set(false);
      },
      error: (err: unknown) => {
        if (this.selectedId() !== id) return;
        this.detailError.set(toErrorMessage(err, 'Could not load the booking details.'));
        this.detailLoading.set(false);
      },
    });
  }

  private resetAudit(): void {
    this.auditLogs.set([]);
    this.auditLoading.set(false);
    this.auditError.set(null);
    this.auditForbidden.set(false);
    this.auditLoadedFor.set(null);
  }

  private loadAudit(bookingId: string, force = false): void {
    if (!force && this.auditLoadedFor() === bookingId) return;
    this.auditLoadedFor.set(bookingId);
    this.auditLoading.set(true);
    this.auditError.set(null);
    this.auditForbidden.set(false);
    this.auditService
      .listLogs({ targetType: 'Booking', targetId: bookingId, limit: 20 })
      .subscribe({
        next: (page) => {
          if (this.selectedId() !== bookingId) return;
          this.auditLogs.set(page.items);
          this.auditLoading.set(false);
        },
        error: (err: unknown) => {
          if (this.selectedId() !== bookingId) return;
          if ((err as { status?: number } | null)?.status === 403) {
            this.auditForbidden.set(true);
          } else {
            this.auditError.set(toErrorMessage(err, 'Could not load the audit trail.'));
          }
          this.auditLoading.set(false);
        },
      });
  }
}
