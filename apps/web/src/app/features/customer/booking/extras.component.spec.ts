import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ExtrasPage } from './extras.component';
import { BookingDraftService } from './booking-draft.service';
import { ExtrasCatalogService } from '../../../core/services/extras-catalog.service';
import type { BookingDraft, ExtraSelection, PassengerForm } from '../../../core/models/booking-flow.model';
import type { ExtraCatalogItem, ExtrasQuote } from '../../../core/models/extras.model';
import type { Fare, FareRule } from '../../../core/models/domain.model';

const RULES: FareRule = {
  refundable: false,
  changeAllowed: true,
  changeFee: 90,
  cancellationFeePercent: 100,
  checkedBaggagePieces: 1,
  checkedBaggageWeightKg: 23,
  carryOnPieces: 1,
  seatSelectionFee: 0,
  priorityBoarding: false,
  loungeAccess: false,
  description: 'Economy Light',
};

function fare(rules: FareRule | null): Fare {
  return {
    id: 'fare-1',
    flightId: 'fl-1',
    cabinClass: 'ECONOMY',
    basePrice: 100,
    taxAmount: 20,
    feeAmount: 5,
    currency: 'EUR',
    availableCount: 9,
    rules,
  };
}

function item(overrides: Partial<ExtraCatalogItem>): ExtraCatalogItem {
  return {
    id: 'x-' + Math.random().toString(36).slice(2, 8),
    code: 'XTRA',
    name: 'Extra',
    description: null,
    category: 'MEAL',
    pricingUnit: 'PER_ITEM',
    price: 10,
    currency: 'EUR',
    maxQuantity: 2,
    requiresPassenger: false,
    validFrom: null,
    validTo: null,
    bagWeightKg: null,
    dietaryTags: [],
    demonstration: false,
    ...overrides,
  };
}

const BAG = item({
  id: 'svc-bag',
  code: 'BAG_23KG',
  name: 'Extra checked bag (23 kg)',
  category: 'BAGGAGE',
  price: 65,
  maxQuantity: 3,
  requiresPassenger: true,
  bagWeightKg: 23,
});
const MEAL = item({
  id: 'svc-meal',
  code: 'MEAL_HOT',
  name: 'Hot meal',
  category: 'MEAL',
  price: 12.5,
  maxQuantity: 1,
  requiresPassenger: true,
  dietaryTags: ['vegetarian'],
});
const PRIO_BOARD = item({
  id: 'svc-prio',
  code: 'PRIORITY_BOARDING',
  name: 'Priority boarding',
  category: 'PRIORITY',
  pricingUnit: 'PER_PASSENGER',
  price: 15,
  maxQuantity: 1,
  requiresPassenger: true,
});
const PRIO_CHECKIN = item({
  id: 'svc-checkin',
  code: 'PRIORITY_CHECKIN',
  name: 'Priority check-in',
  category: 'PRIORITY',
  pricingUnit: 'PER_BOOKING',
  price: 10,
});
const INS_DEMO = item({
  id: 'svc-ins',
  code: 'INS_DEMO_BASIC',
  name: 'Travel insurance (demonstration)',
  category: 'INSURANCE',
  pricingUnit: 'PER_PASSENGER',
  price: 9.99,
  maxQuantity: 1,
  requiresPassenger: true,
  demonstration: true,
});

const CATALOG = [BAG, MEAL, PRIO_BOARD, PRIO_CHECKIN, INS_DEMO];

function quoteFor(selections: ExtraSelection[]): ExtrasQuote {
  const lines = selections.map((s) => ({
    serviceId: s.service.id,
    code: s.service.code,
    name: s.service.name,
    category: s.service.category,
    pricingUnit: s.service.pricingUnit,
    quantity: s.quantity,
    passengerIndex: s.passengerIndex,
    unitPrice: s.service.price,
    totalPrice: s.service.price * s.quantity,
  }));
  return {
    currency: 'EUR',
    lines,
    extrasTotal: lines.reduce((sum, l) => sum + l.totalPrice, 0),
  };
}

