/**
 * Provider-agnostic payment abstraction.
 *
 * Business logic (PaymentsService / PaymentWebhookService) depends only on
 * these interfaces, selected via the PAYMENT_PROVIDER environment convention
 * (default: 'mock'). Stripe-specific types never leak past the provider
 * implementation.
 *
 * Two provider capabilities exist:
 * - PaymentProvider: the original synchronous charge/refund contract used by
 *   the deterministic mock provider (development and unit tests).
 * - PaymentIntentProvider: the asynchronous PaymentIntent contract used by
 *   Stripe — intent creation/retrieval/cancellation, refunds, and webhook
 *   event construction with signature verification. The synchronous charge
 *   response is never the final payment truth in this mode; provider webhook
 *   events are authoritative.
 *
 * Security: providers never receive raw card data (FR-C13 / NFR-01). Card
 * collection happens exclusively in Stripe-hosted client components.
 */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

/**
 * Thrown by a provider when the operation was DEFINITIVELY rejected — a known,
 * non-retryable business rejection (e.g. Stripe invalid_request: charge
 * already fully refunded, no such charge). This is the ONLY error class a
 * caller may treat as terminal/REJECTED. Every other failure (timeout,
 * connection reset, 5xx, unknown) is AMBIGUOUS: the provider may already have
 * processed the operation, so it must stay recoverable — never be rejected.
 */
export class ProviderDefinitiveError extends Error {}

export interface ChargeRequest {
  /** Server-computed booking total — never client-supplied. */
  amount: number;
  currency: string;
  /** Tokenized payment reference issued by the provider SDK (never a PAN). */
  token: string;
  /** Client-generated key; the provider deduplicates retries with it. */
  idempotencyKey: string;
  bookingReference: string;
}

export type ChargeResult =
  | { outcome: 'success'; providerReference: string }
  | { outcome: 'failed'; failureReason: string };

export interface ProviderRefundRequest {
  amount: number;
  currency: string;
  /** Provider reference of the original successful charge. */
  paymentProviderReference: string;
  /**
   * Provider idempotency key for the refund call — stable per persisted Refund
   * row, so a retried refund can never move money twice at the provider.
   */
  idempotencyKey?: string;
  /**
   * The persisted Refund row id, written into provider metadata when supported
   * (Phase 3.4E): a provider-side refund lookup can then strongly match the
   * refund back to its local row instead of guessing by amount/timestamp.
   */
  metadataRefundId?: string;
}

export interface ProviderRefundResult {
  providerReference: string;
}

/**
 * One provider-side refund as returned by a bounded lookup scoped to a single
 * payment (Phase 3.4E orphan discovery). `metadataRefundId` is the local
 * Refund row id IF the refund was created with metadata support — the only
 * strong automatic match; everything else must be treated as unmatched.
 */
export interface ProviderRefundLookup {
  providerReference: string;
  amountCents: number;
  currency: string;
  metadataRefundId: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: ProviderRefundRequest): Promise<ProviderRefundResult>;
  /**
   * Bounded, read-only listing of the provider-side refunds for ONE known
   * payment reference (never a provider-wide search). Used exclusively by
   * refund orphan discovery; must never create or mutate anything.
   */
  listRefundsForPayment(
    paymentProviderReference: string,
  ): Promise<ProviderRefundLookup[]>;
}

// ---------- PaymentIntent (asynchronous) ----------

/** Stripe PaymentIntent statuses relevant to this integration (manual capture is not used). */
export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled';

export interface CreatePaymentIntentRequest {
  /** Server-derived integer smallest-unit amount (see money.ts). */
  amountCents: number;
  /** ISO 4217 currency; normalized by the provider. */
  currency: string;
  /**
   * Provider idempotency key, stable per logical payment attempt (the persisted
   * Payment row id). Retries of the same attempt reuse it, so the provider can
   * never create two intents for one logical payment.
   */
  idempotencyKey: string;
  bookingReference: string;
  /** Internal Payment id — echoed back in webhook metadata for reconciliation. */
  paymentId: string;
}

/** Domain-safe snapshot of a provider PaymentIntent — no Stripe SDK types. */
export interface PaymentIntentSnapshot {
  /** Provider reference of the intent (Stripe `pi_…`). */
  providerReference: string;
  status: PaymentIntentStatus;
  /** Client secret for Stripe.js confirmation; only safe to expose to the booking owner. */
  clientSecret: string | null;
  amountCents: number;
  currency: string;
}

/** Verified, deduplication-ready webhook delivery — constructed only after signature verification. */
export interface ProviderWebhookEvent {
  eventId: string;
  eventType: string;
  /** Present for payment_intent.* events; absent for unrelated event types. */
  intent?: PaymentIntentSnapshot & { paymentId: string | null };
}

export interface PaymentIntentProvider extends PaymentProvider {
  createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentSnapshot>;
  retrievePaymentIntent(
    providerReference: string,
  ): Promise<PaymentIntentSnapshot>;
  cancelPaymentIntent(
    providerReference: string,
  ): Promise<PaymentIntentSnapshot>;
  /**
   * Verifies the webhook signature against the EXACT raw request bytes and
   * returns the verified event. Throws when the signature is invalid — the
   * caller must not trust any part of an unverified payload.
   */
  constructWebhookEvent(
    rawBody: Buffer,
    signatureHeader: string,
  ): ProviderWebhookEvent;
}

/** Capability guard: the mock provider is charge-only; Stripe supports PaymentIntents. */
export function isPaymentIntentProvider(
  provider: PaymentProvider,
): provider is PaymentIntentProvider {
  return (
    typeof (provider as Partial<PaymentIntentProvider>).createPaymentIntent ===
    'function'
  );
}
