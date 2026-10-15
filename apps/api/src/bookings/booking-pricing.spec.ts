import { describe, it, expect } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { combineTotals, priceBooking, priceExtraLines } from './booking-pricing';

const fare = (overrides: Record<string, unknown> = {}) => ({
  basePrice: 421,
  taxAmount: 67,
  feeAmount: 17,
  currency: 'EUR',
  ...overrides,
});

const offer = (overrides: Record<string, unknown> = {}) => ({
  id: 'offer-1',
  title: 'Spring Sale',
  discountType: DiscountType.PERCENT,
  discountValue: 10,
  ...overrides,
});

describe('priceBooking', () => {
  it('no offer: totals are identical to the legacy (base+tax+fee)×pax formula', () => {
    const pricing = priceBooking({ fare: fare(), passengerCount: 2 });
    expect(pricing).toEqual({
      currency: 'EUR',
      perPassenger: { basePrice: 421, discountAmount: 0, taxAmount: 67, feeAmount: 17, total: 505 },
      passengerCount: 2,
      totalAmount: 1010,
      offerSnapshot: null,
    });
  });

  it('percent discount applies to the base price only', () => {
    const pricing = priceBooking({ fare: fare(), passengerCount: 1, offer: offer() });
    // 10% of 421.00 = 42.10 → discountedBase 378.90 + 67 + 17 = 462.90
    expect(pricing.perPassenger).toEqual({
      basePrice: 421,
      discountAmount: 42.1,
      taxAmount: 67,
      feeAmount: 17,
      total: 462.9,
    });
    expect(pricing.totalAmount).toBe(462.9);
    expect(pricing.offerSnapshot).toEqual({
      id: 'offer-1',
      title: 'Spring Sale',
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      discountAmountPerPassenger: 42.1,
      currency: 'EUR',
    });
  });

  it('fixed-amount discount is exact cents and leaves tax/fee untouched', () => {
    const pricing = priceBooking({
      fare: fare(),
      passengerCount: 1,
      offer: offer({ discountType: DiscountType.FIXED_AMOUNT, discountValue: 50 }),
    });
    expect(pricing.perPassenger.discountAmount).toBe(50);
    expect(pricing.perPassenger.taxAmount).toBe(67);
    expect(pricing.perPassenger.feeAmount).toBe(17);
    expect(pricing.perPassenger.total).toBe(455);
    expect(pricing.totalAmount).toBe(455);
  });

  it('percent discount rounds to the nearest cent (33.33% of an odd cent amount)', () => {
    const pricing = priceBooking({
      fare: fare({ basePrice: 100.01, taxAmount: 0, feeAmount: 0 }),
      passengerCount: 1,
      offer: offer({ discountValue: 33.33 }),
    });
    // round(10001 × 33.33 / 100) = round(3333.3333) = 3333 cents
    expect(pricing.perPassenger.discountAmount).toBe(33.33);
    expect(pricing.perPassenger.total).toBe(66.68);
  });

  it('multiplies the rounded per-passenger total — rounding never leaks into the total', () => {
    const pricing = priceBooking({
      fare: fare({ basePrice: 33.33, taxAmount: 0, feeAmount: 0 }),
      passengerCount: 3,
      offer: offer({ discountValue: 10 }),
    });
    // round(3333 × 0.10) = 333 cents discount → 30.00 per passenger → 90.00 total
    expect(pricing.perPassenger.total).toBe(30);
    expect(pricing.totalAmount).toBe(90);
  });

  it('a 100% discount still pays taxes and fees', () => {
    const pricing = priceBooking({
      fare: fare(),
      passengerCount: 2,
      offer: offer({ discountValue: 100 }),
    });
    expect(pricing.perPassenger.total).toBe(84); // 0 + 67 + 17
    expect(pricing.totalAmount).toBe(168);
  });

  it.each([
    ['zero', 505],
    ['negative', 600],
  ])('rejects a %s per-passenger total with 409 OFFER_TOTAL_NOT_PAYABLE', (_label, discountValue) => {
    try {
      priceBooking({
        fare: fare(),
        passengerCount: 1,
        offer: offer({ discountType: DiscountType.FIXED_AMOUNT, discountValue }),
      });
      expect.unreachable('expected priceBooking to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'OFFER_TOTAL_NOT_PAYABLE' });
    }
  });

  it('accepts Prisma.Decimal and decimal-string fare inputs', () => {
    const fromDecimal = priceBooking({
      fare: {
        basePrice: new Prisma.Decimal('421.00'),
        taxAmount: new Prisma.Decimal('67.00'),
        feeAmount: new Prisma.Decimal('17.00'),
        currency: 'EUR',
      },
      passengerCount: 1,
      offer: {
        id: 'offer-1',
        title: 'Spring Sale',
        discountType: DiscountType.PERCENT,
        discountValue: new Prisma.Decimal('10.00'),
      },
    });
    const fromStrings = priceBooking({
      fare: fare({ basePrice: '421.00', taxAmount: '67.00', feeAmount: '17.00' }),
      passengerCount: 1,
      offer: offer({ discountValue: '10.00' }),
    });
    const expected = priceBooking({ fare: fare(), passengerCount: 1, offer: offer() });
    expect(fromDecimal).toEqual(expected);
    expect(fromStrings).toEqual(expected);
  });
});

describe('priceExtraLines', () => {
  it('prices each line as unitPrice × quantity and sums lines in integer cents', () => {
    const priced = priceExtraLines([
      { quantity: 2, unitPrice: 12.5 },
      { quantity: 1, unitPrice: 65 },
      { quantity: 3, unitPrice: new Prisma.Decimal('9.99') },
    ]);
    expect(priced.lines).toEqual([
      { quantity: 2, unitPrice: 12.5, totalPrice: 25 },
      { quantity: 1, unitPrice: 65, totalPrice: 65 },
      { quantity: 3, unitPrice: 9.99, totalPrice: 29.97 },
    ]);
    expect(priced.extrasTotal).toBe(119.97);
  });

  it('returns zero for no lines and avoids float drift', () => {
    expect(priceExtraLines([]).extrasTotal).toBe(0);
    // 0.1 + 0.2 style drift must never appear: 3 × 9.99 + 0.01 lines.
    expect(priceExtraLines([{ quantity: 3, unitPrice: 9.99 }, { quantity: 1, unitPrice: 0.01 }]).extrasTotal).toBe(29.98);
  });
});

describe('combineTotals', () => {
  it('adds the extras total after the fare total, in exact cents', () => {
    // The one composition rule: discounted fare total first, extras after.
    const pricing = priceBooking({ fare: fare(), passengerCount: 1, offer: offer() }); // 462.90
    expect(combineTotals(pricing.totalAmount, 119.97)).toBe(582.87);
    expect(combineTotals(1010, 0)).toBe(1010);
    expect(combineTotals('462.90', new Prisma.Decimal('119.97'))).toBe(582.87);
  });
});
