import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OffersPage } from './offers.component';
import { OFFER_PAGE_OFFERS } from './offers.data';

async function setup(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [OffersPage],
    providers: [provideRouter([])],
  }).compileComponents();

  const fixture: ComponentFixture<OffersPage> = TestBed.createComponent(OffersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('OffersPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the hero with heading and CTAs', async () => {
    const el = await setup();
    expect(el.querySelector('.panel--hero h1')?.textContent).toContain('Offers worth packing for');
    expect(el.querySelector('.panel--hero .cta')).not.toBeNull();
    expect(el.querySelector('.stats')?.children.length).toBe(3);
  });

  it('renders the featured offer plus one card per remaining offer', async () => {
    const el = await setup();
    expect(el.querySelector('.panel--featured')).not.toBeNull();
    const expected = OFFER_PAGE_OFFERS.filter((o) => !o.featured).length;
    expect(el.querySelectorAll('.all__grid .card').length).toBe(expected);
  });

  it('shows image, discount, validity and price on every offer card', async () => {
    const el = await setup();
    for (const card of Array.from(el.querySelectorAll<HTMLElement>('.all__grid .card'))) {
      expect(card.querySelector('.card__media img')).not.toBeNull();
      expect(card.querySelector('.pill--off')?.textContent).toMatch(/−\d+%/);
      expect(card.querySelector('.card__validity')?.textContent).toContain('Book by');
      expect(card.querySelector('.price')?.textContent).toMatch(/€\d+/);
      expect(card.querySelector('.card__perk')?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('deep-links every CTA to flight results with search params', async () => {
    const el = await setup();
    const ctas = Array.from(el.querySelectorAll<HTMLAnchorElement>('.panel--featured .cta, .card .cta'));
    expect(ctas.length).toBe(OFFER_PAGE_OFFERS.length);
    for (const cta of ctas) {
      const href = cta.getAttribute('href') ?? '';
      expect(href).toContain('/results');
      expect(href).toContain('tripType=ONE_WAY');
      expect(href).toContain('origin=');
      expect(cta.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
