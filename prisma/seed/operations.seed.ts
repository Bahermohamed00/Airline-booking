import { LoyaltyTier, User } from '@prisma/client';
import { prisma, generateLoyaltyMemberNumber } from './shared.js';

async function seedLoyalty(customer: User): Promise<void> {
  await prisma.loyaltyAccount.upsert({
    where: { userId: customer.id },
    update: {},
    create: {
      userId: customer.id,
      memberNumber: generateLoyaltyMemberNumber(),
      tier: LoyaltyTier.SILVER,
      balance: 12500,
    },
  });
}

async function seedSystemSettings(): Promise<void> {
  const settings = [
    {
      key: 'seat_hold_minutes',
      value: '15',
      category: 'booking',
      isPublic: true,
      description: 'Minutes a seat hold stays active during checkout',
    },
    {
      key: 'check_in_opens_hours',
      value: '24',
      category: 'operations',
      isPublic: true,
      description: 'Hours before departure when online check-in opens',
    },
    {
      key: 'default_currency',
      value: 'EUR',
      category: 'localization',
      isPublic: true,
      description: 'Default currency for new bookings',
    },
    {
      key: 'cancellation_fee_percent',
      value: '10',
      category: 'finance',
      isPublic: false,
      description: 'Default cancellation fee percentage',
    },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
}

/** Operations & platform: the demo loyalty account and system settings. */
export async function seedOperations(customer: User): Promise<void> {
  await seedLoyalty(customer);
  await seedSystemSettings();
}
