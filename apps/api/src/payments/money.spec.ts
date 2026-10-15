import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  InvalidMoneyError,
  normalizeCurrency,
  toSmallestUnit,
} from './money';

describe('toSmallestUnit', () => {
  it('converts whole-euro amounts exactly', () => {
    expect(toSmallestUnit(new Prisma.Decimal('505'), 'EUR')).toBe(50500);
  });

  it('converts two-decimal amounts without floating-point drift', () => {
    // 19.99 * 100 in binary floating point is 1998.9999999999998.
    expect(toSmallestUnit(new Prisma.Decimal('19.99'), 'EUR')).toBe(1999);
    expect(toSmallestUnit('0.10', 'USD')).toBe(10);
    expect(toSmallestUnit('454.50', 'eur')).toBe(45450);
  });

  it('accepts number input via its shortest round-trip decimal form', () => {
    expect(toSmallestUnit(505, 'EUR')).toBe(50500);
    expect(toSmallestUnit(454.53, 'EUR')).toBe(45453);
  });

  it('converts a single cent', () => {
    expect(toSmallestUnit(new Prisma.Decimal('0.01'), 'EUR')).toBe(1);
  });

  it('rejects zero and negative amounts', () => {
    expect(() => toSmallestUnit('0', 'EUR')).toThrow(InvalidMoneyError);
    expect(() => toSmallestUnit(new Prisma.Decimal('-10'), 'EUR')).toThrow(
      InvalidMoneyError,
    );
  });

  it('rejects sub-cent precision instead of rounding a charge', () => {
    expect(() => toSmallestUnit('10.005', 'EUR')).toThrow(InvalidMoneyError);
  });

  it('rejects NaN and infinite amounts', () => {
    expect(() => toSmallestUnit('NaN', 'EUR')).toThrow(InvalidMoneyError);
    expect(() => toSmallestUnit('Infinity', 'EUR')).toThrow(InvalidMoneyError);
    expect(() => toSmallestUnit(Number.NaN, 'EUR')).toThrow(InvalidMoneyError);
  });

  it('rejects unparseable amounts', () => {
    expect(() => toSmallestUnit('not-a-number', 'EUR')).toThrow(
      InvalidMoneyError,
    );
  });

  it('rejects amounts beyond the safe integer range', () => {
    expect(() =>
      toSmallestUnit('99999999999999.99', 'EUR'),
    ).toThrow(InvalidMoneyError);
  });

  it('rejects unsupported currency codes', () => {
    expect(() => toSmallestUnit('10', 'EURO')).toThrow(InvalidMoneyError);
    expect(() => toSmallestUnit('10', 'E1')).toThrow(InvalidMoneyError);
    expect(() => toSmallestUnit('10', '')).toThrow(InvalidMoneyError);
  });
});

describe('normalizeCurrency', () => {
  it('uppercases valid ISO codes', () => {
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency(' USD ')).toBe('USD');
  });

  it('rejects malformed codes', () => {
    expect(() => normalizeCurrency('euros')).toThrow(InvalidMoneyError);
    expect(() => normalizeCurrency('EU')).toThrow(InvalidMoneyError);
  });
});
