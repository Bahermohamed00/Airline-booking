import { Prisma } from '@prisma/client';

/**
 * Money conversion for the payment-provider boundary.
 *
 * Providers like Stripe charge in the smallest currency unit (cents). The
 * conversion from the persisted DECIMAL(12,2) amount must never go through
 * binary floating point (`Number(amount) * 100` drifts: 19.99 * 100 =
 * 1998.9999999999998), so this helper multiplies with Prisma's Decimal
 * (decimal.js) and refuses anything that is not an exact, positive, safe
 * integer number of cents.
 */

/** Thrown when a money value cannot be represented exactly in cents — always a data-integrity problem, never a client error. */
export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Validates and normalizes a persisted ISO 4217 currency code (uppercase). */
export function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new InvalidMoneyError(`Unsupported currency code: "${currency}"`);
  }
  return normalized;
}

/**
 * Converts a persisted major-unit amount (Prisma Decimal / number / string)
 * into the provider's integer smallest-unit amount.
 *
 * The schema stores DECIMAL(12,2), so *100 must be an exact integer; anything
 * else (sub-cent precision, zero, negatives, NaN/Infinity, values beyond
 * Number.MAX_SAFE_INTEGER) throws InvalidMoneyError instead of silently
 * rounding a charge.
 */
export function toSmallestUnit(
  amount: Prisma.Decimal | number | string,
  currency: string,
): number {
  normalizeCurrency(currency);
  let decimal: Prisma.Decimal;
  try {
    decimal =
      amount instanceof Prisma.Decimal
        ? amount
        : new Prisma.Decimal(String(amount));
  } catch {
    throw new InvalidMoneyError(`Unparseable amount: "${String(amount)}"`);
  }
  if (!decimal.isFinite()) {
    throw new InvalidMoneyError('Amount must be finite');
  }
  const cents = decimal.mul(100);
  if (!cents.isInteger()) {
    throw new InvalidMoneyError(
      `Amount ${decimal.toFixed()} ${currency} has sub-cent precision`,
    );
  }
  if (!cents.gt(0)) {
    throw new InvalidMoneyError('Amount must be positive');
  }
  const value = cents.toNumber();
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMoneyError(
      `Amount ${decimal.toFixed()} ${currency} exceeds the safe integer range`,
    );
  }
  return value;
}
