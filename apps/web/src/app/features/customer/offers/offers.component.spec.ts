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
  },
];

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
    expect(el.querySelectorAll('.all__grid .card').length).toBe(OFFERS.length - 1);
  });

  it('shows badge, value, destination, validity and terms on offer cards', async () => {
    const { el } = await setup();
    for (const card of Array.from(el.querySelectorAll<HTMLElement>('.all__grid .card'))) {
      expect(card.querySelector('.pill--tag')?.textContent?.trim().length).toBeGreaterThan(0);
      expect(card.querySelector('.value')?.textContent).toContain('from €');
      expect(card.querySelector('.card__route')?.textContent).toContain('→');
      expect(card.querySelector('.card__validity')?.textContent).toContain('Valid until');
      expect(card.querySelector('.card__media img')).not.toBeNull();
    }
    expect(el.querySelector('.panel--featured .facts')?.textContent).toContain('Valid until');
    expect(el.querySelector('.panel--featured .facts')?.textContent).toContain('One-way Business');
  });

  it('links every CTA to flight search', async () => {
    const { el } = await setup();
    const ctas = Array.from(
      el.querySelectorAll<HTMLAnchorElement>('.panel--featured .cta, .card__foot .cta'),
    );
    expect(ctas.length).toBe(OFFERS.length);
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe('/search');
      expect(cta.getAttribute('aria-label')).toBeTruthy();
    }
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
  });
});
