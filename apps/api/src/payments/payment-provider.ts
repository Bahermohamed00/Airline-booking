/**
 * Provider-agnostic payment abstraction.
 *
 * Business logic (PaymentsService) depends only on this interface, selected via
 * the PAYMENT_PROVIDER environment convention (default: 'mock'). A real PCI
 * DSS–compliant provider (Stripe/Adyen/…) can be added later by implementing
 * this interface — no booking/payment business logic changes required.
 *
 * Security: providers receive a tokenized payment reference (`tok_…`), never
 * raw card data (FR-C13 / NFR-01).
 */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

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
}

export interface ProviderRefundResult {
  providerReference: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: ProviderRefundRequest): Promise<ProviderRefundResult>;
}
