import { Injectable } from '@nestjs/common';
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  ProviderRefundRequest,
  ProviderRefundResult,
} from './payment-provider.js';

/**
 * Deterministic in-memory payment provider for development and automated tests
 * (`PAYMENT_PROVIDER=mock`).
 *
 * Rules (no randomness, no state — safe to call repeatedly):
 * - tokens shaped `tok_…` are accepted; anything else is rejected;
 * - tokens starting with `tok_fail` simulate a provider decline;
 * - the charge reference is derived from the idempotency key, so a retried
 *   request with the same key always yields the same reference (the provider
 *   side of idempotency);
 * - refunds always succeed and derive their reference from the original
 *   charge reference and amount.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (!request.token.startsWith('tok_')) {
      return { outcome: 'failed', failureReason: 'Payment token was rejected by the provider' };
    }
    if (request.token.startsWith('tok_fail')) {
      return { outcome: 'failed', failureReason: 'Payment method was declined by the provider' };
    }
    return { outcome: 'success', providerReference: `mockpay_${request.idempotencyKey}` };
  }

  async refund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
    return {
      providerReference: `mockref_${request.paymentProviderReference}_${request.amount.toFixed(2)}`,
    };
  }
}
