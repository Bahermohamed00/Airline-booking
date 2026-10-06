import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { PaymentService } from './payment.service';
import { formatMoney } from '../../../core/services/pricing.service';
import {
  BOOKING_STATUS_MAP,
  FLIGHT_STATUS_MAP,
  PAYMENT_STATUS_MAP,
  REFUND_STATUS_MAP,
  SEAT_HOLD_STATUS_MAP,
  statusLabel,
} from '../../../core/status-maps';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';
import type { CustomerPayment } from '../../../core/models/payment.model';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { ToastService } from '../../../shared/ui/toast.service';

@Component({
  selector: 'app-manage-booking',
  imports: [
    RouterLink,
    NaBreadcrumbs,
    NaBadge,
    NaButton,
    NaAlert,
    NaSkeleton,
    NaEmptyState,
    NaDialog,
  ],
  templateUrl: './manage-booking.component.html',
  styleUrl: './manage-booking.component.css',
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

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
