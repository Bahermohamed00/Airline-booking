import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CheckInService } from '../../../core/services/domain-services';
import { BookingService } from '../../../core/services/booking.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { FLIGHT_STATUS_MAP, BOOKING_STATUS_MAP, statusLabel } from '../../../shared/utils/status-maps';
import type { Booking } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

@Component({
  selector: 'na-admin-checkin',
  standalone: true,
  imports: [NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaDialog, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Check-in</h1>
        <p class="page__sub">Check-in readiness across bookings and boarding pass control.</p>
      </header>

      <na-alert tone="info" icon="✓">
        Online check-in opens 24 hours before departure and closes 1 hour before. Boarding passes can be
        invalidated by authorized staff — the passenger must check in again afterwards.
      </na-alert>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (bookings().length === 0) {
        <na-empty-state icon="✓" title="No bookings" message="There are no bookings to review for check-in." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Flight</th>
                <th>Departure</th>
                <th>Booking status</th>
                <th>Checked in</th>
                <th>Flight status</th>
                <th><span class="na-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (booking of bookings(); track booking.id) {
                <tr>
                  <td data-label="Reference" class="na-text-mono">{{ booking.bookingReference }}</td>
                  <td data-label="Flight">
                    {{ booking.flight.flightNumber }}
                    <span class="na-text-muted">{{ booking.flight.route.origin.iataCode }}→{{ booking.flight.route.destination.iataCode }}</span>
                  </td>
                  <td data-label="Departure">{{ fmtDate(booking.flight.departureTime) }}</td>
                  <td data-label="Booking status">
                    <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, booking.status).tone">
                      {{ statusLabel(BOOKING_STATUS_MAP, booking.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Checked in">
                    {{ checkedInCount(booking) }}/{{ booking.passengers.length }}
                    @if (invalidated().has(booking.id)) {
                      <na-badge tone="warning">Passes invalidated</na-badge>
                    }
                  </td>
                  <td data-label="Flight status">
                    <na-badge [tone]="statusLabel(FLIGHT_STATUS_MAP, booking.flight.status).tone">
                      {{ statusLabel(FLIGHT_STATUS_MAP, booking.flight.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Actions">
                    <na-button
                      variant="secondary"
                      size="sm"
                      [disabled]="invalidated().has(booking.id)"
                      (clicked)="pendingInvalidate.set(booking)"
                    >
                      Invalidate passes
                    </na-button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <na-dialog
        [open]="pendingInvalidate() !== null"
        title="Invalidate boarding passes"
        confirmLabel="Invalidate"
        [confirmDanger]="true"
        (confirmed)="confirmInvalidate()"
        (cancelled)="pendingInvalidate.set(null)"
      >
        @if (pendingInvalidate(); as booking) {
          <p>
            Invalidate all boarding passes issued for booking
            <span class="na-text-mono">{{ booking.bookingReference }}</span>?
          </p>
          <p class="na-text-muted na-text-small">
            Affected passengers must complete check-in again before boarding. This action is audit-logged.
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
    na-alert { display: block; margin-bottom: var(--na-space-5); }
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
export class AdminCheckInPage {
  private readonly checkInService = inject(CheckInService);
  private readonly bookingService = inject(BookingService);
  private readonly toast = inject(ToastService);

  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Check-in' },
  ];

  readonly loading = signal(true);
  readonly bookings = signal<Booking[]>([]);
  readonly invalidated = signal<Set<string>>(new Set());
  readonly pendingInvalidate = signal<Booking | null>(null);

  constructor() {
    this.bookingService.adminBookings().subscribe((list) => {
      this.bookings.set(list);
      this.loading.set(false);
    });
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  checkedInCount(booking: Booking): number {
    if (this.invalidated().has(booking.id)) return 0;
    return this.checkInService.alreadyCheckedIn(booking.id).filter((c) => c.status === 'COMPLETED').length;
  }

  confirmInvalidate(): void {
    const booking = this.pendingInvalidate();
    if (!booking) return;
    this.invalidated.update((set) => new Set(set).add(booking.id));
    this.toast.success(`Boarding passes for ${booking.bookingReference} invalidated — passengers must check in again.`);
    this.pendingInvalidate.set(null);
  }
}
