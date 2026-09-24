import type { Benefit, Destination, FooterLinkGroup, Offer, Testimonial } from './home.models';

export const DESTINATIONS: Destination[] = [
  {
    code: 'JFK',
    city: 'New York',
    country: 'United States',
    tagline: 'The city that never sleeps',
    priceFrom: 299,
    image: 'assets/img/dest-nyc.jpg',
  },
  {
    code: 'DXB',
    city: 'Dubai',
    country: 'United Arab Emirates',
    tagline: 'Where the desert meets the sky',
    priceFrom: 349,
    image: 'assets/img/dest-dubai.jpg',
  },
  {
    code: 'SIN',
    city: 'Singapore',
    country: 'Singapore',
    tagline: 'A garden city above the clouds',
    priceFrom: 549,
    image: 'assets/img/dest-singapore.jpg',
  },
  {
    code: 'LHR',
    city: 'London',
    country: 'United Kingdom',
    tagline: 'Timeless streets, modern pulse',
    priceFrom: 89,
    image: 'assets/img/dest-london.jpg',
  },
  {
    code: 'CDG',
    city: 'Paris',
    country: 'France',
    tagline: 'The city of light awaits',
    priceFrom: 99,
    image: 'assets/img/dest-paris.jpg',
  },
  {
    code: 'LAX',
    city: 'Los Angeles',
    country: 'United States',
    tagline: 'Golden coast, golden hour',
    priceFrom: 329,
    image: 'assets/img/dest-la.jpg',
  },
];

export const BENEFITS: Benefit[] = [
  {
    icon: 'shield',
    title: 'Flexible, protected fares',
    description: 'Free rebooking on most fares and transparent refund options — plans change, your ticket can too.',
  },
  {
    icon: 'crown',
    title: 'Cabins crafted for comfort',
    description: 'From extra-legroom Economy to fully flat Business suites, every seat is designed around rest.',
  },
  {
    icon: 'clock',
    title: 'Punctual by design',
    description: 'A 92% on-time record across our network, with real-time status updates from gate to gate.',
  },
  {
    icon: 'support',
    title: 'Humans, around the clock',
    description: 'Real travel experts available 24/7 by phone or chat — before, during, and after your trip.',
  },
];

export const OFFERS: Offer[] = [
  {
    badge: '−30% Business',
    origin: 'FRA',
    destination: 'JFK',
    routeLabel: 'Frankfurt → New York',
    title: 'Transatlantic Business',
    description: 'Fully flat seats, lounge access, and priority everything on our flagship route.',
    cabin: 'BUSINESS',
    price: 1899,
    oldPrice: 2699,
    featured: true,
    image: 'assets/img/dest-nyc.jpg',
  },
  {
    badge: 'City break',
    origin: 'FRA',
    destination: 'LHR',
    routeLabel: 'Frankfurt → London',
    title: 'London from €89',
    description: 'Weekend-ready fares with hand baggage included.',
    cabin: 'ECONOMY',
    price: 89,
    oldPrice: 139,
    featured: false,
    image: 'assets/img/dest-london.jpg',
  },
  {
    badge: 'Winter sun',
    origin: 'FRA',
    destination: 'DXB',
    routeLabel: 'Frankfurt → Dubai',
    title: 'Dubai from €349',
    description: 'Trade the cold for the coast — daily nonstop flights.',
    cabin: 'ECONOMY',
    price: 349,
    oldPrice: 479,
    featured: false,
    image: 'assets/img/dest-dubai.jpg',
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Elena Fischer',
    route: 'Frankfurt → Singapore',
    rating: 5,
    quote:
      'The smoothest booking experience I have ever used. Seat selection, extras, check-in — everything just flowed.',
  },
  {
    name: 'Marcus Webb',
    route: 'Munich → New York',
    rating: 5,
    quote:
      'Business class felt genuinely premium. The crew remembered my name, and the flat bed meant I landed rested.',
  },
  {
    name: 'Amira Haddad',
    route: 'Frankfurt → Dubai',
    rating: 4,
    quote:
      'Transparent pricing, no surprise fees, and support picked up in under a minute when I had to rebook.',
  },
];

export const FOOTER_GROUPS: FooterLinkGroup[] = [
  {
    heading: 'Book & manage',
    links: [
      { label: 'Flight search', path: '/search' },
      { label: 'Manage booking', path: '/manage' },
      { label: 'Online check-in', path: '/checkin' },
      { label: 'Flight status', path: '/status' },
    ],
  },
  {
    heading: 'Travel info',
    links: [
      { label: 'Baggage', path: '/baggage' },
      { label: 'Loyalty program', path: '/loyalty' },
      { label: 'Help center', path: '/help' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign in', path: '/login' },
      { label: 'Create account', path: '/register' },
      { label: 'My bookings', path: '/bookings' },
    ],
  },
];
