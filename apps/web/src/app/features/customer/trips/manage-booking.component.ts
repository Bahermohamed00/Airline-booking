import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import {
  BOOKING_STATUS_MAP, PAYMENT_STATUS_MAP, REFUND_STATUS_MAP, FLIGHT_STATUS_MAP, statusLabel,
} from '../../../shared/utils/status-maps';
import type { Booking } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaTimeline, TimelineEvent } from '../../../shared/ui/timeline.component';
import { ToastService } from '../../../shared/ui/toast.service';

@Component({
  selector: 'app-manage-booking',
  standalone: true,
  imports: [RouterLink, NaBreadcrumbs, NaBadge, NaButton, NaAlert, NaSkeleton, NaEmptyState, NaDialog, NaTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <na-breadcrumbs [items]="[{ label: 'My bookings', link: '/bookings' }, { label: 'Booking details' }]" />

      @if (error()) {
        <na-alert tone="danger" title="Could not load this booking" retryable (retry)="load()">
          Something went wrong while fetching the booking.
        </na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="5rem" />
      } @else if (!booking()) {
        <na-empty-state
          title="Booking not found"
          message="We could not find this booking. Check the reference or search for a new flight."
          actionLabel="Search flights"
          (action)="router.navigate(['/search'])"
        />
      } @else if (booking(); as b) {
          <header class="head">
            <div>
              <h1>Booking <span class="na-text-mono">{{ b.bookingReference }}</span></h1>
              <p class="na-text-muted">Booked {{ fmt(b.bookedAt) }}</p>
            </div>
            <na-badge [tone]="statusLabel(BOOKING_STATUS_MAP, b.status).tone">
              {{ statusLabel(BOOKING_STATUS_MAP, b.status).label }}
            </na-badge>
          </header>

          @if (notOwner()) {
            <na-alert tone="info" title="Viewing another account's booking">
              This booking does not belong to the signed-in account. Some actions may be restricted.
            </na-alert>
          }

          <div class="grid">
            <section class="na-card section" aria-labelledby="itin-h">
              <h2 id="itin-h">Itinerary</h2>
              <div class="itin">
                <p class="itin__flight">
                  <strong>{{ b.flight.flightNumber }}</strong>
                  <na-badge [tone]="statusLabel(FLIGHT_STATUS_MAP, b.flight.status).tone">
                    {{ statusLabel(FLIGHT_STATUS_MAP, b.flight.status).label }}
                  </na-badge>
                </p>
                <div class="itin__route">
                  <div>
                    <p class="itin__code">{{ b.flight.route.origin.iataCode }}</p>
                    <p class="na-text-muted na-text-small">{{ b.flight.route.origin.city }}</p>
                    <p class="itin__time">{{ timeFmt(b.flight.departureTime) }}</p>
                    <p class="na-text-muted na-text-small">{{ dateFmt(b.flight.departureTime) }}</p>
                  </div>
                  <span class="itin__arrow" aria-hidden="true">→</span>
                  <div>
                    <p class="itin__code">{{ b.flight.route.destination.iataCode }}</p>
                    <p class="na-text-muted na-text-small">{{ b.flight.route.destination.city }}</p>
                    <p class="itin__time">{{ timeFmt(b.flight.arrivalTime) }}</p>
                    <p class="na-text-muted na-text-small">{{ dateFmt(b.flight.arrivalTime) }}</p>
                  </div>
                </div>
                <p class="na-text-muted na-text-small">Aircraft: {{ b.flight.aircraft.model }} ({{ b.flight.aircraft.registration }})</p>
              </div>
            </section>

            <section class="na-card section" aria-labelledby="pax-h">
              <h2 id="pax-h">Passengers &amp; seats</h2>
              <ul class="pax">
                @for (bp of b.passengers; track bp.id) {
                  <li class="pax__row">
                    <span>{{ bp.passenger.firstName }} {{ bp.passenger.lastName }}
                      <span class="na-text-muted na-text-small">({{ bp.passengerType }})</span>
                    </span>
                    <span class="na-text-mono">Seat {{ seatOf(b, bp.id) ?? 'Not selected' }}</span>
                  </li>
                }
              </ul>
              @if (baggageAllowance(b); as allowance) {
                <p class="na-text-muted na-text-small allowance">
                  Included baggage: {{ allowance.carryOn }} carry-on · {{ allowance.checked }} checked bag(s) up to {{ allowance.weightKg }} kg each
                </p>
              }
            </section>

            <section class="na-card section" aria-labelledby="pay-h">
              <h2 id="pay-h">Payments</h2>
              @if (b.payments.length === 0) {
                <p class="na-text-muted">No payments recorded.</p>
              } @else {
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Amount</th><th>Status</th><th>Reference</th><th>Paid at</th></tr>
                    </thead>
                    <tbody>
                      @for (p of b.payments; track p.id) {
                        <tr>
                          <td>{{ money(p.amount, p.currency) }}</td>
                          <td>
                            <na-badge [tone]="statusLabel(PAYMENT_STATUS_MAP, p.status).tone">
                              {{ statusLabel(PAYMENT_STATUS_MAP, p.status).label }}
                            </na-badge>
                          </td>
                          <td class="na-text-mono">{{ p.providerReference ?? '—' }}</td>
                          <td>{{ p.paidAt ? fmt(p.paidAt) : '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              @if (b.refunds.length > 0) {
                <h3 class="sub-h">Refunds</h3>
                <ul class="plain-list">
                  @for (r of b.refunds; track r.id) {
                    <li>
                      {{ money(r.amount, r.currency) }}
                      <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, r.status).tone">
                        {{ statusLabel(REFUND_STATUS_MAP, r.status).label }}
                      </na-badge>
                      <span class="na-text-muted na-text-small">· {{ r.reason ?? 'Refund' }}</span>
                    </li>
                  }
                </ul>
              }
            </section>

            <section class="na-card section" aria-labelledby="extras-h">
              <h2 id="extras-h">Extras</h2>
              @if (b.extras.length === 0) {
                <p class="na-text-muted">No extras purchased.</p>
              } @else {
                <ul class="plain-list">
                  @for (e of b.extras; track e.id) {
                    <li>
                      {{ e.extraService.name }} × {{ e.quantity }}
                      <span class="na-text-muted">— {{ money(e.price, b.currency) }}</span>
                    </li>
                  }
                </ul>
              }
            </section>

            <section class="na-card section" aria-labelledby="history-h">
              <h2 id="history-h">History</h2>
              <na-timeline [events]="timeline()" />
            </section>

            <section class="na-card section" aria-labelledby="actions-h">
              <h2 id="actions-h">Actions</h2>
              <p class="total">Total paid: <strong>{{ money(b.totalAmount, b.currency) }}</strong></p>
              <div class="actions">
                @if (b.status !== 'CANCELLED') {
                  <na-button variant="danger" (clicked)="cancelOpen.set(true)">Cancel booking</na-button>
                }
                <a routerLink="/search" class="rebook-link">Rebook / search flights</a>
              </div>
            </section>
          </div>

          <na-dialog
            [open]="cancelOpen()"
            title="Cancel this booking?"
            confirmLabel="Cancel booking"
            cancelLabel="Keep booking"
            [confirmDanger]="true"
            (cancelled)="cancelOpen.set(false)"
            (confirmed)="confirmCancel()"
          >
            @if (estimate(); as est) {
              <p>
                @if (est.refundable) {
                  A cancellation fee of {{ est.feePercent }}% applies. Estimated refund:
                  <strong>{{ money(est.amount, b.currency) }}</strong>.
                } @else {
                  This fare is non-refundable. Cancelling will not return any payment.
                }
              </p>
            }
            <p class="na-text-muted na-text-small">This action cannot be undone.</p>
          </na-dialog>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); margin-bottom: var(--na-space-6); flex-wrap: wrap; }
    .head h1 { font-size: var(--na-text-2xl); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4); margin-top: var(--na-space-4); }
    .section { padding: var(--na-space-6); }
    .section h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .sub-h { font-size: var(--na-text-base); margin: var(--na-space-4) 0 var(--na-space-2); }
    .itin__flight { display: flex; align-items: center; gap: var(--na-space-3); margin-bottom: var(--na-space-4); }
    .itin__route { display: flex; align-items: center; gap: var(--na-space-6); margin-bottom: var(--na-space-3); }
    .itin__code { font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); }
    .itin__time { font-size: var(--na-text-lg); font-weight: var(--na-font-semibold); }
    .itin__arrow { font-size: var(--na-text-xl); color: var(--na-ink-300); }
    .pax { list-style: none; margin: 0 0 var(--na-space-3); padding: 0; }
    .pax__row { display: flex; justify-content: space-between; gap: var(--na-space-4); padding: var(--na-space-2) 0; border-bottom: 1px solid var(--na-border); }
    .pax__row:last-child { border-bottom: none; }
    .allowance { margin-top: var(--na-space-2); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-2); font-size: var(--na-text-xs); text-transform: uppercase; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); }
    td { padding: var(--na-space-2); border-bottom: 1px solid var(--na-border); }
    tr:last-child td { border-bottom: none; }
    .plain-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-2); }
    .plain-list li { display: flex; align-items: center; gap: var(--na-space-2); flex-wrap: wrap; }
    .total { margin-bottom: var(--na-space-4); font-size: var(--na-text-lg); }
    .actions { display: flex; align-items: center; gap: var(--na-space-4); flex-wrap: wrap; }
    @media (max-width: 639px) {
      .grid { grid-template-columns: 1fr; }
      .itin__route { gap: var(--na-space-4); }
    }
  `,
})
export class ManageBookingPage {
  private readonly bookingService = inject(BookingService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly router = inject(Router);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly booking = signal<Booking | undefined>(undefined);
  readonly cancelOpen = signal(false);
  readonly cancelling = signal(false);

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  private readonly dFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
  private readonly tFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  readonly notOwner = computed(() => {
    const b = this.booking();
    const u = this.auth.user();
    return !!b && !!u && b.userId !== u.id;
  });

  readonly estimate = computed(() => {
    const b = this.booking();
    return b ? this.bookingService.estimateCancellation(b) : null;
  });

  readonly timeline = computed<TimelineEvent[]>(() => {
    const b = this.booking();
    if (!b) return [];
    const events: TimelineEvent[] = [
      { label: 'Booking created', timestamp: this.fmt(b.bookedAt), tone: 'info' },
    ];
    for (const p of b.payments) {
      events.push({
        label: `Payment ${statusLabel(PAYMENT_STATUS_MAP, p.status).label.toLowerCase()}`,
        detail: `${formatMoney(p.amount, p.currency)} via ${p.provider}`,
        timestamp: p.paidAt ? this.fmt(p.paidAt) : this.fmt(p.createdAt),
        tone: statusLabel(PAYMENT_STATUS_MAP, p.status).tone,
      });
    }
    for (const r of b.refunds) {
      events.push({
        label: `Refund ${statusLabel(REFUND_STATUS_MAP, r.status).label.toLowerCase()}`,
        detail: formatMoney(r.amount, r.currency),
        timestamp: this.fmt(r.processedAt ?? r.createdAt),
        tone: statusLabel(REFUND_STATUS_MAP, r.status).tone,
      });
    }
    if (b.status === 'CANCELLED' && b.refunds.length === 0) {
      events.push({ label: 'Booking cancelled', tone: 'danger' });
    }
    if (b.status === 'CHECKED_IN') {
      events.push({ label: 'Checked in', tone: 'success' });
    }
    return events;
  });

  constructor() {
    this.route.paramMap.subscribe(() => this.load());
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading.set(true);
    this.error.set(false);
    this.bookingService.getById(id).subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  confirmCancel(): void {
    const b = this.booking();
    if (!b || this.cancelling()) return;
    this.cancelling.set(true);
    this.bookingService.cancelBooking(b.id).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.booking.set({ ...updated });
        this.toast.success('Booking cancelled. Any eligible refund has been requested.');
      },
      error: (err) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.toast.error(err?.message ?? 'Could not cancel this booking.');
      },
    });
  }

  seatOf(b: Booking, bookingPassengerId: string): string | null {
    return b.seats.find((s) => s.bookingPassengerId === bookingPassengerId)?.seatNumber ?? null;
  }

  baggageAllowance(b: Booking): { carryOn: number; checked: number; weightKg: number } | null {
    const rules = b.flight.fares[0]?.rules;
    if (!rules) return null;
    return {
      carryOn: rules.carryOnPieces,
      checked: rules.checkedBaggagePieces,
      weightKg: rules.checkedBaggageWeightKg,
    };
  }

  money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }

  dateFmt(iso: string): string {
    return this.dFmt.format(new Date(iso));
  }

  timeFmt(iso: string): string {
    return this.tFmt.format(new Date(iso));
  }
}
