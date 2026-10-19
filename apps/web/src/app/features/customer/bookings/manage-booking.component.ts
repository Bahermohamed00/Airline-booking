import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, switchMap } from 'rxjs';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { PaymentService, PaymentConfigurationError } from './payment.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { formatMoney } from '../../../core/services/pricing.service';
import {
  BOOKING_STATUS_MAP,
  FLIGHT_STATUS_MAP,
  PAYMENT_STATUS_MAP,
  REFUND_STATUS_MAP,
  SEAT_HOLD_STATUS_MAP,
  statusLabel,
} from '../../../core/status-maps';
import type { CancellationPreview, CustomerBooking } from '../../../core/models/customer-booking.model';
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

/**
 * Stripe payment flow states:
 * - idle: no active payment flow in the dialog;
 * - creating: POST /payment in flight (PaymentIntent being created/resumed);
 * - ready: Payment Element mounted, awaiting the customer;
 * - confirming: stripe.confirmPayment running (incl. the 3DS modal);
 * - processing: Stripe accepted the payment — polling the backend for the
 *   webhook-driven final state.
 */
type PayState = 'idle' | 'creating' | 'ready' | 'confirming' | 'processing' | 'error';

/** Minimum refresh-recovery data for an in-flight attempt — never card data, never secrets. */
interface PersistedPaymentAttempt {
  bookingId: string;
  idempotencyKey: string;
}

const paymentAttemptKey = (bookingId: string): string =>
  `novaair.paymentAttempt.${bookingId}`;