function adult(firstName: string): PassengerForm {
  return { passengerType: 'ADULT', firstName, lastName: 'Hoffmann', dateOfBirth: '', nationality: '', passportNumber: '' };
}

interface SetupOptions {
  fare?: Fare;
  extras?: ExtraSelection[];
  catalogItems?: ExtraCatalogItem[];
  catalogFails?: boolean;
  quoteFails?: boolean;
}

async function setup(opts: SetupOptions = {}) {
  const f = opts.fare ?? fare(RULES);
  const draftStub = {
    fare: f,
    outbound: {
      id: 'fl-1',
      flightNumber: 'NV123',
      departureTime: '2026-10-01T09:30:00.000Z',
      route: {
        origin: { iataCode: 'FRA', city: 'Frankfurt' },
        destination: { iataCode: 'JFK', city: 'New York' },
      },
    },
    passengers: [adult('Lena'), adult('Jonas')],
    extras: opts.extras ?? [],
    baggagePieces: [0, 0],
  } as unknown as BookingDraft;

  const draftService = {
    draft: signal(draftStub),
    fare: computed(() => f),
    passengers: computed(() => draftStub.passengers),
    setExtras: vi.fn(),
    setBaggage: vi.fn(),
  };

  const catalog = opts.catalogFails
    ? vi.fn().mockReturnValue(throwError(() => new Error('down')))
    : vi.fn().mockReturnValue(of(opts.catalogItems ?? CATALOG));
  const quote = vi.fn().mockImplementation((req: { selections: { serviceId: string; quantity: number; passengerIndex?: number }[] }) => {
    if (opts.quoteFails) return throwError(() => ({ status: 400, error: { code: 'EXTRAS_INVALID' } }));
    // Quote whatever the component currently sent: resolve prices from the catalog.
    const current = req.selections.map((r) => ({
      service: (opts.catalogItems ?? CATALOG).find((c) => c.id === r.serviceId)!,
      quantity: r.quantity,
      passengerIndex: r.passengerIndex ?? null,
    }));
    return of(quoteFor(current));
  });

  await TestBed.configureTestingModule({
    imports: [ExtrasPage],
    providers: [
      provideRouter([]),
      { provide: BookingDraftService, useValue: draftService },
      { provide: ExtrasCatalogService, useValue: { catalog, quote } },
    ],
  }).compileComponents();

  const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture: ComponentFixture<ExtrasPage> = TestBed.createComponent(ExtrasPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, draftService, catalog, quote, navigateSpy };
}

async function settle(fixture: ComponentFixture<ExtrasPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Click the "+" button of the stepper whose label contains the text. */
function bumpStepper(el: HTMLElement, labelPart: string): void {
  const host = Array.from(el.querySelectorAll<HTMLElement>('na-quantity-stepper')).find((h) =>
    h.textContent?.includes(labelPart),
  );
  if (!host) throw new Error(`stepper "${labelPart}" not found`);
  const plus = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.getAttribute('aria-label')?.startsWith('Increase'),
  );
  if (!plus) throw new Error(`plus button for "${labelPart}" not found`);
  plus.click();
}

/** Bump a stepper N times with change detection between clicks (inputs refresh per cycle). */
async function bumpTimes(fixture: ComponentFixture<ExtrasPage>, el: HTMLElement, labelPart: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    bumpStepper(el, labelPart);
    await settle(fixture);
  }
}

function toggleButton(el: HTMLElement, name: string): HTMLButtonElement {
  const btn = Array.from(el.querySelectorAll<HTMLButtonElement>('.pax-toggle')).find((b) =>
    b.textContent?.includes(name),
  );
  if (!btn) throw new Error(`toggle "${name}" not found`);
  return btn;
}

