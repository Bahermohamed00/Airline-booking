import { Component, inject, signal } from '@angular/core';
import {
  AdminCheckinService,
  type AdminCheckInBooking,
  type CheckinWindowState,
} from './admin-checkin.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { FLIGHT_STATUS_MAP, BOOKING_STATUS_MAP, statusLabel, type StatusPresentation } from '../../../core/status-maps';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const WINDOW_STATE_MAP: Record<CheckinWindowState, StatusPresentation> = {
  NOT_OPEN: { label: 'Opens 24h before', tone: 'neutral' },
  OPEN: { label: 'Open', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'warning' },
};

/**
 * Staff check-in operations console. All data comes from the API
 * (GET /admin/checkin, PostgreSQL-backed); invalidation is persisted
 * server-side with audit. There is deliberately no local/demo fallback —
 * a load failure is shown as a retryable error.
 */
@Component({
  selector: 'na-admin-checkin',
  imports: [NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaDialog, NaSkeleton, NaEmptyState],
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
      } @else if (loadError(); as err) {
        <na-alert tone="danger" title="Could not load check-in data" retryable (retry)="load()">{{ err }}</na-alert>
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
                <th>Check-in window</th>
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
                    @if (booking.flight; as flight) {
                      {{ flight.flightNumber }}
                      <span class="na-text-muted">{{ flight.route.originIata }}→{{ flight.route.destinationIata }}</span>
                    } @else {
                      —
                    }
                  </td>
                  <td data-label="Departure">{{ booking.flight ? fmtDate(booking.flight.departureTime) : '—' }}</td>
                  <td data-label="Booking status">
                    <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, booking.status).tone">
                      {{ statusLabel(BOOKING_STATUS_MAP, booking.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Check-in window">
                    @if (booking.windowState; as windowState) {
                      <na-badge [tone]="statusLabel(WINDOW_STATE_MAP, windowState).tone">
                        {{ statusLabel(WINDOW_STATE_MAP, windowState).label }}
                      </na-badge>
                    } @else {
                      —
                    }
                  </td>
                  <td data-label="Checked in">
                    {{ booking.checkedInCount }}/{{ booking.passengersTotal }}
                    @if (booking.invalidatedCount > 0) {
                      <na-badge tone="warning">Passes invalidated ({{ booking.invalidatedCount }})</na-badge>
                    }
                  </td>
                  <td data-label="Flight status">
                    @if (booking.flight; as flight) {
                      <na-badge [tone]="statusLabel(FLIGHT_STATUS_MAP, flight.status).tone">
                        {{ statusLabel(FLIGHT_STATUS_MAP, flight.status).label }}
                      </na-badge>
                    } @else {
                      —
                    }
                  </td>
                  <td data-label="Actions">
                    <na-button
                      variant="secondary"
                      size="sm"
                      [disabled]="booking.checkedInCount === 0 || invalidating()"
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
        [confirmDisabled]="invalidating()"
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
  private readonly api = inject(AdminCheckinService);
  private readonly toast = inject(ToastService);

  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly WINDOW_STATE_MAP = WINDOW_STATE_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Check-in' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly bookings = signal<AdminCheckInBooking[]>([]);
  readonly pendingInvalidate = signal<AdminCheckInBooking | null>(null);
  readonly invalidating = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.operationalList().subscribe({
      next: (list) => {
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        // No demo fallback: the error is explicit and retryable.
        this.loadError.set('Could not load check-in data. Please try again.');
      },
    });
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  confirmInvalidate(): void {
    const booking = this.pendingInvalidate();
    if (!booking || this.invalidating()) return;
    this.invalidating.set(true);
    this.api.invalidatePasses(booking.id).subscribe({
      next: (result) => {
        this.invalidating.set(false);
        this.pendingInvalidate.set(null);
        this.toast.success(
          `${result.invalidatedCount} boarding pass record(s) invalidated for ${booking.bookingReference} — passengers must check in again.`,
        );
        // The server is the source of truth for the resulting state.
        this.load();
      },
      error: (err: unknown) => {
        this.invalidating.set(false);
        this.pendingInvalidate.set(null);
        const serverMessage = (
          err as { error?: { message?: string | string[] } } | null
        )?.error?.message;
        this.toast.error(
          typeof serverMessage === 'string' && serverMessage.length > 0
            ? serverMessage
            : 'Could not invalidate the boarding passes. Please try again.',
        );
      },
    });
  }
}