@Component({
  selector: 'app-manage-booking',
  imports: [
    RouterLink,
    ReactiveFormsModule,
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
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
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

  /** Cancellation-request flow (CONFIRMED bookings): dialog + submit state. */
  readonly requestOpen = signal(false);
  readonly requesting = signal(false);
  /** Optional customer note (max 500 per the API contract). */
  readonly reasonControl = this.fb.nonNullable.control('', Validators.maxLength(500));

  /**
   * Server-calculated cancellation preview (null = not loaded/applicable). The
   * backend is the only source of cancellation eligibility and refund amounts;
   * the preview is informational and the final cancellation recalculates.
   */
  readonly preview = signal<CancellationPreview | null>(null);

  /** Latest cancellation review state attached to the booking view. */
  readonly cancellationRequest = computed(() => this.booking()?.cancellationRequest ?? null);
  readonly requestPending = computed(() => this.cancellationRequest()?.status === 'PENDING');
  readonly requestRejected = computed(() => this.cancellationRequest()?.status === 'REJECTED');
  /** APPROVED shows only until the booking status itself flips to CANCELLED. */
  readonly requestApproved = computed(
    () =>
      this.cancellationRequest()?.status === 'APPROVED' &&
      this.booking()?.status !== 'CANCELLED',
  );

  /** Direct cancellation is offered only for unpaid PENDING bookings. */
  readonly cancelAvailable = computed(() => {
    const b = this.booking();
    const p = this.preview();
    return !!b && b.status === 'PENDING' && !!p?.allowed;
  });

  /**
   * A cancellation REQUEST is offered for CONFIRMED bookings when the policy
   * allows cancellation and no request is currently pending/approved. A
   * REJECTED request leaves the booking active and may be re-requested.
   */
  readonly requestAvailable = computed(() => {
    const b = this.booking();
    const p = this.preview();
    return (
      !!b &&
      b.status === 'CONFIRMED' &&
      !!p?.allowed &&
      !this.requestPending() &&
      !this.requestApproved()
    );
  });

  /** Preview evaluated and policy says no — explain instead of hiding the topic. */
  readonly cancelUnavailable = computed(() => {
    const b = this.booking();
    const p = this.preview();
    return (
      !!b &&
      (b.status === 'PENDING' || b.status === 'CONFIRMED') &&
      !!p &&
      !p.allowed &&
      !this.requestPending() &&
      !this.requestApproved()
    );
  });

  /** null = not loaded yet (or not requested); payments failure is non-blocking. */
  readonly payments = signal<CustomerPayment[] | null>(null);
  readonly paymentsError = signal(false);
  readonly payOpen = signal(false);
  readonly paymentError = signal<string | null>(null);

  readonly providerMode = this.paymentService.providerMode;
  /**
   * Which payment flow to drive. The environment is the primary signal, but
   * the backend is authoritative: if an open (PENDING) non-mock payment exists
   * for this booking, the Stripe resume flow applies even when the dev
   * environment still says 'mock' — a stale mode mismatch must never send the
   * customer down the legacy synchronous path.
   */
  readonly stripeFlow = computed(() => {
    if (this.providerMode === 'stripe') return true;
    const latest = this.payments()?.[0];
    return !!latest && latest.status === 'PENDING' && latest.provider !== 'mock';
  });
  readonly payState = signal<PayState>('idle');
  /** Customer-safe message inside the payment dialog (card errors, confirming/processing). */
  readonly paymentNotice = signal<string | null>(null);
  /** Page-level informational note (still-processing timeout, in-progress recovery). */
  readonly paymentInfo = signal<string | null>(null);
  /** True when a persisted unfinished attempt can be resumed after a browser refresh. */
  readonly resumeAvailable = signal(false);

  /**
   * One logical payment attempt = one UUID v4. Reused for network/5xx retries
   * and browser-refresh resume; replaced only after a terminal failure (402 /
   * FAILED / canceled), when the next attempt mints a fresh key.
   */
  private idempotencyKey = '';

  /**
   * True once a terminal payment state (SUCCESS/FAILED) was applied for the
   * currently shown booking. Guards against duplicate realtime events and
   * stale in-flight responses overwriting the terminal state; reset when a
   * NEW attempt starts or the route changes.
   */
  private settled = false;

  /** Live tracking (realtime push + bounded recovery poll) while pending. */
  private trackingSub: Subscription | null = null;
  private trackingBookingId: string | null = null;

  private readonly pendingClientSecret = signal<string | null>(null);
  private readonly elementHost = viewChild<ElementRef<HTMLElement>>('paymentElement');

  /** True while Stripe confirmation or backend polling must not be interrupted. */
  readonly payDialogLocked = computed(
    () => this.payState() === 'confirming' || this.payState() === 'processing',
  );

  /**
   * The Pay action is enabled only when it can actually run: in Stripe mode
   * that means the Payment Element reported ready; in mock mode only an
   * in-flight confirmation blocks it.
   */
  readonly payConfirmDisabled = computed(() => {
    if (!this.stripeFlow()) return this.payDialogLocked();
    return this.payState() !== 'ready';
  });

  readonly payConfirmLabel = computed(() => {
    const b = this.booking();
    const amount = b ? this.money(b.totalAmount, b.currency) : '';
    switch (this.payState()) {
      case 'creating':
        return 'Loading…';
      case 'confirming':
        return 'Confirming…';
      case 'processing':
        return 'Processing…';
      case 'error':
        return 'Payment unavailable';
      default:
        return `Pay ${amount}`;
    }
  });

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  private readonly dFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
  private readonly tFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTracking());
    this.route.paramMap.subscribe(() => {
      // A different booking starts fresh: clear the terminal-state guard and
      // tear down the previous booking's watchers/polling.
      this.settled = false;
      this.stopTracking();
      this.load();
    });
    // Mount the Stripe Payment Element once both the dialog DOM host and the
    // clientSecret exist (the dialog renders its body only while open).
    effect(() => {
      const secret = this.pendingClientSecret();
      const host = this.elementHost()?.nativeElement;
      if (secret && host && this.payOpen()) {
        this.pendingClientSecret.set(null);
        void this.mountElement(host, secret);
      }
    });
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
        this.loadPreview(booking);
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

  /**
   * Fetches the server-calculated cancellation preview for cancellable
   * statuses. Non-blocking: a preview failure simply keeps the cancellation
   * action hidden — the cancellation endpoint remains the real gate.
   */
  private loadPreview(booking: CustomerBooking): void {
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      this.preview.set(null);
      return;
    }
    this.bookingService.cancellationPreview(booking.id).subscribe({
      next: (p) => this.preview.set(p),
      error: () => this.preview.set(null),
    });
  }

  loadPayments(bookingId: string): void {
    this.paymentsError.set(false);
    this.paymentService.getPayments(bookingId).subscribe({
      next: (list) => {
        this.payments.set(list);
        this.evaluateResume(bookingId, list);
      },
      error: () => this.paymentsError.set(true),
    });
  }

  // ---------- Payment flow ----------

  /**
   * Pay now (or Complete payment after a refresh). Creates or resumes the
   * single logical payment attempt for this booking.
   */
  startPayment(): void {
    const b = this.booking();
    if (!b || b.status !== 'PENDING' || this.payState() !== 'idle') return;
    // A new logical attempt: clear the terminal-state guard of any previous one.
    this.settled = false;
    this.resumeAvailable.set(false);
    this.paymentError.set(null);
    this.paymentInfo.set(null);
    this.paymentNotice.set(null);

    if (!this.stripeFlow()) {
      this.idempotencyKey = crypto.randomUUID();
      this.payOpen.set(true);
      return;
    }

    // Reuse the persisted key of an unfinished attempt — the backend resumes
    // the same PaymentIntent for it. Only a fresh attempt mints a new UUID.
    const persisted = this.readPersistedAttempt(b.id);
    this.idempotencyKey = persisted?.idempotencyKey ?? crypto.randomUUID();
    this.persistAttempt(b.id);
    this.payOpen.set(true);
    this.beginIntent(b.id);
  }

  resumePayment(): void {
    this.startPayment();
  }

  /** Creates/resumes the PaymentIntent; HTTP 200 here means "intent ready", never "paid". */
  private beginIntent(bookingId: string): void {
    this.payState.set('creating');
    this.paymentService
      .pay(bookingId, { idempotencyKey: this.idempotencyKey })
      .subscribe({
        next: (result) => {
          if (result.payment.status === 'SUCCESS') {
            // The attempt settled while we were away (webhook won the race).
            this.onPaymentSettled(bookingId, true);
            return;
          }
          const secret = result.paymentIntent?.clientSecret;
          if (!secret) {
            this.onIntentError(bookingId, { status: 0 });
            return;
          }
          this.payOpen.set(true);
          this.pendingClientSecret.set(secret); // the constructor effect mounts the element
        },
        error: (err: unknown) => this.onIntentError(bookingId, err),
      });
  }

  private async mountElement(host: HTMLElement, clientSecret: string): Promise<void> {
    try {
      // Resolves only when the Payment Element reports ready — Pay stays disabled until then.
      await this.paymentService.mountPaymentElement(host, clientSecret);
      this.payState.set('ready');
    } catch (error) {
      this.payState.set('error');
      // Element/Stripe setup failures are NOT payment failures — never say "Payment failed".
      this.paymentNotice.set(
        error instanceof PaymentConfigurationError
          ? 'Online payment is not configured in this environment (missing Stripe publishable key). Please contact support.'
          : 'We couldn’t load the secure payment form. Please close this dialog and try again.',
      );
    }
  }

  /** Dialog confirm: Stripe.js confirms the CURRENT PaymentIntent (3DS included). */
  confirmPayment(): void {
    const b = this.booking();
    if (!b) return;
    if (!this.stripeFlow()) {
      this.confirmPaymentMock(b.id);
      return;
    }
    if (this.payState() !== 'ready') return;
    this.payState.set('confirming');
    this.paymentNotice.set(
      'Confirming your payment… Additional authentication may be required.',
    );
    void this.paymentService.confirmPayment().then((outcome) => {
      if (outcome.kind === 'failed') {
        // Stripe card/validation error: the SAME PaymentIntent continues — no
        // new POST, no new idempotency key; the customer corrects the details.
        this.paymentNotice.set(outcome.message);
        this.payState.set('ready');
        return;
      }
      this.startPolling(b.id);
    });
  }

  /** Mock provider flow (development): the mock backend confirms synchronously. */
  private confirmPaymentMock(bookingId: string): void {
    if (this.payState() !== 'idle') return;
    this.payState.set('confirming');
    this.paymentService
      .tokenize()
      .pipe(
        switchMap((token) =>
          this.paymentService.pay(bookingId, {
            token,
            idempotencyKey: this.idempotencyKey,
          }),
        ),
      )
      .subscribe({
        next: (result) => {
          this.payState.set('idle');
          this.payOpen.set(false);
          // The mock backend confirms synchronously. If the response carries a
          // PaymentIntent or a non-terminal payment, the API is actually running
          // an async provider — never toast success; switch to recovery instead.
          if (result.payment.status !== 'SUCCESS' || result.paymentIntent) {
            this.resumeAvailable.set(true);
            this.paymentInfo.set(
              'A payment is already in progress for this booking. Use “Complete payment” to continue the existing payment attempt.',
            );
            this.load();
            return;
          }
          this.paymentError.set(null);
          this.booking.set(result.booking);
          this.payments.update((list) => [result.payment, ...(list ?? [])]);
          this.toast.success('Payment successful — your booking is confirmed.');
        },
        error: (err: unknown) => {
          this.payState.set('idle');
          this.payOpen.set(false);
          // An in-progress conflict is a RESUMABLE state, never a failure.
          if ((err as { status?: number } | null)?.status === 409) {
            this.resumeAvailable.set(true);
            this.paymentInfo.set(
              'A payment is already in progress for this booking. Use “Complete payment” to continue the existing payment attempt.',
            );
            return;
          }
          this.paymentError.set(this.describePaymentError(err));
        },
      });
  }

  /**
   * Stripe accepted the payment — the webhook is now authoritative. Poll the
   * persisted backend state with bounded backoff; never claim success from the
   * Stripe confirmation alone.
   */
  private startPolling(bookingId: string): void {
    this.payState.set('processing');
    this.paymentNotice.set(
      'Your payment was submitted successfully. We’re confirming your booking…',
    );
    // Realtime push + recovery poll watch the same settlement — whichever
    // learns the committed state first settles the page (all idempotent).
    this.trackPayment(bookingId);
    this.paymentService.pollUntilSettled(bookingId).subscribe((outcome) => {
      if (outcome.kind === 'timeout') {
        // NOT a failure — the webhook may not have arrived yet. The persisted
        // attempt is kept so a later visit can resume/check it, and live
        // tracking (realtime push + bounded recovery poll) keeps watching so
        // the page settles automatically when the backend finalizes.
        this.payState.set('idle');
        this.payOpen.set(false);
        this.paymentService.unmountPaymentElement();
        this.paymentInfo.set(
          'Payment is still being processed. Your payment may still complete — you can safely leave this page and check your booking again.',
        );
        this.trackPayment(bookingId);
        return;
      }
      this.onPaymentSettled(bookingId, outcome.payment.status === 'SUCCESS');
    });
  }

  /**
   * Terminal backend state reached — only now is success shown. Idempotent:
   * duplicate events and stale in-flight responses after settlement are
   * dropped, so a booking is never settled twice.
   */
  private onPaymentSettled(bookingId: string, success: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.stopTracking();
    this.clearAttempt(bookingId);
    this.paymentService.unmountPaymentElement();
    this.payOpen.set(false);
    this.payState.set('idle');
    this.paymentNotice.set(null);
    this.load();
    if (success) {
      this.toast.success('Payment successful — your booking is confirmed.');
    } else {
      this.paymentError.set(
        'Payment could not be completed. Please check your payment details and try again.',
      );
    }
  }

  /**
   * Live status tracking while a payment is pending: realtime push for prompt
   * updates, plus a bounded recovery poll as the safety net for missed events
   * and dropped connections. A push is never trusted on its own — every hint
   * reconciles with the authoritative payments API. Idempotent per booking;
   * terminal states and page teardown stop it via stopTracking().
   */
  private trackPayment(bookingId: string): void {
    if (this.trackingBookingId === bookingId) return;
    this.stopTracking();
    this.trackingBookingId = bookingId;
    const sub = new Subscription();
    sub.add(
      this.realtime.watchBooking(bookingId).subscribe((event) => {
        if (event.kind === 'connected') {
          // After a reconnect, pushed events may have been missed — reconcile
          // with the authoritative API once.
          if (event.reconnected) this.reconcilePaymentStatus(bookingId);
          return;
        }
        // PENDING pushes change nothing material; only terminal hints reconcile.
        if (event.status !== 'PENDING') {
          this.reconcilePaymentStatus(bookingId);
        }
      }),
    );
    sub.add(
      this.paymentService.pollUntilTerminal(bookingId).subscribe((payment) => {
        this.onPaymentSettled(bookingId, payment.status === 'SUCCESS');
      }),
    );
    this.trackingSub = sub;
  }

  private stopTracking(): void {
    this.trackingSub?.unsubscribe();
    this.trackingSub = null;
    this.trackingBookingId = null;
  }

  /**
   * Authoritative status re-fetch after a realtime hint (push/reconnect). The
   * API is the source of truth: only a persisted terminal payment settles the
   * UI — anything else keeps the truthful pending state. Late responses after
   * settlement are dropped so a stale request never overwrites a terminal
   * state.
   */
  private reconcilePaymentStatus(bookingId: string): void {
    if (this.settled) return;
    this.paymentService.getPayments(bookingId).subscribe({
      next: (list) => {
        if (this.settled) return;
        this.payments.set(list);
        const latest = list[0];
        if (latest && (latest.status === 'SUCCESS' || latest.status === 'FAILED')) {
          this.onPaymentSettled(bookingId, latest.status === 'SUCCESS');
        } else {
          this.evaluateResume(bookingId, list);
        }
      },
      // Transient failure: the next push/poll tick retries — never a failure UI.
      error: () => undefined,
    });
  }

  /** Classifies POST /payment failures: terminal (402), in-progress (409), or retryable. */
  private onIntentError(bookingId: string, err: unknown): void {
    const status = (err as { status?: number } | null)?.status;
    this.payState.set('idle');
    this.payOpen.set(false);
    if (status === 402) {
      // Definitive failure — terminal: clear the attempt; the next attempt
      // mints a fresh idempotency key in startPayment().
      this.clearAttempt(bookingId);
      this.paymentError.set(this.describePaymentError(err));
      return;
    }
    if (status === 409) {
      // A payment is already in progress (another tab/device, a lost key, or a
      // resumed open attempt). This is a RECOVERY state — never a failure:
      // offer the resume banner and let polling observe the outcome.
      this.paymentInfo.set(
        'A payment is already in progress for this booking. We’re checking its status — you can continue the existing payment attempt.',
      );
      this.resumeAvailable.set(true);
      this.startPolling(bookingId);
      return;
    }
    // Retryable (network/timeout/5xx): KEEP the key — a retry resumes the same
    // PaymentIntent via the same idempotency key.
    this.paymentInfo.set(
      'The payment service is unavailable right now. Your payment attempt is preserved — you can safely try again.',
    );
    this.resumeAvailable.set(true);
  }

  onPayDialogCancelled(): void {
    // An active Stripe confirmation or webhook wait must not be interrupted.
    if (this.payDialogLocked()) return;
    this.payOpen.set(false);
    this.paymentService.unmountPaymentElement();
    this.payState.set('idle');
    this.paymentNotice.set(null);
    // The persisted attempt is KEPT — the intent is still open and resumable.
  }

  /**
   * Resume detection: an open attempt exists when the booking is PENDING and the
   * latest payment is PENDING. The resume banner is offered whether or not this
   * browser still holds the persisted idempotency key — the backend resumes the
   * open PaymentIntent either way. A terminal state clears the persisted key.
   * While an attempt is open, live tracking watches for its backend settlement.
   */
  private evaluateResume(bookingId: string, list: CustomerPayment[]): void {
    const persisted = this.readPersistedAttempt(bookingId);
    const booking = this.booking();
    const latest = list[0];
    const openAttempt = booking?.status === 'PENDING' && latest?.status === 'PENDING';
    if (!openAttempt) {
      // Terminal or irrelevant — drop any persisted attempt.
      if (persisted) this.clearAttempt(bookingId);
      this.resumeAvailable.set(false);
      this.stopTracking();
      return;
    }
    this.resumeAvailable.set(true);
    this.trackPayment(bookingId);
  }

  private readPersistedAttempt(bookingId: string): PersistedPaymentAttempt | null {
    try {
      const raw = sessionStorage.getItem(paymentAttemptKey(bookingId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedPaymentAttempt;
      return parsed.bookingId === bookingId && parsed.idempotencyKey ? parsed : null;
    } catch {
      return null;
    }
  }

  private persistAttempt(bookingId: string): void {
    sessionStorage.setItem(
      paymentAttemptKey(bookingId),
      JSON.stringify({
        bookingId,
        idempotencyKey: this.idempotencyKey,
      } satisfies PersistedPaymentAttempt),
    );
  }

  private clearAttempt(bookingId: string): void {
    sessionStorage.removeItem(paymentAttemptKey(bookingId));
  }

  // ---------- Cancellation request (CONFIRMED bookings) ----------

  openRequestDialog(): void {
    this.reasonControl.reset();
    this.requestOpen.set(true);
  }

  submitCancellationRequest(): void {
    const b = this.booking();
    if (!b || this.requesting() || this.reasonControl.invalid) return;
    this.requesting.set(true);
    const reason = this.reasonControl.value.trim();
    this.bookingService
      .requestCancellation(b.id, reason === '' ? undefined : reason)
      .subscribe({
        next: (req) => {
          this.requesting.set(false);
          this.requestOpen.set(false);
          // The booking is NOT cancelled — it stays active under review.
          this.booking.update((cur) =>
            cur
              ? {
                  ...cur,
                  cancellationRequest: {
                    id: req.id,
                    status: req.status,
                    requestedAt: req.requestedAt,
                    rejectionReason: null,
                  },
                }
              : cur,
          );
          this.toast.success('Cancellation requested — our team will review it shortly.');
        },
        error: (err: unknown) => {
          this.requesting.set(false);
          this.requestOpen.set(false);
          const status = (err as { status?: number } | null)?.status;
          const code = (err as { error?: { code?: string } } | null)?.error?.code;
          if (status === 409 && code === 'CANCELLATION_REQUEST_PENDING') {
            // A request is already open (another tab/device) — refresh so the
            // pending-review state renders from the server's truth.
            this.toast.info('A cancellation request is already pending review.');
            this.load();
            return;
          }
          const serverMessage = (
            err as { error?: { message?: string | string[] } } | null
          )?.error?.message;
          this.toast.error(
            typeof serverMessage === 'string' && serverMessage.length > 0
              ? serverMessage
              : 'Could not submit the cancellation request. Please try again.',
          );
        },
      });
  }

  // ---------- Cancellation ----------

  confirmCancel(): void {
    const b = this.booking();
    if (!b || this.cancelling()) return;
    this.cancelling.set(true);
    this.bookingService.cancel(b.id).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.booking.set(updated);
        this.preview.set(null); // stale after the transition — cleared until reload
        // The database is authoritative: refresh payments to derive the real
        // refund outcome instead of trusting local state.
        this.paymentService.getPayments(b.id).subscribe({
          next: (list) => {
            this.payments.set(list);
            this.announceCancellation(b, list);
          },
          error: () => this.announceCancellation(b, null),
        });
      },
      error: (err: unknown) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        // The backend is the source of truth for rejection reasons (policy:
        // already cancelled, after departure, …) — surface its message.
        const serverMessage = (
          err as { error?: { message?: string | string[] } } | null
        )?.error?.message;
        this.toast.error(
          typeof serverMessage === 'string' && serverMessage.length > 0
            ? serverMessage
            : 'Could not cancel this booking. Please try again.',
        );
      },
    });
  }

  /**
   * Result message derived from the refreshed, server-persisted state:
   * - PENDING booking → seats released, no money involved;
   * - a PROCESSED refund exists → refund initiated (provider confirmed);
   * - only a PENDING refund exists → refund recorded and being processed
   *   (recoverable; never claim the money has arrived);
   * - otherwise → cancelled under the policy with no refund due.
   */
  private announceCancellation(
    before: CustomerBooking,
    list: CustomerPayment[] | null,
  ): void {
    if (before.status !== 'CONFIRMED') {
      this.toast.success('Booking cancelled. The held seats have been released.');
      return;
    }
    const refunds = (list?.[0]?.refunds ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    const processed = refunds.find((r) => r.status === 'PROCESSED');
    if (processed) {
      this.toast.success(
        `Booking cancelled. Refund of ${this.money(processed.amount, processed.currency)} has been initiated.`,
      );
      return;
    }
    if (refunds.some((r) => r.status === 'PENDING')) {
      this.toast.success(
        'Booking cancelled. Your refund has been initiated and is being processed.',
      );
      return;
    }
    this.toast.success(
      'Booking cancelled. No refund is due under the cancellation policy.',
    );
  }

  // ---------- Presentation ----------

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

  money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  /** BR-16: "Offer: {title} (−amount)" line when a bookable offer was applied. */
  offerSavings(b: CustomerBooking): string | null {
    const o = b.offer;
    if (!o) return null;
    const perPassenger = b.perPassengerDiscountAmount ?? o.discountAmountPerPassenger;
    const total = perPassenger * Math.max(b.passengers.length, 1);
    return `Offer: ${o.title} (−${formatMoney(total, o.currency)})`;
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
