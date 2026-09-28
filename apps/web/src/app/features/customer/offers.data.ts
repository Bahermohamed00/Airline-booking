import { OFFERS } from '../home/home.data';
import type { Offer } from '../home/home.models';
import { daysFromNow } from '../home/date-input';

export interface OfferDetails extends Offer {
  /** Last booking day (yyyy-mm-dd). */
  bookBy: string;
  /** When the fare can be flown. */
  travelWindow: string;
  /** Headline benefit included with the fare. */
  perk: string;
}

type RouteExtras = Pick<OfferDetails, 'bookBy' | 'travelWindow' | 'perk'>;

const EXTRAS: Record<string, RouteExtras> = {
  'FRA-JFK': {
    bookBy: daysFromNow(14),
    travelWindow: 'Daily nonstop, year-round',
    perk: 'Lounge access & priority boarding',
  },
  'FRA-LHR': {
    bookBy: daysFromNow(10),
    travelWindow: 'Weekend departures until spring',
    perk: 'Hand baggage included',
  },
  'FRA-DXB': {
    bookBy: daysFromNow(21),
    travelWindow: 'Daily nonstop through winter',
    perk: 'Free date change on this fare',
  },
  'FRA-CDG': {
    bookBy: daysFromNow(30),
    travelWindow: 'Year-round, up to six flights a day',
    perk: 'Hand baggage included',
  },
  'FRA-SIN': {
    bookBy: daysFromNow(25),
    travelWindow: 'Daily nonstop, year-round',
    perk: 'Extra 10 kg baggage allowance',
  },
  'FRA-LAX': {
    bookBy: daysFromNow(30),
    travelWindow: 'Up to five flights per week',
    perk: 'Free standard seat selection',
  },
};

const PAGE_ONLY_OFFERS: Offer[] = [
  {
    badge: 'City break',
    origin: 'FRA',
    destination: 'CDG',
    routeLabel: 'Frankfurt → Paris',
    title: 'Paris from €99',
    description: 'One hour in the air, a weekend in the City of Light.',
    cabin: 'ECONOMY',
    price: 99,
    oldPrice: 149,
    featured: false,
    image: 'assets/img/dest-paris.jpg',
  },
  {
    badge: 'Long-haul deal',
    origin: 'FRA',
    destination: 'SIN',
    routeLabel: 'Frankfurt → Singapore',
    title: 'Singapore from €549',
    description: 'Night flights and our newest cabin, nonstop to Changi.',
    cabin: 'ECONOMY',
    price: 549,
    oldPrice: 699,
    featured: false,
    image: 'assets/img/dest-singapore.jpg',
  },
  {
    badge: 'West coast',
    origin: 'FRA',
    destination: 'LAX',
    routeLabel: 'Frankfurt → Los Angeles',
    title: 'Los Angeles from €329',
    description: 'Golden-hour arrivals on our afternoon nonstop service.',
    cabin: 'ECONOMY',
    price: 329,
    oldPrice: 459,
    featured: false,
    image: 'assets/img/dest-la.jpg',
  },
];

function withDetails(offer: Offer): OfferDetails {
  const extras = EXTRAS[`${offer.origin}-${offer.destination}`];
  return {
    ...offer,
    ...(extras ?? { bookBy: daysFromNow(21), travelWindow: 'Selected departures', perk: offer.badge }),
  };
}

/** All offers shown on the /offers page: the home-page fares plus page-only deals. */
export const OFFER_PAGE_OFFERS: OfferDetails[] = [...OFFERS, ...PAGE_ONLY_OFFERS].map(withDetails);
