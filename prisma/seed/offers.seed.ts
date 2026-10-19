import { CabinClass, DiscountType, OfferStatus, Offer, Prisma } from '@prisma/client';
import { prisma } from './shared.js';

/**
 * Fictional NovaAir offers (Phase 5 + BR-16 bookable offers). Deterministic
 * and idempotent via upsert on the unique title; validity windows roll with
 * the seed date. Offers with discountType set are bookable (discount applies
 * to the fare basePrice only) and may be scoped to a route and/or cabin;
 * offers without it stay marketing-only.
 */
export async function seedOffers(): Promise<number> {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const validFrom = new Date(baseDate);
  validFrom.setDate(validFrom.getDate() - 7);
  const validUntil = new Date(baseDate);
  validUntil.setDate(validUntil.getDate() + 60);

  const active = { status: OfferStatus.ACTIVE, validFrom, validUntil };

  // Route-scoped bookable offers reference real seeded routes — fail loudly
  // rather than silently dropping the scope if the catalog seed is missing one.
  const routeByIata = async (origin: string, destination: string) => {
    const route = await prisma.route.findFirst({
      where: {
        originAirport: { iataCode: origin },
        destinationAirport: { iataCode: destination },
      },
    });
    if (!route) {
      throw new Error(
        `seedOffers: route ${origin}→${destination} not found — catalog/flights seed must run first`,
      );
    }
    return route;
  };
  const fraJfk = await routeByIata('FRA', 'JFK');
  const fraDxb = await routeByIata('FRA', 'DXB');

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
    > &
      // BR-16 bookable terms/scope — absent on the legacy marketing offers.
      Partial<Pick<Offer, 'discountType' | 'discountValue' | 'routeId' | 'cabinClass'>>
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
    // BR-16 bookable offers — discount terms + optional route/cabin scope.
    {
      title: 'NovaAir Business Saver',
      description:
        'Save 15% on the Business Class base fare to New York — flat beds, lounge access, and priority everything.',
      badge: '−15% Business',
      destination: 'Frankfurt → New York',
      offerValue: '−15% on Business base fare',
      terms:
        'Bookable Business Class discount on NV100/NV200 departures Frankfurt → New York. Discount applies to the base fare only; taxes and fees excluded.',
      imageUrl: 'assets/img/dest-nyc.jpg',
      discountType: DiscountType.PERCENT,
      discountValue: new Prisma.Decimal(15),
      routeId: fraJfk.id,
      cabinClass: CabinClass.BUSINESS,
      ...active,
    },
    {
      title: 'NovaAir Weekend Escape',
      description:
        '€120 off the Economy base fare to Dubai — trade the weekend rain for winter sun.',
      badge: '−€120 Economy',
      destination: 'Frankfurt → Dubai',
      offerValue: '−€120 on Economy base fare',
      terms:
        'Bookable Economy discount on NV103 departures Frankfurt → Dubai. Discount applies to the base fare only; taxes and fees excluded.',
      imageUrl: 'assets/img/dest-dubai.jpg',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: new Prisma.Decimal(120),
      routeId: fraDxb.id,
      cabinClass: CabinClass.ECONOMY,
      ...active,
    },
    {
      title: 'NovaAir Seasonal Fare',
      description: '10% off the base fare across the whole NovaAir network, every cabin, all season.',
      badge: '−10% network-wide',
      destination: 'NovaAir network',
      offerValue: '−10% on base fare',
      terms:
        'Bookable discount on all routes and cabins. Discount applies to the base fare only; taxes and fees excluded.',
      imageUrl: null,
      discountType: DiscountType.PERCENT,
      discountValue: new Prisma.Decimal(10),
      ...active,
    },
    {
      title: 'NovaAir Economy Escape',
      description: '12% off the Economy base fare on any NovaAir route — pick a city and go.',
      badge: '−12% Economy',
      destination: 'NovaAir network',
      offerValue: '−12% on Economy base fare',
      terms:
        'Bookable Economy discount on all routes. Discount applies to the base fare only; taxes and fees excluded.',
      imageUrl: null,
      discountType: DiscountType.PERCENT,
      discountValue: new Prisma.Decimal(12),
      cabinClass: CabinClass.ECONOMY,
      ...active,
    },
    {
      title: 'NovaAir Summer Collection',
      description: 'Hand-picked summer destinations across the NovaAir network — browse the collection.',
      badge: 'Summer picks',
      destination: 'NovaAir network',
      offerValue: null,
      terms: null,
      imageUrl: null,
      ...active,
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
