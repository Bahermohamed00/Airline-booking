import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AdminPaymentsService } from '../payments/admin-payments.service';
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
import { NaDialog } from '../../../shared/ui/dialog.component';
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
    HasPermissionDirective,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaTabs,
    NaDataTable,
    NaEmptyState,
    NaSkeleton,
  ],
  templateUrl: './admin-bookings.component.html',
  styleUrl: './admin-bookings.component.css',
})
export class AdminBookingsPage {
  private readonly bookingsService = inject(CustomerBookingService);
  private readonly auditService = inject(AuditService);
  private readonly auth = inject(AuthService);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly SEAT_HOLD_STATUS_MAP = SEAT_HOLD_STATUS_MAP;
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

  constructor() {
    this.load({});
  }

  load(query: AdminBookingQuery): void {
    this.activeQuery.set(query);
    this.loading.set(true);
    this.loadError.set(null);
    this.bookingsService.listAdmin(query).subscribe({
      next: (list) => {
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
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
    this.loadDetail(id);
  }

  closeDrawer(): void {
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
    this.resetAudit();
  }

  retryDetail(): void {
    const id = this.selectedId();
    if (id) this.loadDetail(id);
  }

  onTabChange(tab: string): void {
    this.activeTab.set(tab);
    if (tab === 'audit') {
      const id = this.selectedId();
      if (id && this.auth.hasPermission('audit:read')) this.loadAudit(id);
    }
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
