import { Injectable } from '@angular/core';
import type { PriceBreakdown, ExtraSelection, SeatSelection } from '../models/booking-flow.model';
import type { Fare, Seat } from '../models/domain.model';

const SEAT_FEE_ECONOMY = 15;
const SEAT_FEE_PREMIUM_ECONOMY = 30;
const SEAT_FEE_BUSINESS = 0;
const SEAT_FEE_FIRST = 0;
const EXTRA_BAG_PRICE = 65;
const CHILD_DISCOUNT_RATE = 0.25; // children pay 75% of base fare
const INFANT_RATE = 0.1; // infants pay 10% of base fare
const PROMO_DISCOUNT_RATE = 0.1;

@Injectable({ providedIn: 'root' })
export class PricingService {
  seatFee(seat: Seat | null | undefined): number {
    if (!seat) return 0;
    switch (seat.cabinClass) {
      case 'ECONOMY': return SEAT_FEE_ECONOMY;
      case 'PREMIUM_ECONOMY': return SEAT_FEE_PREMIUM_ECONOMY;
      case 'BUSINESS': return SEAT_FEE_BUSINESS;
      case 'FIRST': return SEAT_FEE_FIRST;
      default: return 0;
    }
  }

  computeBreakdown(input: {
    fare: Fare;
    returnFare?: Fare | null;
    passengerTypes: ('ADULT' | 'CHILD' | 'INFANT')[];
    seats: SeatSelection[];
    returnSeats?: SeatSelection[];
    extras: ExtraSelection[];
    extraBags: number;
    promoCode?: string | null;
  }): PriceBreakdown {
    const fareTotal = (fare: Fare, type: 'ADULT' | 'CHILD' | 'INFANT'): number => {
      const unit = fare.basePrice + fare.taxAmount + fare.feeAmount;
      if (type === 'CHILD') return unit * (1 - CHILD_DISCOUNT_RATE);
      if (type === 'INFANT') return fare.basePrice * INFANT_RATE;
      return unit;
    };

    let baseFare = 0;
    let taxes = 0;
    let fees = 0;
    for (const type of input.passengerTypes) {
      const total = fareTotal(input.fare, type);
      baseFare += total;
      if (input.returnFare) baseFare += fareTotal(input.returnFare, type);
    }
    taxes = input.fare.taxAmount * input.passengerTypes.length;
    fees = input.fare.feeAmount * input.passengerTypes.length;

    const seatCharges =
      input.seats.reduce((sum, s) => sum + this.seatFee(s.seat), 0) +
      (input.returnSeats ?? []).reduce((sum, s) => sum + this.seatFee(s.seat), 0);

    const extras = input.extras.reduce((sum, e) => sum + e.extra.price * e.quantity, 0);
    const baggage = input.extraBags * EXTRA_BAG_PRICE;

    const discount = input.promoCode ? Math.round(baseFare * PROMO_DISCOUNT_RATE * 100) / 100 : 0;

    const total = Math.max(0, baseFare + seatCharges + extras + baggage - discount);

    return {
      baseFare: round2(baseFare),
      taxes: round2(taxes),
      fees: round2(fees),
      baggage: round2(baggage),
      extras: round2(extras),
      seatCharges: round2(seatCharges),
      discount: round2(discount),
      total: round2(total),
      currency: input.fare.currency,
    };
  }

  estimateRefund(fare: Fare, totalPaid: number): { amount: number; feePercent: number; refundable: boolean } {
    // Rules unknown (null) → no refund is promised rather than a fabricated one.
    const feePercent = fare.rules?.refundable ? fare.rules.cancellationFeePercent : 100;
    const amount = round2(Math.max(0, totalPaid * (1 - feePercent / 100)));
    return { amount, feePercent, refundable: fare.rules?.refundable ?? false };
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatMoney(amount: number, currency: string, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
