import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, type ParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OfferDetailsPage } from './offer-details.component';
import { OffersService, type OfferView } from '../../../core/services/offers.service';

function offer(partial: Partial<OfferView> = {}): OfferView {
  return {
    id: 'o1',
    title: 'Transatlantic Business',
    description: 'Fully flat seats, lounge access, and priority everything.',
    badge: 'Winter sun',
    destination: 'Frankfurt → New York',
    offerValue: 'from €1,899',
    terms: 'One-way Business Class fare, taxes included.',
    imageUrl: 'assets/img/dest-nyc.jpg',
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    bookable: true,
    discount: { type: 'PERCENT', value: 20 },
    eligibility: {
      routeId: 'r1',
      originIata: 'FRA',
      destinationIata: 'JFK',
      cabinClass: 'BUSINESS',
    },
    ...partial,
  };
}

interface SetupOptions {
  getPublic?: ReturnType<typeof vi.fn>;
  id?: string;
}

async function setup(opts: SetupOptions = {}) {
  const paramMap: ParamMap = convertToParamMap({ id: opts.id ?? 'o1' });
  const service = { getPublic: opts.getPublic ?? vi.fn(() => of(offer())) };

  await TestBed.configureTestingModule({
    imports: [OfferDetailsPage],
    providers: [
      provideRouter([]),
      { provide: OffersService, useValue: service },
      { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<OfferDetailsPage> = TestBed.createComponent(OfferDetailsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, service };
}

function bookLink(el: HTMLElement): HTMLAnchorElement {
  const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('a.cta')).find((a) =>
    a.textContent?.includes('Book now'),
  );
  if (!link) throw new Error('Book now link not rendered');
  return link;
}

describe('OfferDetailsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the offer from the API and renders title, description, discount, eligibility and validity', async () => {
    const { el, service } = await setup();

    expect(service.getPublic).toHaveBeenCalledWith('o1');
    expect(el.querySelector('h1')?.textContent).toContain('Transatlantic Business');
    expect(el.textContent).toContain('Fully flat seats');
    expect(el.textContent).toContain('20% off');
    expect(el.textContent).toContain('FRA → JFK');
    expect(el.textContent).toContain('Business');
    expect(el.textContent).toContain('1 Jan 2026');
    expect(el.textContent).toContain('1 Jan 2027');
    expect(el.textContent).toContain('One-way Business Class fare');
  });

  it('formats a fixed-amount discount as money off', async () => {
    const { el } = await setup({
      getPublic: vi.fn(() => of(offer({ discount: { type: 'FIXED_AMOUNT', value: 50 } }))),
    });

    expect(el.textContent).toContain('€50.00 off');
  });

  it('Book now links to /results with offerId and eligibility prefill', async () => {
    const { el } = await setup();

    const href = bookLink(el).getAttribute('href')!;
    const [path, query] = href.split('?');
    expect(path).toBe('/results');
    const params = new URLSearchParams(query);
    expect(params.get('offerId')).toBe('o1');
    expect(params.get('origin')).toBe('FRA');
    expect(params.get('destination')).toBe('JFK');
    expect(params.get('cabin')).toBe('BUSINESS');
    expect(params.get('depart')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.get('adults')).toBe('1');
  });

  it('Book now goes to /search carrying only the offerId for an unrestricted offer', async () => {
    const { el } = await setup({
      getPublic: vi.fn(() =>
        of(
          offer({
            eligibility: { routeId: null, originIata: null, destinationIata: null, cabinClass: null },
          }),
        ),
      ),
    });

    expect(el.textContent).toContain('All routes');
    expect(el.textContent).toContain('All cabins');
    const href = bookLink(el).getAttribute('href')!;
    const [path, query] = href.split('?');
    // /results requires origin/destination/depart, so unrestricted offers go
    // to /search — which forwards the offerId into the customer's own search.
    expect(path).toBe('/search');
    const params = new URLSearchParams(query);
    expect(params.get('offerId')).toBe('o1');
    expect(params.get('origin')).toBeNull();
    expect(params.get('cabin')).toBeNull();
  });

  it('Book now also goes to /search when only a cabin restriction exists (no route to prefill)', async () => {
    const { el } = await setup({
      getPublic: vi.fn(() =>
        of(
          offer({
            eligibility: { routeId: null, originIata: null, destinationIata: null, cabinClass: 'FIRST' },
          }),
        ),
      ),
    });

    const href = bookLink(el).getAttribute('href')!;
    const [path, query] = href.split('?');
    expect(path).toBe('/search');
    const params = new URLSearchParams(query);
    expect(params.get('offerId')).toBe('o1');
    expect(params.get('origin')).toBeNull();
  });

  it('shows no booking CTA for a marketing-only offer', async () => {
    const { el } = await setup({
      getPublic: vi.fn(() => of(offer({ bookable: false, discount: null, eligibility: null }))),
    });

    expect(el.textContent).not.toContain('Book now');
    expect(el.textContent).toContain('This is a marketing offer');
    // Neither a booking CTA nor a flight-search fallback is offered.
    expect(el.querySelector('aside.card-book a')).toBeNull();
    expect(el.querySelector('a[href="/search"]')).toBeNull();
  });

  it('renders a not-found state on 404', async () => {
    const { el } = await setup({
      getPublic: vi.fn(() => throwError(() => ({ status: 404 }))),
    });

    expect(el.textContent).toContain('Offer not found');
    expect(el.querySelector('na-empty-state')).not.toBeNull();
  });

  it('renders a retryable error state when the API fails', async () => {
    const getPublic = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of(offer()));
    const { fixture, el, service } = await setup({ getPublic });

    expect(el.textContent).toContain('Offer unavailable');
    (el.querySelector('na-alert .alert__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getPublic).toHaveBeenCalledTimes(2);
    expect(el.querySelector('h1')?.textContent).toContain('Transatlantic Business');
  });
});
