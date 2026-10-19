import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  concatMap,
  filter,
  interval,
  last,
  map,
  of,
  take,
  takeWhile,
  timer,
} from 'rxjs';
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
} from '@stripe/stripe-js';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type {
  CustomerPayment,
  PayBookingPayload,
  PayBookingResult,
} from '../../../core/models/payment.model';

/**
 * Outcome of stripe.confirmPayment. 'failed' covers Stripe card/validation
 * errors — NON-terminal for the attempt: the Payment Element stays mounted,
 * the same PaymentIntent continues, and the customer corrects the details.
 * Only the backend (402 / webhook) marks an attempt terminally failed.
 */
export type ConfirmOutcome =
  | { kind: 'confirmed' } // Stripe accepted the payment; the webhook finalizes
  | { kind: 'processing' } // asynchronous handling; keep polling the backend
  | { kind: 'failed'; message: string };

export type PollOutcome =
  | { kind: 'settled'; payment: CustomerPayment }
  | { kind: 'timeout' };

/**
 * The publishable key is missing/misconfigured — an environment problem, NOT
 * a payment failure and NOT a Stripe outage. The UI must say so explicitly.
 */
export class PaymentConfigurationError extends Error {}

/** Safety net if Stripe's iframe never reports ready (e.g. offline). */
const ELEMENT_READY_TIMEOUT_MS = 15_000;

/** Bounded backoff (~16s total) — polling never runs forever. */
const POLL_DELAYS_MS = [1000, 2000, 2000, 3000, 3000, 5000];

/**
 * Slow recovery poll while a payment is pending: covers missed realtime
 * events and disconnected clients. Bounded (15s × 40 ≈ 10 minutes), skips
 * failed requests, and completes once a terminal state is observed.
 */
const RECOVERY_POLL_INTERVAL_MS = 15_000;
const RECOVERY_POLL_MAX_ATTEMPTS = 40;

const isTerminal = (p: CustomerPayment | undefined): boolean =>
  !!p && (p.status === 'SUCCESS' || p.status === 'FAILED');

