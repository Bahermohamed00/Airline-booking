import { describe, it, expect } from 'vitest';
import { PricingService, formatMoney } from './pricing.service';
import type { Fare, Seat } from '../models/domain.model';

const fare: Fare = {
  id: 'f1-fare-economy',
  flightId: 'f1',
  cabinClass: 'ECONOMY',
  basePrice: 100,
  taxAmount: 16,
  feeAmount: 4,
  currency: 'EUR',
  availableCount: 10,
  rules: {
    refundable: false,
    changeAllowed: true,
    changeFee: 90,
    cancellationFeePercent: 100,
    checkedBaggagePieces: 1,
    checkedBaggageWeightKg: 23,
    carryOnPieces: 1,
    seatSelectionFee: 15,
    priorityBoarding: false,
    loungeAccess: false,
    description: 'Economy Light',
  },
};

const flexibleFare: Fare = {
  ...fare,
  id: 'f1-fare-flex',
  basePrice: 160,
  rules: { ...fare.rules, refundable: true, cancellationFeePercent: 0 },
};

const economySeat: Seat = {
  id: 's1',
  aircraftId: 'a1',
  seatNumber: '12A',
  cabinClass: 'ECONOMY',
  seatRow: 12,
  seatColumn: 'A',
  isExitRow: false,
};

describe('PricingService', () => {
  const pricing = new PricingService();

  it('computes a single adult fare with taxes and fees', () => {
    const breakdown = pricing.computeBreakdown({
      fare,
      passengerTypes: ['ADULT'],
      seats: [],
      extras: [],
      extraBags: 0,
    });
    expect(breakdown.total).toBe(120);
    expect(breakdown.currency).toBe('EUR');
  });

  it('applies child and infant discounts to base fare', () => {
    const breakdown = pricing.computeBreakdown({
      fare,
      passengerTypes: ['ADULT', 'CHILD', 'INFANT'],
      seats: [],
      extras: [],
      extraBags: 0,
    });
    // adult 120 + child 90 + infant 10
    expect(breakdown.total).toBe(220);
  });

  it('adds seat charges, extras, and extra baggage', () => {
    const breakdown = pricing.computeBreakdown({
      fare,
      passengerTypes: ['ADULT'],
      seats: [{ passengerIndex: 0, seat: economySeat }],
      extras: [{ extra: { id: 'e1', code: 'MEAL', name: 'Meal', price: 24, currency: 'EUR', category: 'MEAL' }, quantity: 2 }],
      extraBags: 1,
    });
    // 120 + 15 seat + 48 extras + 65 bag
    expect(breakdown.total).toBe(248);
    expect(breakdown.seatCharges).toBe(15);
    expect(breakdown.extras).toBe(48);
    expect(breakdown.baggage).toBe(65);
  });

  it('applies promo discount on the fare total and never goes negative', () => {
    const breakdown = pricing.computeBreakdown({
      fare,
      passengerTypes: ['ADULT'],
      seats: [],
      extras: [],
      extraBags: 0,
      promoCode: 'SUMMER10',
    });
    expect(breakdown.discount).toBe(12);
    expect(breakdown.total).toBe(108);
  });

  it('includes the return fare for round trips', () => {
    const breakdown = pricing.computeBreakdown({
      fare,
      returnFare: fare,
      passengerTypes: ['ADULT'],
      seats: [],
      returnSeats: [],
      extras: [],
      extraBags: 0,
    });
    expect(breakdown.total).toBe(240);
  });

  it('estimates refunds per fare rules', () => {
    const nonRefundable = pricing.estimateRefund(fare, 240);
    expect(nonRefundable.refundable).toBe(false);
    expect(nonRefundable.amount).toBe(0);

    const refundable = pricing.estimateRefund(flexibleFare, 320);
    expect(refundable.refundable).toBe(true);
    expect(refundable.amount).toBe(320);
  });

  it('formats money with Intl', () => {
    expect(formatMoney(120, 'EUR')).toContain('120');
  });
});
