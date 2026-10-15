import { ExtraPricingUnit, ExtraServiceCategory, Prisma } from '@prisma/client';
import { prisma } from './shared.js';

/**
 * Bookable extras catalog fixtures. Idempotent upserts keyed by `code`;
 * existing rows (including staff price edits) are never overwritten.
 *
 * Insurance note: no insurer integration exists in this project, so the only
 * insurance product seeded here is an explicitly-flagged, non-binding
 * DEMONSTRATION product — the API will refuse any insurance row without
 * metadata.demonstration = true.
 */
export const EXTRA_SERVICE_DEFS: Array<{
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: ExtraServiceCategory;
  pricingUnit: ExtraPricingUnit;
  maxQuantity: number;
  requiresPassenger: boolean;
  metadata?: Record<string, unknown>;
}> = [
  {
    code: 'BAG_23KG',
    name: 'Extra checked bag (23 kg)',
    description: 'One additional checked bag up to 23 kg, beyond the allowance included in your fare.',
    price: 65,
    currency: 'EUR',
    category: ExtraServiceCategory.BAGGAGE,
    pricingUnit: ExtraPricingUnit.PER_ITEM,
    maxQuantity: 3,
    requiresPassenger: true,
    metadata: { bagWeightKg: 23 },
  },
  {
    code: 'MEAL_HOT',
    name: 'Hot meal',
    description: 'A freshly prepared hot meal served during the flight. Vegetarian option available.',
    price: 12.5,
    currency: 'EUR',
    category: ExtraServiceCategory.MEAL,
    pricingUnit: ExtraPricingUnit.PER_ITEM,
    maxQuantity: 1,
    requiresPassenger: true,
    metadata: { dietaryTags: ['vegetarian'] },
  },
  {
    code: 'MEAL_SNACK',
    name: 'Snack & drink combo',
    description: 'A snack of your choice with a hot or cold drink.',
    price: 7.9,
    currency: 'EUR',
    category: ExtraServiceCategory.MEAL,
    pricingUnit: ExtraPricingUnit.PER_ITEM,
    maxQuantity: 2,
    requiresPassenger: true,
  },
  {
    code: 'PRIORITY_BOARDING',
    name: 'Priority boarding',
    description: 'Board in the first group and settle in before the cabin fills.',
    price: 15,
    currency: 'EUR',
    category: ExtraServiceCategory.PRIORITY,
    pricingUnit: ExtraPricingUnit.PER_PASSENGER,
    maxQuantity: 1,
    requiresPassenger: true,
  },
  {
    code: 'PRIORITY_CHECKIN',
    name: 'Priority check-in',
    description: 'Use the priority check-in desk at the airport for this booking.',
    price: 10,
    currency: 'EUR',
    category: ExtraServiceCategory.PRIORITY,
    pricingUnit: ExtraPricingUnit.PER_BOOKING,
    maxQuantity: 1,
    requiresPassenger: false,
  },
  {
    code: 'INS_DEMO_BASIC',
    name: 'Travel insurance (demonstration)',
    description:
      'Demonstration product for this educational project — this is NOT a real insurance policy. ' +
      'No coverage is provided, no insurer underwrites it, and no claims can be made.',
    price: 9.99,
    currency: 'EUR',
    category: ExtraServiceCategory.INSURANCE,
    pricingUnit: ExtraPricingUnit.PER_PASSENGER,
    maxQuantity: 1,
    requiresPassenger: true,
    metadata: { demonstration: true },
  },
];

export async function seedExtras(): Promise<number> {
  for (const def of EXTRA_SERVICE_DEFS) {
    await prisma.extraService.upsert({
      where: { code: def.code },
      // Idempotent: never overwrite an existing catalog row — staff price
      // changes and deactivations must survive reseeding.
      update: {},
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        price: def.price,
        currency: def.currency,
        category: def.category,
        pricingUnit: def.pricingUnit,
        maxQuantity: def.maxQuantity,
        requiresPassenger: def.requiresPassenger,
        metadata: (def.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
  return EXTRA_SERVICE_DEFS.length;
}
