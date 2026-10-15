import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OffersPage } from './offers.component';
import { OffersService, type OfferView } from '../../../core/services/offers.service';

const OFFERS: OfferView[] = [
  {
    id: 'o1',
    title: 'Transatlantic Business',
    description: 'Fully flat seats, lounge access, and priority everything.',
    badge: '−30% Business',
    destination: 'Frankfurt → New York',
    offerValue: 'from €1,899',
    terms: 'One-way Business Class fare, taxes included.',
    imageUrl: 'assets/img/dest-nyc.jpg',
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    bookable: true,
    discount: { type: 'PERCENT', value: 30 },
    eligibility: {
      routeId: 'r1',
      originIata: 'FRA',
      destinationIata: 'JFK',
      cabinClass: 'BUSINESS',
    },
  },
  {
    id: 'o2',
    title: 'London City Break',
    description: 'Weekend-ready fares with hand baggage included.',
    badge: 'City break',
    destination: 'Frankfurt → London',
    offerValue: 'from €89',
    terms: null,
    imageUrl: 'assets/img/dest-london.jpg',
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    bookable: false,
    discount: null,
    eligibility: null,
  },
  {
    id: 'o3',
    title: 'NovaAir Weekend Escape',
    description: '€120 off the Economy base fare to Dubai.',
    badge: '−€120 Economy',
    destination: 'Frankfurt → Dubai',
    offerValue: 'from €220',
    terms: 'One-way Economy fare.',
    imageUrl: 'assets/img/dest-dubai.jpg',
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    bookable: true,
    discount: { type: 'FIXED_AMOUNT', value: 120 },
    eligibility: {
      routeId: 'r2',
      originIata: 'FRA',
      destinationIata: 'DXB',
      cabinClass: 'ECONOMY',
    },
  },
  {
    id: 'o4',
    title: 'NovaAir Summer Collection',
    description: 'Hand-picked summer destinations — browse the collection.',
    badge: 'Summer picks',
    destination: 'NovaAir network',
    offerValue: null,
    terms: null,
    imageUrl: null,
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    bookable: false,
    discount: null,
    eligibility: null,
  },
];

const BOOKABLE = OFFERS.filter((o) => o.bookable);
const MARKETING_ONLY = OFFERS.filter((o) => !o.bookable);

async function setup(offers: OfferView[] | null = OFFERS) {
  const service = {
    listPublic: vi.fn(() =>
      offers === null ? throwError(() => new Error('unavailable')) : of(offers),
    ),
  };
  await TestBed.configureTestingModule({
    imports: [OffersPage],
    providers: [provideRouter([]), { provide: OffersService, useValue: service }],
  }).compileComponents();

  const fixture: ComponentFixture<OffersPage> = TestBed.createComponent(OffersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, service };
}

