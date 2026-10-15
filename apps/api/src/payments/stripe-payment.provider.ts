import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { toSmallestUnit } from './money.js';
import { ProviderDefinitiveError } from './payment-provider.js';
import type {
  ChargeResult,
  CreatePaymentIntentRequest,
  PaymentIntentProvider,
  PaymentIntentSnapshot,
  PaymentIntentStatus,
  ProviderRefundLookup,
  ProviderRefundRequest,
  ProviderRefundResult,
  ProviderWebhookEvent,
} from './payment-provider.js';

export interface StripeProviderConfig {
  secretKey: string;
  webhookSecret: string;
}

/**
 * Stripe PaymentIntent provider (PAYMENT_PROVIDER=stripe).
 *
 * All Stripe SDK types are mapped to domain-safe types at this boundary —
 * nothing upstream imports from 'stripe'.
 *
 * Idempotency: PaymentIntent creation, cancellation and refunds all pass a
 * caller-supplied provider idempotency key through to Stripe, so retries of
 * the same logical operation can never create duplicates at the provider.
 *
 * Card data never touches this service: the PaymentIntent is created with
 * automatic payment methods (Stripe.js / Payment Element collects card data
 * client-side) and redirects are disabled — 3DS runs in the Stripe modal.
 */
@Injectable()
export class StripePaymentProvider implements PaymentIntentProvider {
  readonly name = 'stripe';
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: StripeProviderConfig) {
    if (!config.secretKey?.trim()) {
      throw new Error(
        'PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY — refusing to start without it',
      );
    }
    if (!config.webhookSecret?.trim()) {
      throw new Error(
        'PAYMENT_PROVIDER=stripe requires STRIPE_WEBHOOK_SECRET — refusing to start without it',
      );
    }
    this.stripe = new Stripe(config.secretKey);
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Part of the shared PaymentProvider abstraction (mock sync flow). Stripe
   * mode never calls it — PaymentsService dispatches on provider capability.
   */
  async charge(): Promise<ChargeResult> {
    throw new Error(
      'Stripe provider does not support synchronous charges — use the PaymentIntent flow',
    );
  }

  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentSnapshot> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: request.amountCents,
        currency: request.currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          paymentId: request.paymentId,
          bookingReference: request.bookingReference,
        },
      },
      { idempotencyKey: request.idempotencyKey },
    );
    return this.toSnapshot(intent);
  }

  async retrievePaymentIntent(
    providerReference: string,
  ): Promise<PaymentIntentSnapshot> {
    const intent = await this.stripe.paymentIntents.retrieve(providerReference);
    return this.toSnapshot(intent);
  }

  async cancelPaymentIntent(
    providerReference: string,
  ): Promise<PaymentIntentSnapshot> {
    const intent = await this.stripe.paymentIntents.cancel(
      providerReference,
      {},
      { idempotencyKey: `cancel-${providerReference}` },
    );
    return this.toSnapshot(intent);
  }

  async refund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: request.paymentProviderReference,
          amount: toSmallestUnit(request.amount, request.currency),
          // Self-describing metadata (Phase 3.4E): a later provider-side lookup
          // can strongly match this refund back to its local Refund row.
          ...(request.metadataRefundId
            ? { metadata: { refundId: request.metadataRefundId } }
            : {}),
        },
        request.idempotencyKey
          ? { idempotencyKey: request.idempotencyKey }
          : undefined,
      );
      return { providerReference: refund.id };
    } catch (error) {
      // Classification boundary (Batch 3.4A): ONLY an invalid_request business
      // rejection is definitive — it is safe to mark the refund REJECTED.
      // Timeouts, connection resets, 5xx and everything else stay AMBIGUOUS:
      // the refund may already exist at Stripe and must remain recoverable.
      if ((error as { type?: string } | null)?.type === 'StripeInvalidRequestError') {
        throw new ProviderDefinitiveError(
          `Stripe definitively rejected the refund: ${(error as Error).message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Bounded read-only refund lookup for orphan discovery (Phase 3.4E): lists
   * refunds of ONE known PaymentIntent (capped at a single page of 100 — a
   * payment with more refunds is pathological and still fully covered by the
   * idempotency-key replay path). Never a Stripe-wide search, never a mutation.
   */
  async listRefundsForPayment(
    paymentProviderReference: string,
  ): Promise<ProviderRefundLookup[]> {
    const refunds = await this.stripe.refunds.list({
      payment_intent: paymentProviderReference,
      limit: 100,
    });
    return refunds.data.map((refund) => ({
      providerReference: refund.id,
      amountCents: refund.amount,
      currency: refund.currency.toUpperCase(),
      metadataRefundId:
        typeof refund.metadata?.['refundId'] === 'string'
          ? refund.metadata['refundId']
          : null,
    }));
  }

  /**
   * Verifies the Stripe signature against the EXACT raw request bytes and
   * returns the verified event. Throws StripeSignatureVerificationError on any
   * mismatch — callers must reject the request without trusting the payload.
   * Stripe's default timestamp tolerance (300s) provides replay protection.
   */
  constructWebhookEvent(
    rawBody: Buffer,
    signatureHeader: string,
  ): ProviderWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      this.webhookSecret,
    );
    if (!event.type.startsWith('payment_intent.')) {
      return { eventId: event.id, eventType: event.type };
    }
    const intent = event.data.object as Stripe.PaymentIntent;
    return {
      eventId: event.id,
      eventType: event.type,
      intent: {
        ...this.toSnapshot(intent),
        paymentId:
          typeof intent.metadata?.['paymentId'] === 'string'
            ? intent.metadata['paymentId']
            : null,
      },
    };
  }

  private toSnapshot(intent: Stripe.PaymentIntent): PaymentIntentSnapshot {
    return {
      providerReference: intent.id,
      status: this.mapStatus(intent.status),
      clientSecret: intent.client_secret ?? null,
      amountCents: intent.amount,
      currency: intent.currency.toUpperCase(),
    };
  }

  private mapStatus(status: Stripe.PaymentIntent.Status): PaymentIntentStatus {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'processing':
      case 'succeeded':
      case 'canceled':
        return status;
      default:
        // requires_capture (manual capture) is not used by this integration;
        // any genuinely new Stripe status must fail loudly, never be misread.
        throw new Error(`Unsupported Stripe PaymentIntent status: ${status}`);
    }
  }
}
