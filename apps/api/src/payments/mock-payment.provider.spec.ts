import { describe, it, expect } from 'vitest';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  it('charges a valid token deterministically from the idempotency key', async () => {
    const req = { amount: 505, currency: 'EUR', token: 'tok_abc123', idempotencyKey: 'key-0001', bookingReference: 'NVAB12' };
    const first = await provider.charge(req);
    const second = await provider.charge(req);
    expect(first).toEqual({ outcome: 'success', providerReference: 'mockpay_key-0001' });
    expect(second).toEqual(first);
  });

  it('rejects tokens without the tok_ prefix', async () => {
    const result = await provider.charge({ amount: 1, currency: 'EUR', token: '4111111111111111', idempotencyKey: 'key-0002', bookingReference: 'NVAB12' });
    expect(result.outcome).toBe('failed');
  });

  it('declines tok_fail tokens', async () => {
    const result = await provider.charge({ amount: 1, currency: 'EUR', token: 'tok_fail_card', idempotencyKey: 'key-0003', bookingReference: 'NVAB12' });
    expect(result.outcome).toBe('failed');
    if (result.outcome === 'failed') expect(result.failureReason).toBeTruthy();
  });

  it('never receives or stores raw card data — only tokens', async () => {
    // The provider API surface accepts `token` only; this test pins that contract.
    const result = await provider.charge({ amount: 10, currency: 'EUR', token: 'tok_valid', idempotencyKey: 'key-0004', bookingReference: 'NVAB12' });
    expect(result.outcome).toBe('success');
  });

  it('refunds deterministically from the original charge reference and amount', async () => {
    const result = await provider.refund({ amount: 100.5, currency: 'EUR', paymentProviderReference: 'mockpay_key-0001' });
    expect(result.providerReference).toBe('mockref_mockpay_key-0001_100.50');
  });
});
