import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AdminPaymentsService } from '../../../core/services/admin-payments.service';
import { AuditService, type AuditLogItem } from '../../../core/services/audit.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
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
import { NaRefundDialog, type RefundRequest } from './refund-dialog.component';

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
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Bookings</h1>
        <p class="page__sub">
          Search bookings by reference, contact email or status and review their details.
        </p>
      </header>

      <form class="filters na-card" (submit)="applyFilters($event)">
        <div class="na-field filters__reference">
          <label class="na-label" for="booking-reference">Reference</label>
          <input
            id="booking-reference"
            class="na-input"
            type="search"
            name="reference"
            placeholder="e.g. NVABC1"
            [ngModel]="referenceInput()"
            (ngModelChange)="referenceInput.set($event)"
          />
        </div>
        <div class="na-field filters__email">
          <label class="na-label" for="booking-email">Contact email</label>
          <input
            id="booking-email"
            class="na-input"
            type="search"
            name="email"
            placeholder="customer@example.com"
            [ngModel]="emailInput()"
            (ngModelChange)="emailInput.set($event)"
          />
        </div>
        <div class="na-field filters__status">
          <label class="na-label" for="booking-status">Status</label>
          <select
            id="booking-status"
            class="na-select"
            name="status"
            [ngModel]="statusInput()"
            (ngModelChange)="onStatusChange($event)"
          >
            <option value="ALL">All statuses</option>
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
        <div class="filters__actions">
          <na-button variant="primary" type="submit">Search</na-button>
          <na-button variant="secondary" (clicked)="clearFilters()">Clear</na-button>
        </div>
      </form>

      @if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="reload()">Retry</na-button>
        </div>
      } @else {
        <na-data-table
          [columns]="columns"
          [rows]="tableRows()"
          [loading]="loading()"
          emptyTitle="No bookings found"
          emptyMessage="Try a different reference, email or status filter."
          (rowClick)="openBooking($event.id)"
        />
      }

      @if (selectedId()) {
        <div class="backdrop" (click)="closeDrawer()" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'Booking ' + (selectedSummary()?.bookingReference ?? 'details')"
          tabindex="-1"
          (keydown.escape)="closeDrawer()"
        >
          <header class="drawer__head">
            @if (selectedSummary(); as summary) {
              <div>
                <h2 class="drawer__title">
                  <span class="na-text-mono">{{ summary.bookingReference }}</span>
                  <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, summary.status).tone">
                    {{ statusLabel(BOOKING_STATUS_MAP, summary.status).label }}
                  </na-badge>
                </h2>
                <p class="na-text-muted na-text-small">
                  Booked {{ fmt(summary.bookedAt) }} · {{ summary.contactEmail }}
                </p>
              </div>
            }
            <button
              type="button"
              class="drawer__close"
              aria-label="Close booking details"
              (click)="closeDrawer()"
            >
              ×
            </button>
          </header>

          <na-tabs
            [tabs]="tabs"
            [active]="activeTab()"
            ariaLabel="Booking detail sections"
            (tabChange)="onTabChange($event)"
          />

          <div class="drawer__body">
            @if (detailLoading()) {
              <na-skeleton [rows]="[1, 2, 3, 4]" height="1.2rem" />
            } @else if (detailError()) {
              <div class="list-error" role="alert">
                <p>{{ detailError() }}</p>
                <na-button variant="secondary" size="sm" (clicked)="retryDetail()">Retry</na-button>
              </div>
            } @else if (detail(); as booking) {
              @switch (activeTab()) {
                @case ('itinerary') {
                  <h3 class="drawer__section">Booking</h3>
                  <dl class="facts">
                    <div>
                      <dt>Reference</dt>
                      <dd class="na-text-mono">{{ booking.bookingReference }}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, booking.status).tone">
                          {{ statusLabel(BOOKING_STATUS_MAP, booking.status).label }}
                        </na-badge>
                      </dd>
                    </div>
                    <div>
                      <dt>Booked</dt>
                      <dd>{{ fmt(booking.bookedAt) }}</dd>
                    </div>
                    <div>
                      <dt>Cabin</dt>
                      <dd>{{ cabin(booking.cabinClass) }}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{{ money(booking.totalAmount, booking.currency) }}</dd>
                    </div>
                    <div>
                      <dt>Per passenger</dt>
                      <dd>
                        {{
                          booking.perPassengerTotal !== null
                            ? money(booking.perPassengerTotal, booking.currency)
                            : '—'
                        }}
                      </dd>
                    </div>
                  </dl>

                  <h3 class="drawer__section">Contact</h3>
                  <dl class="facts">
                    <div>
                      <dt>Email</dt>
                      <dd>{{ booking.contactEmail }}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{{ booking.contactPhone ?? '—' }}</dd>
                    </div>
                  </dl>

                  @if (booking.flight; as flight) {
                    <h3 class="drawer__section">Flight</h3>
                    <dl class="facts">
                      <div>
                        <dt>Flight</dt>
                        <dd>
                          <span class="na-text-mono">{{ flight.flightNumber }}</span>
                          <na-badge [tone]="statusLabel(FLIGHT_STATUS_MAP, flight.status).tone">
                            {{ statusLabel(FLIGHT_STATUS_MAP, flight.status).label }}
                          </na-badge>
                        </dd>
                      </div>
                      <div>
                        <dt>Route</dt>
                        <dd>{{ flight.origin }} → {{ flight.destination }}</dd>
                      </div>
                      <div>
                        <dt>Departure</dt>
                        <dd>{{ fmt(flight.departureTime) }}</dd>
                      </div>
                      <div>
                        <dt>Arrival</dt>
                        <dd>{{ fmt(flight.arrivalTime) }}</dd>
                      </div>
                    </dl>
                  }
                }
                @case ('passengers') {
                  <h3 class="drawer__section">Passengers</h3>
                  <ul class="plain-list">
                    @for (p of booking.passengers; track p.id) {
                      <li>
                        <strong>{{ p.firstName }} {{ p.lastName }}</strong>
                        <na-badge tone="neutral">{{ p.passengerType }}</na-badge>
                        <p class="na-text-small na-text-muted">
                          Born {{ fmtDay(p.dateOfBirth) }} · Nationality
                          {{ p.nationality ?? '—' }} · Passport
                          <span class="na-text-mono">{{ p.passportNumber ?? '—' }}</span>
                        </p>
                      </li>
                    }
                  </ul>

                  <h3 class="drawer__section">Seats</h3>
                  <p class="na-text-muted na-text-small">
                    Seats are listed per booking — the API does not link seats to individual
                    passengers.
                  </p>
                  @if (booking.seats.length) {
                    <ul class="plain-list">
                      @for (s of booking.seats; track s.seatId) {
                        <li>
                          Seat <span class="na-text-mono">{{ s.seatNumber }}</span>
                          <na-badge [tone]="statusLabel(SEAT_HOLD_STATUS_MAP, s.holdStatus).tone">
                            {{ statusLabel(SEAT_HOLD_STATUS_MAP, s.holdStatus).label }}
                          </na-badge>
                          @if (s.holdStatus === 'ACTIVE') {
                            <span class="na-text-muted na-text-small">
                              · held until {{ fmt(s.holdExpiresAt) }}</span
                            >
                          }
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="na-text-muted">No seats on this booking.</p>
                  }
                }
                @case ('payments') {
                  <na-empty-state
                    icon="◈"
                    title="Payments & refunds are not available yet"
                    message="Payments and refunds will be available in a future phase. No payment data exists for bookings yet — bookings remain pending until payments are implemented."
                  />
                }
                @case ('notifications') {
                  <na-empty-state
                    icon="✉"
                    title="Notifications are not available yet"
                    message="Notifications will be available in a future phase."
                  />
                }
                @case ('audit') {
                  <span *naHasPermission="'audit:read'">
                    @if (auditLoading()) {
                      <na-skeleton [rows]="[1, 2, 3]" height="1.2rem" />
                    } @else if (auditForbidden()) {
                      <na-empty-state
                        icon="🔒"
                        title="No audit access"
                        message="You don't have permission to view the audit trail."
                      />
                    } @else if (auditError()) {
                      <div class="list-error" role="alert">
                        <p>{{ auditError() }}</p>
                        <na-button variant="secondary" size="sm" (clicked)="retryAudit()"
                          >Retry</na-button
                        >
                      </div>
                    } @else if (auditLogs().length) {
                      <ul class="plain-list">
                        @for (log of auditLogs(); track log.id) {
                          <li>
                            <span class="na-text-mono">{{ log.event }}</span>
                            <span class="na-text-muted">
                              · {{ log.actorType }} · {{ fmt(log.createdAt) }}</span
                            >
                          </li>
                        }
                      </ul>
                    } @else {
                      <na-empty-state
                        icon="≡"
                        title="No audit records"
                        message="No staff actions have been logged against this booking."
                      />
                    }
                  </span>
                }
              }
            }
          </div>

          <footer class="drawer__actions">
            <span class="future-hint" *naHasPermission="'bookings:manage'">
              <na-badge tone="info">Future phase</na-badge>
              Admin cancellation and payment exception workflows arrive in a future backend phase.
            </span>
          </footer>
        </aside>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .page {
      max-width: var(--na-admin-max);
    }
    .page__head {
      margin-bottom: var(--na-space-6);
    }
    .page__sub {
      color: var(--na-ink-500);
      margin-top: var(--na-space-1);
    }
    .filters {
      display: flex;
      gap: var(--na-space-4);
      padding: var(--na-space-4);
      margin-bottom: var(--na-space-5);
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .filters .na-field {
      margin-bottom: 0;
    }
    .filters__reference {
      flex: 1 1 200px;
    }
    .filters__email {
      flex: 1 1 240px;
    }
    .filters__status {
      flex: 0 0 220px;
    }
    .filters__actions {
      display: flex;
      gap: var(--na-space-3);
    }
    .list-error {
      display: flex;
      align-items: center;
      gap: var(--na-space-4);
      padding: var(--na-space-4);
      border: 1px solid var(--na-border);
      border-radius: var(--na-radius-lg);
      background: var(--na-surface-raised);
    }
    .list-error p {
      margin: 0;
      color: var(--na-ink-500);
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--na-overlay);
      z-index: 99;
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      width: min(480px, 100vw);
      background: var(--na-surface-raised);
      border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg);
      display: flex;
      flex-direction: column;
      padding: var(--na-space-6);
      overflow-y: auto;
    }
    .drawer__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--na-space-3);
      margin-bottom: var(--na-space-4);
    }
    .drawer__title {
      display: flex;
      align-items: center;
      gap: var(--na-space-3);
      font-size: var(--na-text-xl);
    }
    .drawer__close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--na-ink-500);
      min-width: 44px;
      min-height: 44px;
      border-radius: var(--na-radius-md);
    }
    .drawer__close:hover {
      background: var(--na-surface-sunken);
      color: var(--na-ink-900);
    }
    .drawer__body {
      padding: var(--na-space-4) 0;
      flex: 1;
    }
    .drawer__section {
      font-size: var(--na-text-base);
      margin: var(--na-space-4) 0 var(--na-space-2);
    }
    .drawer__section:first-child {
      margin-top: 0;
    }
    .drawer__actions {
      display: flex;
      gap: var(--na-space-3);
      flex-wrap: wrap;
      border-top: 1px solid var(--na-border);
      padding-top: var(--na-space-4);
    }
    .future-hint {
      display: inline-flex;
      align-items: center;
      gap: var(--na-space-2);
      color: var(--na-ink-500);
      font-size: var(--na-text-sm);
    }
    .facts {
      margin: 0;
      display: grid;
      gap: var(--na-space-3);
    }
    .facts div {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: var(--na-space-3);
    }
    .facts dt {
      color: var(--na-ink-500);
      font-size: var(--na-text-sm);
    }
    .facts dd {
      margin: 0;
    }
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--na-space-3);
    }
    .plain-list li {
      padding: var(--na-space-3);
      border: 1px solid var(--na-border);
      border-radius: var(--na-radius-md);
    }
    @media (max-width: 639px) {
      .drawer {
        width: 100vw;
        padding: var(--na-space-4);
      }
      .filters__status {
        flex: 1 1 100%;
      }
    }
  `,
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
