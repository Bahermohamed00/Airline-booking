import { OfferStatus, Offer } from '@prisma/client';
import { prisma } from './shared.js';

/**
 * Fictional NovaAir marketing offers (Phase 5). Deterministic and idempotent
 * via upsert on the unique title; validity windows roll with the seed date.
 * Marketing data only — no connection to fares, bookings, or pricing.
 */
export async function seedOffers(): Promise<number> {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const validFrom = new Date(baseDate);
  validFrom.setDate(validFrom.getDate() - 7);
  const validUntil = new Date(baseDate);
  validUntil.setDate(validUntil.getDate() + 60);

  const active = { status: OfferStatus.ACTIVE, validFrom, validUntil };
  const defs: Array<
    Pick<
      Offer,
      | 'title'
      | 'description'
      | 'badge'
      | 'destination'
      | 'offerValue'
      | 'terms'
      | 'imageUrl'
      | 'status'
      | 'validFrom'
      | 'validUntil'
    >
  > = [
    {
      title: 'Transatlantic Business',
      description:
        'Fully flat seats, lounge access, and priority everything on our flagship route to New York.',
      badge: '−30% Business',
      destination: 'Frankfurt → New York',
      offerValue: 'from €1,899',
      terms:
        'One-way Business Class fare, taxes included. Subject to availability on NV100/NV200 departures.',
      imageUrl: 'assets/img/dest-nyc.jpg',
      ...active,
    },
    {
      title: 'London City Break',
      description: 'Weekend-ready fares with hand baggage included — hourly shuttle every weekday.',
      badge: 'City break',
      destination: 'Frankfurt → London',
      offerValue: 'from €89',
      terms:
        'One-way Economy Light fare, hand baggage only. Weekend departures until the end of the season.',
      imageUrl: 'assets/img/dest-london.jpg',
      ...active,
    },
    {
      title: 'Winter Sun in Dubai',
      description:
        'Trade the cold for the coast — daily nonstop flights and a free date change on this fare.',
      badge: 'Winter sun',
      destination: 'Frankfurt → Dubai',
      offerValue: 'from €349',
      terms:
        'One-way Economy fare, taxes included. Free one-time date change up to 7 days before departure.',
      imageUrl: 'assets/img/dest-dubai.jpg',
      ...active,
    },
    {
      title: 'Paris Weekend Escape',
      description: 'One hour in the air, a weekend in the City of Light — up to six flights a day.',
      badge: 'City break',
      destination: 'Frankfurt → Paris',
      offerValue: 'from €99',
      terms: 'One-way Economy Light fare, hand baggage only. Year-round departures.',
      imageUrl: 'assets/img/dest-paris.jpg',
      ...active,
    },
    {
      title: 'Singapore Early Bird',
      description: 'Night flights and our newest cabin, nonstop to Changi — book early and save.',
      badge: 'Early bird',
      destination: 'Frankfurt → Singapore',
      offerValue: 'from €549',
      terms: 'One-way Economy fare with extra 10 kg baggage allowance. Booking window limited.',
      imageUrl: 'assets/img/dest-singapore.jpg',
      ...active,
    },
    {
      title: 'West Coast Family Getaway',
      description: 'Golden-hour arrivals on our afternoon nonstop service to Los Angeles.',
      badge: 'Family fare',
      destination: 'Frankfurt → Los Angeles',
      offerValue: 'from €329',
      terms: 'One-way Economy fare, free standard seat selection for families of 3+.',
      imageUrl: 'assets/img/dest-la.jpg',
      ...active,
    },
    {
      title: 'Summer 2027 Sneak Preview',
      description: 'Something is taking off next summer. Watch this space.',
      badge: 'Coming soon',
      destination: 'NovaAir network',
      offerValue: null,
      terms: null,
      imageUrl: null,
      status: OfferStatus.DRAFT,
      validFrom,
      validUntil,
    },
    {
      title: 'Autumn Flash Sale',
      description: 'A short-lived flash sale that has already ended.',
      badge: 'Ended',
      destination: 'NovaAir network',
      offerValue: 'was −25%',
      terms: null,
      imageUrl: null,
      status: OfferStatus.EXPIRED,
      validFrom: new Date(baseDate.getTime() - 90 * 86_400_000),
      validUntil: new Date(baseDate.getTime() - 60 * 86_400_000),
    },
  ];

  for (const def of defs) {
    await prisma.offer.upsert({
      where: { title: def.title },
      update: { ...def },
      create: { ...def },
    });
  }
  return defs.length;
}
