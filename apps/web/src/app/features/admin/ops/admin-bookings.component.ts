import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../../core/services/booking.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import {
  BOOKING_STATUS_MAP, PAYMENT_STATUS_MAP, REFUND_STATUS_MAP, statusLabel,
} from '../../../core/status-maps';
import { AUDIT_LOGS, NOTIFICATIONS } from '../../../core/mock/mock-data';
import type { Booking, BookingStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaTabs, TabItem } from '../../../shared/ui/tabs.component';
import { NaDataTable, TableColumn } from '../../../shared/ui/data-table.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function fmtDateTime(iso: string | null | undefined): string {
  return iso ? DATE_TIME.format(new Date(iso)) : '—';
}

interface BookingRow {
  id: string;
  reference: string;
  contact: string;
  flight: string;
  amount: string;
  bookedAt: string;
  status: string;
}

@Component({
  selector: 'na-admin-bookings',
  standalone: true,
  imports: [
    FormsModule, HasPermissionDirective,
    NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaDialog, NaTabs, NaDataTable, NaEmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Bookings</h1>
        <p class="page__sub">Search bookings by reference, email, flight or passenger and manage their lifecycle.</p>
      </header>

      <div class="filters na-card">
        <div class="na-field filters__search">
          <label class="na-label" for="booking-query">Search</label>
          <input
            id="booking-query"
            class="na-input"
            type="search"
            placeholder="Reference, email, flight number or passenger name"
            [ngModel]="query()"
            (ngModelChange)="onQuery($event)"
          />
        </div>
        <div class="na-field filters__status">
          <label class="na-label" for="booking-status">Status</label>
          <select id="booking-status" class="na-select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="ALL">All statuses</option>
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
      </div>

      <na-data-table
        [columns]="columns"
        [rows]="tableRows()"
        [loading]="loading()"
        emptyTitle="No bookings found"
        emptyMessage="Try a different reference, email, flight number or passenger name."
        (rowClick)="openBooking($event.id)"
      />

      @if (selected(); as booking) {
        <div class="backdrop" (click)="closeDrawer()" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'Booking ' + booking.bookingReference"
          tabindex="-1"
          (keydown.escape)="closeDrawer()"
        >
          <header class="drawer__head">
            <div>
              <h2 class="drawer__title">
                <span class="na-text-mono">{{ booking.bookingReference }}</span>
                <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, booking.status).tone">
                  {{ statusLabel(BOOKING_STATUS_MAP, booking.status).label }}
                </na-badge>
              </h2>
              <p class="na-text-muted na-text-small">Booked {{ fmt(booking.bookedAt) }} · {{ booking.contactEmail }}</p>
            </div>
            <button type="button" class="drawer__close" aria-label="Close booking details" (click)="closeDrawer()">×</button>
          </header>

          <na-tabs [tabs]="tabs" [active]="activeTab()" ariaLabel="Booking detail sections" (tabChange)="activeTab.set($event)" />

          <div class="drawer__body">
            @switch (activeTab()) {
              @case ('itinerary') {
                <dl class="facts">
                  <div><dt>Flight</dt><dd>{{ booking.flight.flightNumber }} · {{ booking.flight.aircraft.model }}</dd></div>
                  <div><dt>Route</dt><dd>{{ booking.flight.route.origin.iataCode }} ({{ booking.flight.route.origin.city }}) → {{ booking.flight.route.destination.iataCode }} ({{ booking.flight.route.destination.city }})</dd></div>
                  <div><dt>Departure</dt><dd>{{ fmt(booking.flight.departureTime) }}</dd></div>
                  <div><dt>Arrival</dt><dd>{{ fmt(booking.flight.arrivalTime) }}</dd></div>
                  <div><dt>Total</dt><dd>{{ money(booking.totalAmount, booking.currency) }}</dd></div>
                  <div><dt>Contact</dt><dd>{{ booking.contactEmail }}@if (booking.contactPhone) { · {{ booking.contactPhone }} }</dd></div>
                </dl>
                @if (booking.extras.length) {
                  <h3 class="drawer__section">Extras</h3>
                  <ul class="plain-list">
                    @for (extra of booking.extras; track extra.id) {
                      <li>{{ extra.quantity }}× {{ extra.extraService.name }} — {{ money(extra.price, booking.currency) }}</li>
                    }
                  </ul>
                }
              }
              @case ('passengers') {
                <ul class="plain-list">
                  @for (p of booking.passengers; track p.id) {
                    <li>
                      <strong>{{ p.passenger.firstName }} {{ p.passenger.lastName }}</strong>
                      <na-badge tone="neutral">{{ p.passengerType }}</na-badge>
                      @if (seatOf(booking, p.id); as seat) {
                        <span class="na-text-muted"> · Seat <span class="na-text-mono">{{ seat }}</span></span>
                      }
                    </li>
                  }
                </ul>
              }
              @case ('payments') {
                <h3 class="drawer__section">Payments</h3>
                @if (booking.payments.length) {
                  <ul class="plain-list">
                    @for (pay of booking.payments; track pay.id) {
                      <li>
                        {{ money(pay.amount, pay.currency) }}
                        <na-badge [tone]="statusLabel(PAYMENT_STATUS_MAP, pay.status).tone">{{ statusLabel(PAYMENT_STATUS_MAP, pay.status).label }}</na-badge>
                        <span class="na-text-muted"> · {{ pay.provider }} <span class="na-text-mono">{{ pay.providerReference ?? '—' }}</span> · {{ fmt(pay.paidAt ?? pay.createdAt) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="na-text-muted">No payments recorded.</p>
                }
                <h3 class="drawer__section">Refunds</h3>
                @if (booking.refunds.length) {
                  <ul class="plain-list">
                    @for (ref of booking.refunds; track ref.id) {
                      <li>
                        {{ money(ref.amount, ref.currency) }}
                        <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, ref.status).tone">{{ statusLabel(REFUND_STATUS_MAP, ref.status).label }}</na-badge>
                        <span class="na-text-muted"> · {{ ref.reason ?? 'No reason given' }} · {{ fmt(ref.createdAt) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="na-text-muted">No refunds.</p>
                }
              }
              @case ('notifications') {
                @if (bookingNotifications().length) {
                  <ul class="plain-list">
                    @for (n of bookingNotifications(); track n.id) {
                      <li>
                        <strong>{{ n.subject ?? 'Notification' }}</strong>
                        <span class="na-text-muted"> · {{ n.channel }} · {{ fmt(n.sentAt ?? n.createdAt) }}</span>
                        <p class="na-text-small na-text-muted">{{ n.content }}</p>
                      </li>
                    }
                  </ul>
                } @else {
                  <na-empty-state icon="✉" title="No notifications" message="Nothing has been sent for this booking yet." />
                }
              }
              @case ('audit') {
                @if (bookingAudit().length) {
                  <ul class="plain-list">
                    @for (log of bookingAudit(); track log.id) {
                      <li>
                        <span class="na-text-mono">{{ log.action }}</span>
                        <span class="na-text-muted"> · {{ log.actorName }} · {{ fmt(log.createdAt) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <na-empty-state icon="≡" title="No audit records" message="No staff actions have been logged against this booking." />
                }
              }
            }
          </div>

          <footer class="drawer__actions">
            @if (booking.status !== 'CANCELLED') {
              <na-button variant="danger" (clicked)="cancelOpen.set(true)">Cancel booking</na-button>
            }
            @if (booking.status !== 'CONFIRMED') {
              <span *naHasPermission="'bookings:manage'">
                <na-button variant="primary" (clicked)="openException()">Confirm without payment</na-button>
              </span>
            }
          </footer>
        </aside>
      }

      <na-dialog
        [open]="cancelOpen()"
        title="Cancel booking"
        confirmLabel="Cancel booking"
        [confirmDanger]="true"
        (confirmed)="confirmCancel()"
        (cancelled)="cancelOpen.set(false)"
      >
        @if (cancelEstimate(); as est) {
          <p>
            Estimated refund: <strong>{{ money(est.amount, selected()!.currency) }}</strong>
            (cancellation fee {{ est.feePercent }}%{{ est.refundable ? '' : ' — this fare is non-refundable' }}).
          </p>
          <p class="na-text-muted na-text-small">The customer will be notified and any eligible refund will enter the refund queue.</p>
        }
      </na-dialog>

      <na-dialog
        [open]="exceptionOpen()"
        title="Confirm without payment"
        confirmLabel="Confirm booking"
        (confirmed)="confirmException()"
        (cancelled)="exceptionOpen.set(false)"
      >
        <na-alert tone="warning" title="Exception workflow (BR-14)" icon="⚠">
          This action confirms a booking without a successful payment. The exception and your reason are
          permanently written to the audit log.
        </na-alert>
        <div class="na-field" style="margin-top: var(--na-space-4);">
          <label class="na-label" for="exception-reason">Reason (required)</label>
          <textarea
            id="exception-reason"
            class="na-input"
            rows="3"
            placeholder="e.g. Payment provider outage — verified with customer by phone"
            [ngModel]="exceptionReason()"
            (ngModelChange)="exceptionReason.set($event)"
          ></textarea>
        </div>
      </na-dialog>
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .filters { display: flex; gap: var(--na-space-4); padding: var(--na-space-4); margin-bottom: var(--na-space-5); flex-wrap: wrap; }
    .filters .na-field { margin-bottom: 0; }
    .filters__search { flex: 1 1 320px; }
    .filters__status { flex: 0 0 220px; }
    .backdrop { position: fixed; inset: 0; background: rgba(8, 17, 32, 0.5); z-index: 90; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 95;
      width: min(560px, 100vw); background: var(--na-surface-raised);
      box-shadow: var(--na-shadow-lg); display: flex; flex-direction: column;
      padding: var(--na-space-6); overflow-y: auto;
    }
    .drawer__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3); margin-bottom: var(--na-space-4); }
    .drawer__title { display: flex; align-items: center; gap: var(--na-space-3); font-size: var(--na-text-xl); }
    .drawer__close {
      background: none; border: none; font-size: 1.5rem; color: var(--na-ink-500);
      min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md);
    }
    .drawer__close:hover { background: var(--na-surface-sunken); color: var(--na-ink-900); }
    .drawer__body { padding: var(--na-space-4) 0; flex: 1; }
    .drawer__section { font-size: var(--na-text-base); margin: var(--na-space-4) 0 var(--na-space-2); }
    .drawer__actions { display: flex; gap: var(--na-space-3); flex-wrap: wrap; border-top: 1px solid var(--na-border); padding-top: var(--na-space-4); }
    .facts { margin: 0; display: grid; gap: var(--na-space-3); }
    .facts div { display: grid; grid-template-columns: 110px 1fr; gap: var(--na-space-3); }
    .facts dt { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .facts dd { margin: 0; }
    .plain-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .plain-list li { padding: var(--na-space-3); border: 1px solid var(--na-border); border-radius: var(--na-radius-md); }
    @media (max-width: 639px) {
      .drawer { width: 100vw; padding: var(--na-space-4); }
      .filters__status { flex: 1 1 100%; }
    }
  `,
})
export class AdminBookingsPage {
  private readonly bookingsService = inject(BookingService);
  private readonly toast = inject(ToastService);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly fmt = fmtDateTime;
  readonly money = formatMoney;

  readonly crumbs = [
    { label: 'Admin', link: '/admin/dashboard' },
    { label: 'Bookings' },
  ];

  readonly columns: TableColumn[] = [
    { key: 'reference', label: 'Reference' },
    { key: 'contact', label: 'Contact', priority: 'low' },
    { key: 'flight', label: 'Flight' },
    { key: 'amount', label: 'Amount' },
    { key: 'bookedAt', label: 'Booked', priority: 'low' },
    { key: 'status', label: 'Status' },
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
  readonly bookings = signal<Booking[]>([]);
  readonly query = signal('');
  readonly statusFilter = signal<'ALL' | BookingStatus>('ALL');
  readonly selected = signal<Booking | null>(null);
  readonly activeTab = signal('itinerary');
  readonly cancelOpen = signal(false);
  readonly exceptionOpen = signal(false);
  readonly exceptionReason = signal('');

  readonly tableRows = computed<BookingRow[]>(() =>
    this.bookings()
      .filter((b) => this.statusFilter() === 'ALL' || b.status === this.statusFilter())
      .map((b) => ({
        id: b.id,
        reference: b.bookingReference,
        contact: b.contactEmail,
        flight: `${b.flight.flightNumber} ${b.flight.route.origin.iataCode}→${b.flight.route.destination.iataCode}`,
        amount: formatMoney(b.totalAmount, b.currency),
        bookedAt: fmtDateTime(b.bookedAt),
        status: statusLabel(BOOKING_STATUS_MAP, b.status).label,
      })),
  );

  readonly bookingNotifications = computed(() => {
    const b = this.selected();
    return b ? NOTIFICATIONS.filter((n) => n.bookingId === b.id) : [];
  });

  readonly bookingAudit = computed(() => {
    const b = this.selected();
    return b ? AUDIT_LOGS.filter((l) => l.targetType === 'Booking' && l.targetId === b.id) : [];
  });

  readonly cancelEstimate = computed(() => {
    const b = this.selected();
    return b ? this.bookingsService.estimateCancellation(b) : null;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.bookingsService.adminBookings(this.query()).subscribe((list) => {
      this.bookings.set(list);
      this.loading.set(false);
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.load();
  }

  openBooking(id: string): void {
    const booking = this.bookings().find((b) => b.id === id) ?? null;
    this.selected.set(booking);
    this.activeTab.set('itinerary');
  }

  closeDrawer(): void {
    this.selected.set(null);
  }

  seatOf(booking: Booking, bookingPassengerId: string): string | null {
    return booking.seats.find((s) => s.bookingPassengerId === bookingPassengerId)?.seatNumber ?? null;
  }

  openException(): void {
    this.exceptionReason.set('');
    this.exceptionOpen.set(true);
  }

  confirmCancel(): void {
    const booking = this.selected();
    if (!booking) return;
    this.cancelOpen.set(false);
    this.bookingsService.cancelBooking(booking.id).subscribe({
      next: (updated) => {
        this.replaceBooking(updated);
        this.toast.success(`Booking ${updated.bookingReference} cancelled.`);
      },
      error: (err) => this.toast.error(err?.message ?? 'Could not cancel the booking.'),
    });
  }

  confirmException(): void {
    const booking = this.selected();
    if (!booking) return;
    const reason = this.exceptionReason().trim();
    if (!reason) {
      this.toast.error('A reason is required for the exception workflow.');
      return;
    }
    this.exceptionOpen.set(false);
    this.bookingsService.adminConfirmException(booking.id, reason).subscribe({
      next: (updated) => {
        this.replaceBooking(updated);
        this.toast.success(`Booking ${updated.bookingReference} confirmed by exception — reason recorded in the audit log.`);
      },
      error: (err) => this.toast.error(err?.message ?? 'Could not confirm the booking.'),
    });
  }

  private replaceBooking(updated: Booking): void {
    this.bookings.update((list) => list.map((b) => (b.id === updated.id ? { ...updated } : b)));
    this.selected.set({ ...updated });
  }
}
