import { describe, it, expect } from 'vitest';
import { fromCents, refundPolicyFromFareRules, resolveRefundPolicy, toCents } from './refund-policy';

describe('resolveRefundPolicy', () => {
  it('returns null when the snapshot or policy is missing (not configured)', () => {
    expect(resolveRefundPolicy(null)).toBeNull();
    expect(resolveRefundPolicy({})).toBeNull();
    expect(resolveRefundPolicy({ cabinClass: 'ECONOMY' })).toBeNull();
    expect(resolveRefundPolicy({ refundPolicy: null })).toBeNull();
  });

  it('returns null for an invalid policy shape', () => {
    expect(resolveRefundPolicy({ refundPolicy: { cancellationFeePercent: 10 } })).toBeNull();
    expect(resolveRefundPolicy({ refundPolicy: 'refundable' })).toBeNull();
  });

  it('reads a configured refundable policy', () => {
    expect(resolveRefundPolicy({ refundPolicy: { refundable: true, cancellationFeePercent: 10 } })).toEqual({
      refundable: true,
      cancellationFeePercent: 10,
    });
  });

  it('reads a configured non-refundable policy', () => {
    expect(resolveRefundPolicy({ refundPolicy: { refundable: false, cancellationFeePercent: 100 } })).toEqual({
      refundable: false,
      cancellationFeePercent: 100,
    });
  });

  it('clamps out-of-range fee percentages and defaults the fee when absent', () => {
    expect(resolveRefundPolicy({ refundPolicy: { refundable: true, cancellationFeePercent: 140 } })).toEqual({
      refundable: true,
      cancellationFeePercent: 100,
    });
    expect(resolveRefundPolicy({ refundPolicy: { refundable: true } })).toEqual({ refundable: true, cancellationFeePercent: 0 });
    expect(resolveRefundPolicy({ refundPolicy: { refundable: false } })).toEqual({ refundable: false, cancellationFeePercent: 100 });
  });
});

describe('refundPolicyFromFareRules', () => {
  it('returns null when fare rules are not configured', () => {
    expect(refundPolicyFromFareRules(null)).toBeNull();
    expect(refundPolicyFromFareRules({})).toBeNull();
  });

  it('maps configured fare rules', () => {
    expect(refundPolicyFromFareRules({ refundable: true, cancellationFeePercent: 25 })).toEqual({
      refundable: true,
      cancellationFeePercent: 25,
    });
  });
});

describe('cent math', () => {
  it('rounds to integer cents and back', () => {
    expect(toCents(10.1)).toBe(1010);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(1010)).toBe(10.1);
  });
});
