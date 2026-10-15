import { describe, it, expect, beforeEach, vi } from 'vitest';

const stripeInstance = {
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
    cancel: vi.fn(),
  },
  refunds: { create: vi.fn(), list: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
};

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => stripeInstance),
}));

import { StripePaymentProvider } from './stripe-payment.provider';
import { ProviderDefinitiveError } from './payment-provider';

const config = { secretKey: 'sk_test_123', webhookSecret: 'whsec_123' };

const intentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'pi_3abc',
  status: 'requires_payment_method',
  client_secret: 'pi_3abc_secret_xyz',
  amount: 50500,
  currency: 'eur',
  metadata: { paymentId: 'payment-1', bookingReference: 'NVAB12' },
  ...overrides,
});

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new StripePaymentProvider(config);
  });

  describe('configuration', () => {
    it('refuses to initialize without a secret key', () => {
      expect(
        () => new StripePaymentProvider({ secretKey: '', webhookSecret: 'w' }),
      ).toThrow(/STRIPE_SECRET_KEY/);
    });

    it('refuses to initialize without a webhook secret', () => {
      expect(
        () => new StripePaymentProvider({ secretKey: 'k', webhookSecret: '' }),
      ).toThrow(/STRIPE_WEBHOOK_SECRET/);
    });
  });

  describe('createPaymentIntent', () => {
    it('creates the intent with the exact server-derived amount, currency, metadata and idempotency key', async () => {
      stripeInstance.paymentIntents.create.mockResolvedValue(intentFixture());

      const snapshot = await provider.createPaymentIntent({
        amountCents: 50500,
        currency: 'EUR',
        idempotencyKey: 'payment-1',
        bookingReference: 'NVAB12',
        paymentId: 'payment-1',
      });

      expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        {
          amount: 50500,
          currency: 'eur',
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          metadata: { paymentId: 'payment-1', bookingReference: 'NVAB12' },
        },
        { idempotencyKey: 'payment-1' },
      );
      expect(snapshot).toEqual({
        providerReference: 'pi_3abc',
        status: 'requires_payment_method',
        clientSecret: 'pi_3abc_secret_xyz',
        amountCents: 50500,
        currency: 'EUR',
      });
    });

    it('maps requires_action (3DS) faithfully — never as success', async () => {
      stripeInstance.paymentIntents.create.mockResolvedValue(
        intentFixture({ status: 'requires_action' }),
      );
      const snapshot = await provider.createPaymentIntent({
        amountCents: 100,
        currency: 'EUR',
        idempotencyKey: 'k',
        bookingReference: 'NVAB12',
        paymentId: 'payment-1',
      });
      expect(snapshot.status).toBe('requires_action');
    });

    it('propagates Stripe API errors', async () => {
      stripeInstance.paymentIntents.create.mockRejectedValue(
        new Error('card config error'),
      );
      await expect(
        provider.createPaymentIntent({
          amountCents: 100,
          currency: 'EUR',
          idempotencyKey: 'k',
          bookingReference: 'NVAB12',
          paymentId: 'payment-1',
        }),
      ).rejects.toThrow('card config error');
    });
  });

  describe('retrievePaymentIntent', () => {
    it('maps a succeeded intent', async () => {
      stripeInstance.paymentIntents.retrieve.mockResolvedValue(
        intentFixture({ status: 'succeeded' }),
      );
      const snapshot = await provider.retrievePaymentIntent('pi_3abc');
      expect(stripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith(
        'pi_3abc',
      );
      expect(snapshot.status).toBe('succeeded');
      expect(snapshot.providerReference).toBe('pi_3abc');
    });

    it('fails loudly on unsupported statuses (e.g. requires_capture)', async () => {
      stripeInstance.paymentIntents.retrieve.mockResolvedValue(
        intentFixture({ status: 'requires_capture' }),
      );
      await expect(
        provider.retrievePaymentIntent('pi_3abc'),
      ).rejects.toThrow(/requires_capture/);
    });
  });

  describe('cancelPaymentIntent', () => {
    it('cancels with a deterministic idempotency key', async () => {
      stripeInstance.paymentIntents.cancel.mockResolvedValue(
        intentFixture({ status: 'canceled', client_secret: null }),
      );
      const snapshot = await provider.cancelPaymentIntent('pi_3abc');
      expect(stripeInstance.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_3abc',
        {},
        { idempotencyKey: 'cancel-pi_3abc' },
      );
      expect(snapshot.status).toBe('canceled');
    });
  });

  describe('refund', () => {
    it('creates a refund in cents against the original PaymentIntent with the caller idempotency key', async () => {
      stripeInstance.refunds.create.mockResolvedValue({ id: 're_123' });
      const result = await provider.refund({
        amount: 454.5,
        currency: 'EUR',
        paymentProviderReference: 'pi_3abc',
        idempotencyKey: 'refund-refund-1',
      });
      expect(stripeInstance.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_3abc', amount: 45450 },
        { idempotencyKey: 'refund-refund-1' },
      );
      expect(result).toEqual({ providerReference: 're_123' });
    });

    it('converts two-decimal amounts without floating-point drift', async () => {
      stripeInstance.refunds.create.mockResolvedValue({ id: 're_1' });
      await provider.refund({
        amount: 19.99,
        currency: 'EUR',
        paymentProviderReference: 'pi_3abc',
        idempotencyKey: 'r1',
      });
      expect(stripeInstance.refunds.create.mock.calls[0]![0].amount).toBe(1999);
    });

    it('classifies a Stripe invalid_request rejection as DEFINITIVE (Batch 3.4A)', async () => {
      stripeInstance.refunds.create.mockRejectedValue(
        Object.assign(new Error('Charge pi_3abc has already been fully refunded'), {
          type: 'StripeInvalidRequestError',
        }),
      );
      await expect(
        provider.refund({
          amount: 100,
          currency: 'EUR',
          paymentProviderReference: 'pi_3abc',
          idempotencyKey: 'r1',
        }),
      ).rejects.toBeInstanceOf(ProviderDefinitiveError);
    });

    it.each([
      ['API 5xx', { type: 'StripeAPIError' }],
      ['connection reset', { type: 'StripeConnectionError' }],
      ['rate limit', { type: 'StripeRateLimitError' }],
      ['unknown transport error', {}],
    ])(
      'keeps an ambiguous outcome recoverable: %s propagates unchanged — never definitive',
      async (_label, shape) => {
        const transport = Object.assign(new Error('request lost'), shape);
        stripeInstance.refunds.create.mockRejectedValue(transport);
        const failure = await provider
          .refund({
            amount: 100,
            currency: 'EUR',
            paymentProviderReference: 'pi_3abc',
            idempotencyKey: 'r1',
          })
          .catch((error: unknown) => error);
        expect(failure).toBe(transport);
        expect(failure).not.toBeInstanceOf(ProviderDefinitiveError);
      },
    );
    it('writes the local refund id into Stripe metadata for strong orphan matching (3.4E)', async () => {
      stripeInstance.refunds.create.mockResolvedValue({ id: 're_123' });
      await provider.refund({
        amount: 100,
        currency: 'EUR',
        paymentProviderReference: 'pi_3abc',
        idempotencyKey: 'refund-refund-1',
        metadataRefundId: 'refund-1',
      });
      expect(stripeInstance.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_3abc',
          amount: 10000,
          metadata: { refundId: 'refund-1' },
        },
        { idempotencyKey: 'refund-refund-1' },
      );
    });

    it('omits metadata entirely when no local refund id is provided', async () => {
      stripeInstance.refunds.create.mockResolvedValue({ id: 're_1' });
      await provider.refund({
        amount: 100,
        currency: 'EUR',
        paymentProviderReference: 'pi_3abc',
      });
      expect(stripeInstance.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_3abc', amount: 10000 },
        undefined,
      );
    });
  });

  describe('listRefundsForPayment (orphan discovery, 3.4E)', () => {
    it('lists refunds scoped to one PaymentIntent, bounded, mapped with metadata identity', async () => {
      stripeInstance.refunds.list.mockResolvedValue({
        data: [
          { id: 're_1', amount: 10000, currency: 'eur', metadata: { refundId: 'refund-1' } },
          { id: 're_2', amount: 45450, currency: 'eur', metadata: {} },
          { id: 're_3', amount: 5000, currency: 'eur', metadata: null },
        ],
      });

      const result = await provider.listRefundsForPayment('pi_3abc');

      expect(stripeInstance.refunds.list).toHaveBeenCalledWith({
        payment_intent: 'pi_3abc',
        limit: 100,
      });
      expect(result).toEqual([
        {
          providerReference: 're_1',
          amountCents: 10000,
          currency: 'EUR',
          metadataRefundId: 'refund-1',
        },
        {
          providerReference: 're_2',
          amountCents: 45450,
          currency: 'EUR',
          metadataRefundId: null,
        },
        {
          providerReference: 're_3',
          amountCents: 5000,
          currency: 'EUR',
          metadataRefundId: null,
        },
      ]);
    });

    it('propagates provider errors to the caller (per-record isolation upstream)', async () => {
      stripeInstance.refunds.list.mockRejectedValue(new Error('stripe timeout'));
      await expect(provider.listRefundsForPayment('pi_3abc')).rejects.toThrow(
        'stripe timeout',
      );
    });
  });

  describe('constructWebhookEvent', () => {
    it('verifies against the exact raw bytes, signature header and webhook secret', () => {
      const raw = Buffer.from('{"id":"evt_1"}');
      stripeInstance.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: intentFixture({ status: 'succeeded' }) },
      });

      const event = provider.constructWebhookEvent(raw, 'sig-header');

      expect(stripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        raw,
        'sig-header',
        'whsec_123',
      );
      expect(event).toEqual({
        eventId: 'evt_1',
        eventType: 'payment_intent.succeeded',
        intent: {
          providerReference: 'pi_3abc',
          status: 'succeeded',
          clientSecret: 'pi_3abc_secret_xyz',
          amountCents: 50500,
          currency: 'EUR',
          paymentId: 'payment-1',
        },
      });
    });

    it('returns no intent for unrelated event types', () => {
      stripeInstance.webhooks.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'charge.refunded',
        data: { object: {} },
      });
      const event = provider.constructWebhookEvent(Buffer.from('{}'), 'sig');
      expect(event.intent).toBeUndefined();
    });

    it('propagates signature verification failures', () => {
      stripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });
      expect(() =>
        provider.constructWebhookEvent(Buffer.from('{}'), 'bad-sig'),
      ).toThrow(/signature/i);
    });

    it('maps missing metadata paymentId to null', () => {
      stripeInstance.webhooks.constructEvent.mockReturnValue({
        id: 'evt_3',
        type: 'payment_intent.payment_failed',
        data: {
          object: intentFixture({ status: 'requires_payment_method', metadata: {} }),
        },
      });
      const event = provider.constructWebhookEvent(Buffer.from('{}'), 'sig');
      expect(event.intent?.paymentId).toBeNull();
    });
  });

  describe('charge', () => {
    it('rejects the synchronous charge contract — PaymentIntent mode only', async () => {
      await expect(provider.charge()).rejects.toThrow(/PaymentIntent/);
    });
  });
});