describe('OffersPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads offers from the API service and renders hero, featured offer and cards', async () => {
    const { el, service } = await setup();
    expect(service.listPublic).toHaveBeenCalledOnce();

    expect(el.querySelector('.panel--hero h1')?.textContent).toContain('Offers worth packing for');
    expect(el.querySelector('.panel--featured')).not.toBeNull();
    expect(el.querySelector('.panel--featured .f-title')?.textContent).toContain(
      'Transatlantic Business',
    );
    // Featured + cards together cover exactly the bookable offers.
    expect(el.querySelectorAll('.all__grid .card').length).toBe(BOOKABLE.length - 1);
  });

  it('shows only bookable offers when the API response is mixed', async () => {
    const { el } = await setup(OFFERS);

    expect(el.querySelector('.panel--featured .f-title')?.textContent).toContain(BOOKABLE[0].title);
    const cardTitles = Array.from(el.querySelectorAll('.all__grid .card')).map((c) =>
      c.querySelector('.card__title')?.textContent,
    );
    expect(cardTitles).toEqual(['NovaAir Weekend Escape']);

    // Marketing-only offers are absent from every listing section...
    for (const offer of MARKETING_ONLY) {
      expect(el.textContent).not.toContain(offer.title);
      expect(el.textContent).not.toContain(offer.description);
    }
    expect(el.querySelectorAll('.panel--featured').length).toBe(1);
    expect(el.querySelectorAll('.all__grid .card').length).toBe(BOOKABLE.length - 1);

    // ...including the hero stats, which count only what is actually listed.
    expect(el.querySelector('.stats strong')?.textContent?.trim()).toBe(String(BOOKABLE.length));
  });

  it('never lists a marketing-only offer, even when it is first in the API response', async () => {
    // Featured is offers[0]; a marketing-only offer must not take that slot.
    const { el } = await setup([MARKETING_ONLY[0], BOOKABLE[0]]);

    expect(el.querySelector('.panel--featured .f-title')?.textContent).toContain(
      'Transatlantic Business',
    );
    expect(el.textContent).not.toContain(MARKETING_ONLY[0].title);
    expect(el.querySelectorAll('.all__grid .card').length).toBe(0);
  });

  it('shows badge, value, destination, validity and terms on offer cards', async () => {
    const { el } = await setup(OFFERS);
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.all__grid .card'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.querySelector('.pill--tag')?.textContent?.trim().length).toBeGreaterThan(0);
      expect(card.querySelector('.value')?.textContent).toContain('from €');
      expect(card.querySelector('.card__route')?.textContent).toContain('→');
      expect(card.querySelector('.card__validity')?.textContent).toContain('Valid until');
      expect(card.querySelector('.card__media img')).not.toBeNull();
    }
    expect(el.querySelector('.panel--featured .facts')?.textContent).toContain('Valid until');
    expect(el.querySelector('.panel--featured .facts')?.textContent).toContain('One-way Business');
  });

  it('links every listed offer to its detail page for booking', async () => {
    const { el } = await setup(OFFERS);

    // Featured (bookable) offer gets a Book now CTA to /offers/:id.
    const featured = el.querySelector<HTMLAnchorElement>('.panel--featured .cta')!;
    expect(featured.textContent).toContain('Book now');
    expect(featured.getAttribute('href')).toBe(`/offers/${BOOKABLE[0].id}`);
    expect(featured.getAttribute('aria-label')).toBeTruthy();

    // Every card is bookable, so every card offers the same booking route.
    for (const card of Array.from(el.querySelectorAll<HTMLElement>('.all__grid .card'))) {
      const cta = card.querySelector<HTMLAnchorElement>('.card__foot a.cta')!;
      expect(cta.textContent).toContain('Book now');
      expect(cta.getAttribute('href')).toMatch(/^\/offers\/o\d$/);
      expect(cta.getAttribute('aria-label')).toBeTruthy();
      expect(card.textContent).not.toContain('Search flights');
    }
  });

  it('offers no flight-search CTA anywhere on the page', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toContain('Search flights');
    expect(el.querySelector('a[href="/search"]')).toBeNull();
    // "Browse all offers" stays in place.
    const browse = el.querySelector<HTMLAnchorElement>('.hero__actions .cta')!;
    expect(browse.textContent).toContain('Browse all offers');
    expect(browse.getAttribute('href')).toBe('#all-offers');
  });

  it('renders a retryable error state when the API fails', async () => {
    const { el, service } = await setup(null);
    expect(el.textContent).toContain('Offers unavailable');
    expect(el.querySelector('na-alert .alert__retry')).not.toBeNull();

    (el.querySelector('na-alert .alert__retry') as HTMLButtonElement).click();
    expect(service.listPublic).toHaveBeenCalledTimes(2);
  });

  it('renders an empty state when there are no active offers', async () => {
    const { el } = await setup([]);
    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('No offers right now');
    expect(el.querySelector('.panel--featured')).toBeNull();
    expect(el.querySelector('.all__grid .card')).toBeNull();
    // The empty state keeps its message but offers no flight-search action.
    expect(el.querySelector('na-empty-state na-button')).toBeNull();
    expect(el.querySelector('a[href="/search"]')).toBeNull();
  });

  it('shows the bookable empty state when every active offer is marketing-only', async () => {
    const { el } = await setup(MARKETING_ONLY);

    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('No bookable offers are available right now');
    // Marketing-only offers are not leaked through the empty state either.
    for (const offer of MARKETING_ONLY) {
      expect(el.textContent).not.toContain(offer.title);
    }
    expect(el.querySelector('.panel--featured')).toBeNull();
    expect(el.querySelector('.all__grid .card')).toBeNull();
    expect(el.querySelector('#all-offers')).toBeNull();
    expect(el.querySelector('.smallprint')).toBeNull();
    // No flight-search CTA, and the hero count reflects zero bookable offers.
    expect(el.querySelector('na-empty-state na-button')).toBeNull();
    expect(el.querySelector('a[href="/search"]')).toBeNull();
    expect(el.textContent).not.toContain('Search flights');
    expect(el.querySelector('.stats strong')?.textContent?.trim()).toBe('0');
  });
});