/**
 * Customer payments: backend HTTP + the Stripe.js browser integration.
 *
 * Card data is collected exclusively by the Stripe Payment Element — it never
 * touches this application or the NovaAir API. Only the publishable key is
 * used; the clientSecret is held in memory only (never logged, never
 * persisted). HTTP 200 from pay() means "PaymentIntent created/retrieved" —
 * the webhook-driven backend state is the only success signal.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: StripePaymentElement | null = null;

  get providerMode(): 'stripe' | 'mock' {
    return this.config.paymentProvider;
  }

  /** POST /bookings/:id/payment — creates or RESUMES the PaymentIntent for the given idempotency key. */
  pay(bookingId: string, payload: PayBookingPayload): Observable<PayBookingResult> {
    return this.http.post<PayBookingResult>(
      `${this.config.baseUrl}/bookings/${bookingId}/payment`,
      payload,
    );
  }

  /** GET /bookings/:id/payments — the read-only payment status source (newest first). */
  getPayments(bookingId: string): Observable<CustomerPayment[]> {
    return this.http.get<CustomerPayment[]>(
      `${this.config.baseUrl}/bookings/${bookingId}/payments`,
    );
  }

  /**
   * POST /bookings/:id/payment/reconcile — owner-scoped, server-side
   * retrieve-and-settle of the EXISTING open PaymentIntent (webhook
   * delayed/lost recovery). Never creates a charge/intent; returns the
   * authoritative payment list after reconciliation.
   */
  reconcilePendingPayment(bookingId: string): Observable<CustomerPayment[]> {
    return this.http.post<CustomerPayment[]>(
      `${this.config.baseUrl}/bookings/${bookingId}/payment/reconcile`,
      {},
    );
  }

  /**
   * MOCK MODE ONLY (paymentProvider === 'mock'): fabricates the tok_…
   * reference the mock backend accepts. Never called in Stripe mode.
   */
  tokenize(): Observable<string> {
    return of(`tok_${crypto.randomUUID().replaceAll('-', '')}`);
  }

  /** Lazily loads Stripe.js exactly once. */
  private async ensureStripe(): Promise<Stripe> {
    if (this.stripe) return this.stripe;
    if (!this.config.stripePublishableKey) {
      throw new PaymentConfigurationError(
        'Stripe publishable key is not configured (stripePublishableKey)',
      );
    }
    const stripe = await loadStripe(this.config.stripePublishableKey);
    if (!stripe) {
      throw new Error('Stripe.js could not be loaded');
    }
    this.stripe = stripe;
    return stripe;
  }

  /**
   * Mounts a fresh Payment Element for the given clientSecret into the
   * container. Resolves only when Stripe reports the element READY for input
   * (or rejects on the bounded ready-timeout) — callers must not enable the
   * payment action before that point.
   */
  async mountPaymentElement(container: HTMLElement, clientSecret: string): Promise<void> {
    const stripe = await this.ensureStripe();
    this.unmountPaymentElement();
    this.elements = stripe.elements({ clientSecret });
    // Accordion with the first (Card) method expanded: card fields are visible
    // immediately — no extra click, and the form stays recognizable/trustworthy.
    this.paymentElement = this.elements.create('payment', {
      layout: { type: 'accordion', defaultCollapsed: false },
    });
    const element = this.paymentElement;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Payment Element did not become ready in time')),
        ELEMENT_READY_TIMEOUT_MS,
      );
      element.on('ready', () => {
        clearTimeout(timer);
        resolve();
      });
      element.mount(container);
    });
  }

  /**
   * Confirms the CURRENT PaymentIntent via Stripe.js — 3DS runs in Stripe's
   * own modal (redirect: 'if_required' keeps card flows on this page). Never
   * creates a new PaymentIntent: the backend POST already did that.
   */
  async confirmPayment(): Promise<ConfirmOutcome> {
    const stripe = await this.ensureStripe();
    if (!this.elements) {
      return { kind: 'failed', message: 'The payment form is not ready yet. Please wait a moment and try again.' };
    }
    const result = await stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });
    if (result.error) {
      return {
        kind: 'failed',
        message:
          result.error.message ??
          'Payment was declined. Please check your payment details and try again.',
      };
    }
    return result.paymentIntent?.status === 'succeeded'
      ? { kind: 'confirmed' }
      : { kind: 'processing' };
  }

  /** Releases Stripe Elements when the dialog closes (safe to call repeatedly). */
  unmountPaymentElement(): void {
    try {
      this.paymentElement?.unmount();
      this.paymentElement?.destroy();
    } catch {
      /* already detached */
    }
    this.paymentElement = null;
    this.elements = null;
  }

  /**
   * Bounded polling of the read-only payments endpoint after Stripe
   * confirmation. The webhook is authoritative — a failed poll is skipped,
   * not fatal, and a timeout is reported as "still processing", never as a
   * failure.
   */
  pollUntilSettled(bookingId: string): Observable<PollOutcome> {
    return of(...POLL_DELAYS_MS).pipe(
      concatMap((ms) =>
        timer(ms).pipe(
          concatMap(() =>
            this.getPayments(bookingId).pipe(catchError(() => of([] as CustomerPayment[]))),
          ),
        ),
      ),
      takeWhile((list) => !isTerminal(list[0]), true),
      last(),
      map((list): PollOutcome => {
        const latest = list[0];
        return latest && isTerminal(latest)
          ? { kind: 'settled', payment: latest }
          : { kind: 'timeout' };
      }),
    );
  }

  /**
   * Bounded recovery polling while a payment is pending — the safety net for
   * missed realtime events and a delayed/lost webhook. Each tick first asks the
   * backend to reconcile the existing open intent with the provider
   * (server-side, ownership-checked, never a new charge), then reads the
   * authoritative list — concatMap keeps ticks sequential, so reconciliation
   * requests never overlap. Emits at most once (the first terminally-settled
   * payment), then completes; completes silently after the attempt budget is
   * exhausted. A failed reconcile/read is skipped, never reported as a payment
   * failure. Unsubscribing stops it immediately.
   */
  pollUntilTerminal(bookingId: string): Observable<CustomerPayment> {
    return interval(RECOVERY_POLL_INTERVAL_MS).pipe(
      concatMap(() =>
        this.reconcilePendingPayment(bookingId).pipe(
          // Reconcile is best-effort (provider timeout/unavailable): fall back
          // to the plain read — a failed trigger is never a payment failure.
          catchError(() =>
            this.getPayments(bookingId).pipe(catchError(() => of([] as CustomerPayment[]))),
          ),
        ),
      ),
      take(RECOVERY_POLL_MAX_ATTEMPTS),
      map((list) => list[0]),
      filter((p): p is CustomerPayment => isTerminal(p)),
      take(1),
    );
  }
}
