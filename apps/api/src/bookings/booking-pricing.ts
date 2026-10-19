import { ConflictException } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';

/**
 * BR-16: bookable-offer pricing for booking creation and price preview.
 * Pure functions only — no Nest DI, no persistence — so the money math is
 * unit-testable in isolation and shared verbatim between the transactional
 * creation path and the read-only preview endpoint.
 */

export interface OfferPricingSource {
  id: string;
  title: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal | number | string;
}

export interface BookingPricing {
  currency: string;
  perPassenger: {
    basePrice: number;
    discountAmount: number;
    taxAmount: number;
    feeAmount: number;
    total: number;
  };
  passengerCount: number;
  totalAmount: number;
  offerSnapshot: {
    id: string;
    title: string;
    discountType: DiscountType;
    discountValue: number;
    discountAmountPerPassenger: number;
    currency: string;
  } | null;
}

type MoneyInput = Prisma.Decimal | number | string;

/** Integer-cent math avoids binary floating-point drift on money. */
const toCents = (amount: MoneyInput): number => Math.round(Number(amount) * 100);
const fromCents = (cents: number): number => cents / 100;

/**
 * Extras line pricing. unitPrice is always the server-side catalog value,
 * quantity already validated against the catalog rules. Calculation order:
 * each line totals unitPrice × quantity, then lines sum to extrasTotal.
 * Extras are NEVER discounted by offers and never taxed here — the fare
 * components carry taxes/fees.
 */
export interface ExtraLinePriced {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export function priceExtraLines(lines: { quantity: number; unitPrice: MoneyInput }[]): {
  lines: ExtraLinePriced[];
  extrasTotal: number;
} {
  let totalCents = 0;
  const priced = lines.map((line) => {
    const unitCents = toCents(line.unitPrice);
    const lineCents = unitCents * line.quantity;
    totalCents += lineCents;
    return { quantity: line.quantity, unitPrice: fromCents(unitCents), totalPrice: fromCents(lineCents) };
  });
  return { lines: priced, extrasTotal: fromCents(totalCents) };
}

/**
 * The one composition rule for booking totals: the discounted fare total
 * (base − offer + tax + fee) × passengers comes first, extras are added
 * afterwards at full price. Both inputs are decimal amounts; the sum is
 * computed in integer cents.
 */
export function combineTotals(fareTotal: MoneyInput, extrasTotal: MoneyInput): number {
  return fromCents(toCents(fareTotal) + toCents(extrasTotal));
}

/**
 * Computes booking totals in integer cents. The offer discount applies to the
 * fare basePrice ONLY — taxes and fees are never discounted. Without an offer
 * the result is identical to the legacy formula (base + tax + fee) × pax.
 */
export function priceBooking(input: {
  fare: { basePrice: MoneyInput; taxAmount: MoneyInput; feeAmount: MoneyInput; currency: string };
  passengerCount: number;
  offer?: OfferPricingSource | null;
}): BookingPricing {
  const { fare, passengerCount, offer } = input;

  const baseCents = toCents(fare.basePrice);
  const taxCents = toCents(fare.taxAmount);
  const feeCents = toCents(fare.feeAmount);

  let discountCents = 0;
  if (offer) {
    discountCents =
      offer.discountType === DiscountType.PERCENT
        ? Math.round((baseCents * Number(offer.discountValue)) / 100)
        : toCents(offer.discountValue);
  }

  const perPassengerTotalCents = baseCents - discountCents + taxCents + feeCents;
  if (perPassengerTotalCents <= 0) {
    throw new ConflictException({
      code: 'OFFER_TOTAL_NOT_PAYABLE',
      message: 'Offer discount makes the booking total non-payable',
    });
  }

  return {
    currency: fare.currency,
    perPassenger: {
      basePrice: fromCents(baseCents),
      discountAmount: fromCents(discountCents),
      taxAmount: fromCents(taxCents),
      feeAmount: fromCents(feeCents),
      total: fromCents(perPassengerTotalCents),
    },
    passengerCount,
    totalAmount: fromCents(perPassengerTotalCents * passengerCount),
    offerSnapshot: offer
      ? {
          id: offer.id,
          title: offer.title,
          discountType: offer.discountType,
          discountValue: Number(offer.discountValue),
          discountAmountPerPassenger: fromCents(discountCents),
          currency: fare.currency,
        }
      : null,
  };
}
