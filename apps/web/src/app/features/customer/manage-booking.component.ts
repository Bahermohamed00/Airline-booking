import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CustomerBookingService } from '../../core/services/customer-booking.service';
import { PaymentService } from '../../core/services/payment.service';
import { formatMoney } from '../../core/services/pricing.service';
import {
  BOOKING_STATUS_MAP, FLIGHT_STATUS_MAP, PAYMENT_STATUS_MAP, REFUND_STATUS_MAP, SEAT_HOLD_STATUS_MAP, statusLabel,
} from '../../core/status-maps';
import type { CustomerBooking } from '../../core/models/customer-booking.model';
import type { CustomerPayment } from '../../core/models/payment.model';
import { toErrorMessage } from '../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../shared/ui/breadcrumbs.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';
import { NaDialog } from '../../shared/ui/dialog.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-manage-booking',
  imports: [RouterLink, NaBreadcrumbs, NaBadge, NaButton, NaAlert, NaSkeleton, NaEmptyState, NaDialog],
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

          <div class="grid">
            <section class="na-card section" aria-labelledby="itin-h">
              <h2 id="itin-h">Itinerary</h2>
              @if (b.flight; as f) {
                <div class="itin">
                  <p class="itin__flight">
                    <strong>{{ f.flightNumber }}</strong>
                    <na-badge [tone]="statusLabel(FLIGHT_STATUS_MAP, f.status).tone">
                      {{ statusLabel(FLIGHT_STATUS_MAP, f.status).label }}
                    </na-badge>
                  </p>
                  <div class="itin__route">
                    <div>
                      <p class="itin__code">{{ f.origin }}</p>
                      <p class="itin__time">{{ timeFmt(f.departureTime) }}</p>
                      <p class="na-text-muted na-text-small">{{ dateFmt(f.departureTime) }}</p>
                    </div>
                    <span class="itin__arrow" aria-hidden="true">→</span>
                    <div>
                      <p class="itin__code">{{ f.destination }}</p>
                      <p class="itin__time">{{ timeFmt(f.arrivalTime) }}</p>
                      <p class="na-text-muted na-text-small">{{ dateFmt(f.arrivalTime) }}</p>
                    </div>
                  </div>
                </div>
              } @else {
                <p class="na-text-muted">Flight details are being finalized and will appear here shortly.</p>
              }
            </section>

            <section class="na-card section" aria-labelledby="pax-h">
              <h2 id="pax-h">Passengers &amp; seats</h2>
              <ul class="pax">
                @for (p of b.passengers; track p.id) {
                  <li class="pax__row">
                    <span>{{ p.firstName }} {{ p.lastName }}
                      <span class="na-text-muted na-text-small">({{ p.passengerType }})</span>
                    </span>
                  </li>
                }
              </ul>
              @if (b.seats.length === 0) {
                <p class="na-text-muted na-text-small">No seats selected.</p>
              } @else {
                <ul class="pax">
                  @for (s of b.seats; track s.seatId) {
                    <li class="pax__row">
                      <span class="na-text-mono">Seat {{ s.seatNumber }}</span>
                      <span class="na-text-small">
                        <na-badge [tone]="statusLabel(SEAT_HOLD_STATUS_MAP, s.holdStatus).tone">
                          {{ statusLabel(SEAT_HOLD_STATUS_MAP, s.holdStatus).label }}
                        </na-badge>
                        @if (s.holdStatus === 'ACTIVE') {
                          <span class="na-text-muted"> · held until {{ fmt(s.holdExpiresAt) }}</span>
                        }
                      </span>
                    </li>
                  }
                </ul>
              }
            </section>

            <section class="na-card section" aria-labelledby="pay-h">
              <h2 id="pay-h">Payment</h2>

              @if (paymentError(); as payErr) {
                <na-alert tone="danger" icon="✕" title="Payment failed">
                  {{ payErr }}
                  @if (b.status === 'PENDING') {
                    <div class="pay-retry">
                      <na-button variant="secondary" size="sm" (clicked)="startPayment()">Try again</na-button>
                    </div>
                  }
                </na-alert>
              }

              @if (b.status === 'PENDING') {
                <div class="pay-due">
                  <p class="pay-due__amount">Payment due: <strong>{{ money(b.totalAmount, b.currency) }}</strong></p>
                  <p class="na-text-muted na-text-small">
                    Your seats stay held while payment is pending. Pay now to confirm the booking.
                  </p>
                  <na-button variant="primary" (clicked)="startPayment()">Pay now</na-button>
                </div>
              }

              @if (paymentsError()) {
                <div class="pay-load-error" role="alert">
                  <span>Could not load payment details.</span>
                  <button type="button" class="pay-load-error__retry" (click)="loadPayments(b.id)">Retry</button>
                </div>
              } @else if (payments(); as list) {
                @if (list.length === 0) {
                  @if (b.status !== 'PENDING') {
                    <p class="na-text-muted">No payment has been recorded for this booking.</p>
                  }
                } @else {
                  @for (p of list; track p.id) {
                    <article class="pay-card">
                      <header class="pay-card__head">
                        <strong>{{ money(p.amount, p.currency) }}</strong>
                        <na-badge [tone]="statusLabel(PAYMENT_STATUS_MAP, p.status).tone">
                          {{ statusLabel(PAYMENT_STATUS_MAP, p.status).label }}
                        </na-badge>
                      </header>
                      <dl class="pay-facts">
                        <div>
                          <dt>Provider</dt>
                          <dd>{{ p.provider }}</dd>
                        </div>
                        <div>
                          <dt>Provider reference</dt>
                          <dd class="na-text-mono">{{ p.providerReference ?? '—' }}</dd>
                        </div>
                        @if (p.paidAt) {
                          <div>
                            <dt>Paid</dt>
                            <dd>{{ fmt(p.paidAt) }}</dd>
                          </div>
                        }
                        @if (p.failedAt) {
                          <div>
                            <dt>Failed</dt>
                            <dd>{{ fmt(p.failedAt) }}</dd>
                          </div>
                        }
                      </dl>
                      @if (p.refunds.length) {
                        <div class="pay-refunds">
                          <h3>Refunds</h3>
                          <ul>
                            @for (r of p.refunds; track r.id) {
                              <li>
                                {{ money(r.amount, r.currency) }}
                                <na-badge [tone]="statusLabel(REFUND_STATUS_MAP, r.status).tone">
                                  {{ statusLabel(REFUND_STATUS_MAP, r.status).label }}
                                </na-badge>
                                <span class="na-text-muted na-text-small">
                                  @if (r.reason) { · {{ r.reason }} }
                                  @if (r.processedAt) { · processed {{ fmt(r.processedAt) }} }
                                </span>
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    </article>
                  }
                }
              }
            </section>

            <section class="na-card section" aria-labelledby="contact-h">
              <h2 id="contact-h">Contact</h2>
              <p>{{ b.contactEmail }}</p>
              <p class="na-text-muted">{{ b.contactPhone ?? 'No phone number provided' }}</p>
            </section>

            <section class="na-card section" aria-labelledby="actions-h">
              <h2 id="actions-h">Actions</h2>
              <p class="total">Total: <strong>{{ money(b.totalAmount, b.currency) }}</strong></p>
              @if (b.perPassengerTotal !== null) {
                <p class="per-pax na-text-muted na-text-small">{{ money(b.perPassengerTotal, b.currency) }} per passenger</p>
              }
              <div class="actions">
                @if (b.status === 'PENDING') {
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
            <p>This booking is pending payment — no charge has been made. Cancelling releases the held seats.</p>
            <p class="na-text-muted na-text-small">This action cannot be undone.</p>
          </na-dialog>

          <na-dialog
            [open]="payOpen()"
            title="Pay for your booking"
            [confirmLabel]="processing() ? 'Processing…' : 'Pay ' + money(b.totalAmount, b.currency)"
            cancelLabel="Not now"
            (cancelled)="onPayDialogCancelled()"
            (confirmed)="confirmPayment()"
          >
            <p>
              You are paying <strong>{{ money(b.totalAmount, b.currency) }}</strong> for booking
              <span class="na-text-mono">{{ b.bookingReference }}</span>.
            </p>
            <p class="na-text-muted na-text-small">
              Payment is handled by a mock provider — no card data is collected or stored here.
              The booking is confirmed as soon as the payment succeeds.
            </p>
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
    .itin__flight { display: flex; align-items: center; gap: var(--na-space-3); margin-bottom: var(--na-space-4); }
    .itin__route { display: flex; align-items: center; gap: var(--na-space-6); }
    .itin__code { font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); }
    .itin__time { font-size: var(--na-text-lg); font-weight: var(--na-font-semibold); }
    .itin__arrow { font-size: var(--na-text-xl); color: var(--na-ink-300); }
    .pax { list-style: none; margin: 0 0 var(--na-space-3); padding: 0; }
    .pax:last-child { margin-bottom: 0; }
    .pax__row { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); padding: var(--na-space-2) 0; border-bottom: 1px solid var(--na-border); }
    .pax__row:last-child { border-bottom: none; }
    .total { margin-bottom: var(--na-space-2); font-size: var(--na-text-lg); }
    .per-pax { margin-bottom: var(--na-space-4); }
    .actions { display: flex; align-items: center; gap: var(--na-space-4); flex-wrap: wrap; }
    .pay-due__amount { font-size: var(--na-text-lg); margin-bottom: var(--na-space-2); }
    .pay-due na-button { margin-top: var(--na-space-3); }
    .pay-retry { margin-top: var(--na-space-2); }
    .pay-load-error {
      display: flex; align-items: center; gap: var(--na-space-3);
      font-size: var(--na-text-sm); color: var(--na-ink-700); margin-top: var(--na-space-3);
    }
    .pay-load-error__retry {
      background: none; border: 1px solid var(--na-border-strong); border-radius: var(--na-radius-sm);
      padding: 0.2rem 0.6rem; color: var(--na-ink-900); font-weight: var(--na-font-semibold);
    }
    .pay-card { border: 1px solid var(--na-border); border-radius: var(--na-radius-md); padding: var(--na-space-3) var(--na-space-4); margin-top: var(--na-space-3); }
    .pay-card__head { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-3); }
    .pay-facts { margin: var(--na-space-2) 0 0; display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); }
    .pay-facts div { display: grid; grid-template-columns: 130px 1fr; gap: var(--na-space-3); }
    .pay-facts dt { color: var(--na-ink-500); }
    .pay-facts dd { margin: 0; }
    .pay-refunds h3 { font-size: var(--na-text-sm); margin: var(--na-space-3) 0 var(--na-space-1); }
    .pay-refunds ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); }
    @media (max-width: 639px) {
      .grid { grid-template-columns: 1fr; }
      .itin__route { gap: var(--na-space-4); }
    }
  `,
})
export class ManageBookingPage {
  private readonly bookingService = inject(CustomerBookingService);
  private readonly paymentService = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly router = inject(Router);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly FLIGHT_STATUS_MAP = FLIGHT_STATUS_MAP;
  readonly SEAT_HOLD_STATUS_MAP = SEAT_HOLD_STATUS_MAP;
  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly REFUND_STATUS_MAP = REFUND_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly booking = signal<CustomerBooking | null>(null);
  readonly cancelOpen = signal(false);
  readonly cancelling = signal(false);

  /** null = not loaded yet (or not requested); payments failure is non-blocking. */
  readonly payments = signal<CustomerPayment[] | null>(null);
  readonly paymentsError = signal(false);
  readonly payOpen = signal(false);
  readonly processing = signal(false);
  readonly paymentError = signal<string | null>(null);

  /** Generated once per user-initiated payment attempt; retried requests in
   *  the same attempt reuse it, a fresh attempt after failure regenerates it. */
  private idempotencyKey = '';

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  private readonly dFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
  private readonly tFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

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
        this.loadPayments(booking.id);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        // The API answers 404 for unknown ids and other users' bookings alike.
        if ((err as { status?: number } | null)?.status === 404) {
          this.booking.set(null);
        } else {
          this.error.set(true);
        }
      },
    });
  }

  loadPayments(bookingId: string): void {
    this.paymentsError.set(false);
    this.paymentService.getPayments(bookingId).subscribe({
      next: (list) => this.payments.set(list),
      error: () => this.paymentsError.set(true),
    });
  }

  /** Opens the payment confirmation dialog with a fresh idempotency key. */
  startPayment(): void {
    const b = this.booking();
    if (!b || b.status !== 'PENDING' || this.processing()) return;
    this.idempotencyKey = crypto.randomUUID();
    this.paymentError.set(null);
    this.payOpen.set(true);
  }

  onPayDialogCancelled(): void {
    // An in-flight payment must not be interrupted or repeated.
    if (this.processing()) return;
    this.payOpen.set(false);
  }

  confirmPayment(): void {
    const b = this.booking();
    if (!b || this.processing()) return;
    this.processing.set(true);
    this.paymentService
      .tokenize()
      .pipe(
        switchMap((token) =>
          this.paymentService.pay(b.id, { token, idempotencyKey: this.idempotencyKey }),
        ),
      )
      .subscribe({
        next: (result) => {
          this.processing.set(false);
          this.payOpen.set(false);
          this.paymentError.set(null);
          this.booking.set(result.booking);
          this.payments.update((list) => [result.payment, ...(list ?? [])]);
          this.toast.success('Payment successful — your booking is confirmed.');
        },
        error: (err: unknown) => {
          this.processing.set(false);
          this.payOpen.set(false);
          this.paymentError.set(this.describePaymentError(err));
        },
      });
  }

  private describePaymentError(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    const serverMessage = (err as { error?: { message?: string | string[] } } | null)?.error
      ?.message;
    const message = Array.isArray(serverMessage) ? serverMessage.join(' ') : serverMessage;
    // 402 and 409 bodies are safe to display per the API contract.
    if ((status === 402 || status === 409) && message) return message;
    return toErrorMessage(
      err,
      'Payment could not be completed. Please try again.',
      'This booking is no longer payable.',
    );
  }

  confirmCancel(): void {
    const b = this.booking();
    if (!b || this.cancelling()) return;
    this.cancelling.set(true);
    this.bookingService.cancel(b.id).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.booking.set(updated);
        this.toast.success('Booking cancelled. The held seats have been released.');
      },
      error: (err: unknown) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.toast.error(
          (err as { status?: number } | null)?.status === 409
            ? 'Only pending bookings can be cancelled.'
            : 'Could not cancel this booking. Please try again.',
        );
      },
    });
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
