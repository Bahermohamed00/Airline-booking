import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { ExtrasPage } from './extras.component';
import { BookingDraftService } from './booking-draft.service';
import type { BookingDraft, PassengerForm } from '../../../core/models/booking-flow.model';
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

function adult(firstName: string): PassengerForm {
  return { passengerType: 'ADULT', firstName, lastName: 'Hoffmann', dateOfBirth: '', nationality: '', passportNumber: '' };
}

async function setup(f: Fare = fare(RULES)) {
  const draftStub = {
    fare: f,
    passengers: [adult('Lena'), adult('Jonas')],
    baggagePieces: [0, 0],
  } as unknown as BookingDraft;

  const draftService = {
    draft: signal(draftStub),
    fare: computed(() => f),
    passengers: computed(() => draftStub.passengers),
    setExtras: vi.fn(),
    setBaggage: vi.fn(),
  };

  await TestBed.configureTestingModule({
    imports: [ExtrasPage],
    providers: [provideRouter([]), { provide: BookingDraftService, useValue: draftService }],
  }).compileComponents();

  const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture: ComponentFixture<ExtrasPage> = TestBed.createComponent(ExtrasPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, draftService, navigateSpy };
}

describe('ExtrasPage (no extras backend)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('states clearly that ancillary services are unavailable and not part of the total', async () => {
    const { el } = await setup();
    const notice = el.querySelector('na-alert .alert--info');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain('Ancillary services are not yet available');
    expect(notice?.textContent).toContain('included in your booking total');
  });

  it('disables every selection control', async () => {
    const { el } = await setup();
    // All steppers sit inside a disabled fieldset, which disables every
    // nested control natively (the .disabled IDL property does not reflect
    // fieldset inheritance, so assert on the fieldset itself).
    const fieldset = el.querySelector<HTMLFieldSetElement>('fieldset.bag-fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset!.disabled).toBe(true);
    const steppers = el.querySelectorAll('fieldset.bag-fieldset na-quantity-stepper');
    expect(steppers.length).toBe(2);
  });

  it('shows only fare × passengers in the summary — no extras or baggage lines', async () => {
    const { el } = await setup();
    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('€200.00'); // base 100 × 2
    expect(table).toContain('€40.00'); // taxes 20 × 2
    expect(table).toContain('€10.00'); // fees 5 × 2
    expect(table).toContain('€250.00'); // total
    expect(table).not.toContain('Add-ons');
    expect(table).not.toContain('baggage');
    expect(table).not.toContain('Promo');
  });

  it('renders the fare allowance only when the API provides rules', async () => {
    const withRules = await setup(fare(RULES));
    expect(withRules.el.textContent).toContain('Included in your fare');

    TestBed.resetTestingModule();
    const withoutRules = await setup(fare(null));
    expect(withoutRules.el.textContent).not.toContain('Included in your fare');
  });

  it('clears extras and baggage in the draft and continues to review', async () => {
    const { el, draftService, navigateSpy } = await setup();
    const continueHost = Array.from(el.querySelectorAll<HTMLElement>('na-button')).find((b) =>
      b.textContent?.includes('Review booking'),
    )!;
    continueHost.querySelector('button')!.click();

    expect(draftService.setExtras).toHaveBeenCalledWith([]);
    expect(draftService.setBaggage).toHaveBeenCalledWith([0, 0]);
    expect(navigateSpy).toHaveBeenCalledWith('/booking/review');
  });
});