describe('ExtrasPage (real catalog)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the catalog for the draft flight and cabin and groups items by category', async () => {
    const { el, catalog } = await setup();
    expect(catalog).toHaveBeenCalledWith({ flightId: 'fl-1', cabinClass: 'ECONOMY' });
    expect(el.textContent).toContain('Extra checked bags');
    expect(el.textContent).toContain('Meals & drinks');
    expect(el.textContent).toContain('Priority services');
    expect(el.textContent).toContain('Travel insurance');
    expect(el.textContent).toContain('Extra checked bag (23 kg)');
    expect(el.textContent).toContain('€65.00');
    expect(el.textContent).toContain('per bag');
    expect(el.textContent).toContain('Hot meal');
    expect(el.textContent).toContain('Dietary: vegetarian');
  });

  it('shows a retryable error state when the catalog fails', async () => {
    const { el } = await setup({ catalogFails: true });
    expect(el.textContent).toContain("couldn't load the extras catalog");
    expect(el.querySelector('.alert__retry')).not.toBeNull();
  });

  it('shows an empty state when no extras are available for the flight', async () => {
    const { el } = await setup({ catalogItems: [] });
    expect(el.textContent).toContain('No add-on services are available for this flight');
    expect(el.querySelector('na-quantity-stepper')).toBeNull();
  });

  it('adds a per-passenger quantity item and prices it via the server quote', async () => {
    const { fixture, el, draftService, quote } = await setup();
    bumpStepper(el, 'Extra checked bag (23 kg) for Lena');
    await settle(fixture);

    expect(draftService.setExtras).toHaveBeenCalledWith([{ service: BAG, quantity: 1, passengerIndex: 0 }]);
    expect(quote).toHaveBeenCalledWith({
      flightId: 'fl-1',
      cabinClass: 'ECONOMY',
      passengerCount: 2,
      selections: [{ serviceId: 'svc-bag', quantity: 1, passengerIndex: 0 }],
    });
    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('Extra checked bag (23 kg)');
    expect(table).toContain('€65.00');
    // Total = fare 250 + bag 65
    expect(table).toContain('€315.00');
  });

  it('clamps quantities to the catalog maxQuantity', async () => {
    const { fixture, el, draftService } = await setup();
    // BAG.maxQuantity is 3 — four increases stay at 3.
    await bumpTimes(fixture, el, 'Extra checked bag (23 kg) for Lena', 4);
    const lastCall = draftService.setExtras.mock.calls.at(-1)![0] as ExtraSelection[];
    expect(lastCall).toEqual([{ service: BAG, quantity: 3, passengerIndex: 0 }]);
  });

  it('toggles per-passenger services and prevents duplicates', async () => {
    const { fixture, el, draftService } = await setup();
    const toggle = toggleButton(el, 'Lena');
    // First PER_PASSENGER card is priority boarding.
    expect(toggle.closest('li')).not.toBeNull();
    toggle.click();
    await settle(fixture);
    let lastCall = draftService.setExtras.mock.calls.at(-1)![0] as ExtraSelection[];
    expect(lastCall).toEqual([{ service: PRIO_BOARD, quantity: 1, passengerIndex: 0 }]);

    // Toggling again removes the selection.
    toggleButton(el, 'Lena').click();
    await settle(fixture);
    lastCall = draftService.setExtras.mock.calls.at(-1)![0] as ExtraSelection[];
    expect(lastCall).toEqual([]);
  });

  it('adds a per-booking service once for the whole booking', async () => {
    const { fixture, el, draftService } = await setup();
    toggleButton(el, 'Whole booking').click();
    await settle(fixture);
    const lastCall = draftService.setExtras.mock.calls.at(-1)![0] as ExtraSelection[];
    expect(lastCall).toEqual([{ service: PRIO_CHECKIN, quantity: 1, passengerIndex: null }]);
    const req = (await setupQuoteRequests(fixture)).at(-1);
    expect(req?.selections).toEqual([{ serviceId: 'svc-checkin', quantity: 1 }]);
  });

  it('marks demonstration insurance products without claiming real coverage', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Demonstration — not real coverage');
    // No acceptance/policy UI is offered for a demo product.
    expect(el.textContent).not.toMatch(/policy number|certificate|coverage confirmation/i);
  });

  it('restores draft selections, dropping ones that vanished from the catalog', async () => {
    const stale: ExtraSelection[] = [
      { service: BAG, quantity: 1, passengerIndex: 0 },
      { service: item({ id: 'svc-gone', code: 'GONE', name: 'Gone' }), quantity: 1, passengerIndex: null },
    ];
    const { fixture, el, draftService } = await setup({ extras: stale });
    await settle(fixture);
    expect(el.textContent).toContain('Your extras were updated');
    const lastCall = draftService.setExtras.mock.calls.at(-1)![0] as ExtraSelection[];
    expect(lastCall).toEqual([{ service: BAG, quantity: 1, passengerIndex: 0 }]);
    expect(el.querySelector('.side__table')?.textContent).toContain('€65.00');
  });

  it('clamps a stored selection whose quantity exceeds the current maxQuantity', async () => {
    const stale: ExtraSelection[] = [{ service: BAG, quantity: 3, passengerIndex: 1 }];
    const smallerBag = { ...BAG, maxQuantity: 1 };
    const { fixture, draftService } = await setup({ extras: stale, catalogItems: [smallerBag] });
    await settle(fixture);
    const lastCall = draftService.setExtras.mock.calls.at(-1)![0] as ExtraSelection[];
    expect(lastCall).toEqual([{ service: smallerBag, quantity: 1, passengerIndex: 1 }]);
  });

  it('shows an alert when the server quote rejects the selection', async () => {
    const { fixture, el } = await setup({ quoteFails: true });
    bumpStepper(el, 'Extra checked bag (23 kg) for Lena');
    await settle(fixture);
    expect(el.textContent).toContain('Prices could not be confirmed');
  });

  it('continues to review with the selections stored in the draft', async () => {
    const { fixture, el, draftService, navigateSpy } = await setup();
    bumpStepper(el, 'Extra checked bag (23 kg) for Lena');
    await settle(fixture);

    const continueHost = Array.from(el.querySelectorAll<HTMLElement>('na-button')).find((b) =>
      b.textContent?.includes('Review booking'),
    )!;
    continueHost.querySelector('button')!.click();

    expect(draftService.setExtras).toHaveBeenLastCalledWith([{ service: BAG, quantity: 1, passengerIndex: 0 }]);
    expect(draftService.setBaggage).toHaveBeenCalledWith([0, 0]);
    expect(navigateSpy).toHaveBeenCalledWith('/booking/review');
  });

  it('renders the fare allowance only from API-provided rules', async () => {
    const withRules = await setup();
    expect(withRules.el.textContent).toContain('1× checked bag up to 23 kg per passenger');

    TestBed.resetTestingModule();
    const withoutRules = await setup({ fare: fare(null) });
    expect(withoutRules.el.textContent).not.toContain('checked bag up to');
  });

  it('keeps the fare rows consistent with the draft (fare × travellers)', async () => {
    const { el } = await setup();
    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('€200.00'); // base 100 × 2
    expect(table).toContain('€40.00'); // taxes 20 × 2
    expect(table).toContain('€10.00'); // fees 5 × 2
    expect(table).toContain('€250.00'); // fare total, no extras
  });
});

/** Helper: read all quote requests issued so far. */
async function setupQuoteRequests(
  fixture: ComponentFixture<ExtrasPage>,
): Promise<Array<{ selections: unknown[] }>> {
  void fixture;
  const svc = TestBed.inject(ExtrasCatalogService) as unknown as { quote: ReturnType<typeof vi.fn> };
  return svc.quote.mock.calls.map((c) => c[0]);
}
