import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SeatsPage } from './seats.component';
import { BookingDraftService } from './booking-draft.service';
import { SeatService, type SeatAvailability } from './seat.service';
import type { BookingDraft, PassengerForm, SeatSelection } from '../../../core/models/booking-flow.model';
import type { CabinClass, Seat } from '../../../core/models/domain.model';

function seat(id: string, no: string, cabin: CabinClass, row: number, col: string, isExitRow = false): Seat {
  return { id, aircraftId: 'ac-1', seatNumber: no, cabinClass: cabin, seatRow: row, seatColumn: col, isExitRow };
}

const BIZ_1A = seat('s-b-1a', '1A', 'BUSINESS', 1, 'A');
const BIZ_1D = seat('s-b-1d', '1D', 'BUSINESS', 1, 'D');
const ECO_10A = seat('s-e-10a', '10A', 'ECONOMY', 10, 'A');
const ECO_10B = seat('s-e-10b', '10B', 'ECONOMY', 10, 'B');
const ECO_10C = seat('s-e-10c', '10C', 'ECONOMY', 10, 'C');
const ECO_10D = seat('s-e-10d', '10D', 'ECONOMY', 10, 'D');
const ECO_10E = seat('s-e-10e', '10E', 'ECONOMY', 10, 'E');
const ECO_10F = seat('s-e-10f', '10F', 'ECONOMY', 10, 'F');
const ECO_12A = seat('s-e-12a', '12A', 'ECONOMY', 12, 'A', true);

const CATALOG: Seat[] = [BIZ_1A, BIZ_1D, ECO_10A, ECO_10B, ECO_10C, ECO_10D, ECO_10E, ECO_10F, ECO_12A];

const AVAILABILITY: SeatAvailability = {
  flightId: 'fl-1',
  occupiedSeatIds: ['s-e-10b'],
  heldSeatIds: ['s-e-10c'],
};

function adult(firstName: string): PassengerForm {
  return { passengerType: 'ADULT', firstName, lastName: 'Hoffmann', dateOfBirth: '', nationality: '', passportNumber: '' };
}

interface SetupOptions {
  seats?: SeatSelection[];
  fareCabin?: CabinClass;
  catalogFailsOnce?: boolean;
  availability?: SeatAvailability;
  farePrices?: boolean;
}

async function setup(opts: SetupOptions = {}) {
  const draftStub = {
    outbound: { id: 'fl-1', aircraftId: 'ac-1' },
    fare: opts.farePrices
      ? { cabinClass: opts.fareCabin ?? 'ECONOMY', basePrice: 100, taxAmount: 20, feeAmount: 5, currency: 'EUR' }
      : { cabinClass: opts.fareCabin ?? 'ECONOMY' },
    passengers: [adult('Lena'), adult('Jonas')],
    seats: opts.seats ?? [],
  } as unknown as BookingDraft;

  const draftService = {
    draft: signal(draftStub),
    passengers: computed(() => draftStub.passengers),
    seatHoldExpiresAt: signal<string | null>(null),
    isHoldExpired: vi.fn(() => false),
    releaseHold: vi.fn(),
    setSeats: vi.fn(),
  };

  const seatCatalog = opts.catalogFailsOnce
    ? vi.fn().mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(CATALOG))
    : vi.fn().mockReturnValue(of(CATALOG));
  const seatAvailability = vi.fn().mockReturnValue(of(opts.availability ?? AVAILABILITY));
  const seatService = Object.assign(Object.create(SeatService.prototype) as SeatService, {
    seatCatalog,
    seatAvailability,
  });

  await TestBed.configureTestingModule({
    imports: [SeatsPage],
    providers: [
      provideRouter([]),
      { provide: BookingDraftService, useValue: draftService },
      { provide: SeatService, useValue: seatService },
    ],
  }).compileComponents();

  const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture: ComponentFixture<SeatsPage> = TestBed.createComponent(SeatsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, draftService, seatCatalog, seatAvailability, navigateSpy };
}

async function settle(fixture: ComponentFixture<SeatsPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function seatButton(el: HTMLElement, no: string): HTMLButtonElement {
  const btn = Array.from(el.querySelectorAll<HTMLButtonElement>('.seat')).find(
    (b) => b.querySelector('.seat__no')?.textContent === no,
  );
  if (!btn) throw new Error(`seat ${no} not rendered`);
  return btn;
}

function continueButton(el: HTMLElement): HTMLButtonElement {
  const host = Array.from(el.querySelectorAll<HTMLElement>('na-button')).find((b) =>
    b.textContent?.includes('Continue to extras'),
  );
  const btn = host?.querySelector('button');
  if (!btn) throw new Error('continue button not rendered');
  return btn;
}

describe('SeatsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the catalog and per-flight availability through the seat service', async () => {
    const { el, seatCatalog, seatAvailability } = await setup();
    expect(seatCatalog).toHaveBeenCalledWith('ac-1');
    expect(seatAvailability).toHaveBeenCalledWith('fl-1');
    // Both occupied and held seats render disabled; free economy seats do not.
    expect(seatButton(el, '10B').disabled).toBe(true);
    expect(seatButton(el, '10C').disabled).toBe(true);
    expect(seatButton(el, '10A').disabled).toBe(false);
    expect(seatButton(el, '10D').disabled).toBe(false);
  });

  it('restricts selectable seats to the draft fare cabin', async () => {
    const { fixture, el } = await setup();
    const businessSeat = seatButton(el, '1A');
    expect(businessSeat.disabled).toBe(true);
    expect(businessSeat.getAttribute('aria-label')).toContain('not available with your fare');

    businessSeat.click();
    await settle(fixture);
    expect(fixture.componentInstance['selections']()).toEqual([]);

    const economySeat = seatButton(el, '10A');
    economySeat.click();
    await settle(fixture);
    expect(economySeat.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.side__list li strong')?.textContent).toContain('10A');
  });

  it('shows a retryable error state when the catalog fails to load', async () => {
    const { fixture, el, seatCatalog } = await setup({ catalogFailsOnce: true });
    expect(el.querySelector('.alert--danger')).not.toBeNull();
    expect(el.textContent).toContain("couldn't load the seat map");

    (el.querySelector('.alert__retry') as HTMLButtonElement).click();
    await settle(fixture);
    expect(seatCatalog).toHaveBeenCalledTimes(2);
    expect(seatButton(el, '10A').disabled).toBe(false);
  });

  it('drops previously-selected seats that are now unavailable and informs the user', async () => {
    const { el } = await setup({
      seats: [
        { passengerIndex: 0, seat: ECO_10B },
        { passengerIndex: 1, seat: ECO_10A },
      ],
    });
    expect(el.textContent).toContain('no longer available');
    // The occupied 10B was dropped; the still-free 10A survived.
    expect(seatButton(el, '10B').getAttribute('aria-pressed')).toBe('false');
    expect(seatButton(el, '10A').getAttribute('aria-pressed')).toBe('true');
    const summaryRows = Array.from(el.querySelectorAll<HTMLElement>('.side__list li strong'));
    expect(summaryRows[0].textContent).toContain('—');
    expect(summaryRows[1].textContent).toContain('10A');
  });

  it('stores one seat per traveller in the draft and continues to extras', async () => {
    const { fixture, el, draftService, navigateSpy } = await setup();
    seatButton(el, '10A').click();
    await settle(fixture);
    seatButton(el, '10D').click();
    await settle(fixture);

    continueButton(el).click();
    await settle(fixture);

    expect(draftService.setSeats).toHaveBeenCalledWith(
      [
        { passengerIndex: 0, seat: ECO_10A },
        { passengerIndex: 1, seat: ECO_10D },
      ],
      [],
    );
    expect(navigateSpy).toHaveBeenCalledWith('/booking/extras');
  });

  it('no longer promises that seats can be skipped', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toMatch(/skip/i);
    expect(el.textContent).toContain('Select a seat for each traveller');
  });

  it('disables Continue and shows progress until every traveller has a seat', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('.side__progress')?.textContent).toContain('0 of 2 selected');
    expect(continueButton(el).disabled).toBe(true);

    seatButton(el, '10A').click();
    await settle(fixture);
    expect(el.querySelector('.side__progress')?.textContent).toContain('1 of 2 selected');
    expect(continueButton(el).disabled).toBe(true);

    seatButton(el, '10D').click();
    await settle(fixture);
    expect(el.querySelector('.side__progress')?.textContent).toContain('2 of 2 selected');
    expect(continueButton(el).disabled).toBe(false);
  });

  it('continue() itself refuses to proceed with missing seats', async () => {
    const { fixture, draftService, navigateSpy } = await setup();
    (fixture.componentInstance as any).continue();
    expect(draftService.setSeats).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('groups rows into labelled cabin sections from the seat data', async () => {
    const { el } = await setup();
    const sections = Array.from(el.querySelectorAll<HTMLElement>('.seatmap__section')).map((s) => s.textContent);
    expect(sections.length).toBe(2);
    expect(sections[0]).toContain('Business');
    expect(sections[0]).toContain('Rows 1–1');
    expect(sections[1]).toContain('Economy');
    expect(sections[1]).toContain('Rows 10–12');
  });

  it('labels seat positions (window / middle / aisle) from the actual columns', async () => {
    const { el } = await setup();
    expect(seatButton(el, '10A').getAttribute('aria-label')).toContain('window seat');
    expect(seatButton(el, '10B').getAttribute('aria-label')).toContain('middle seat');
    expect(seatButton(el, '10C').getAttribute('aria-label')).toContain('aisle seat');
    expect(seatButton(el, '10D').getAttribute('aria-label')).toContain('aisle seat');
    expect(seatButton(el, '10F').getAttribute('aria-label')).toContain('window seat');
  });

  it('marks exit rows with indicators and extra-legroom labels', async () => {
    const { el } = await setup();
    const exitSeat = seatButton(el, '12A');
    expect(exitSeat.getAttribute('aria-label')).toContain('exit row, extra legroom');
    expect(exitSeat.disabled).toBe(false);
    const exitRow = exitSeat.closest('.seatmap__row--exit');
    expect(exitRow).not.toBeNull();
    expect(exitRow!.querySelectorAll('.seatmap__exit').length).toBe(2);
  });

  it('never makes an occupied exit-row seat selectable', async () => {
    const { el } = await setup({
      availability: { flightId: 'fl-1', occupiedSeatIds: ['s-e-12a'], heldSeatIds: [] },
    });
    const exitSeat = seatButton(el, '12A');
    expect(exitSeat.disabled).toBe(true);
    expect(exitSeat.classList.contains('seat--occupied')).toBe(true);
    expect(exitSeat.getAttribute('aria-pressed')).toBe('false');
    expect(exitSeat.getAttribute('aria-label')).toContain('Occupied');
  });

  it('deselects a seat when it is clicked again', async () => {
    const { fixture, el } = await setup();
    seatButton(el, '10A').click();
    await settle(fixture);
    expect(seatButton(el, '10A').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.side__progress')?.textContent).toContain('1 of 2 selected');

    // The click auto-advanced to passenger 2; deselecting 10A must not steal it.
    seatButton(el, '10A').click();
    await settle(fixture);
    expect(seatButton(el, '10A').getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('.side__progress')?.textContent).toContain('0 of 2 selected');
  });

  it('shows the current total with seats included at no charge', async () => {
    const { fixture, el } = await setup({ farePrices: true });
    seatButton(el, '10A').click();
    await settle(fixture);
    seatButton(el, '10D').click();
    await settle(fixture);

    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('Seats');
    expect(table).toContain('Included');
    expect(table).toContain('€250.00'); // (100 + 20 + 5) × 2 travellers
    expect(el.textContent).toContain('Seat selection is included in your fare');
  });

  it('shows a sold-out notice when no seat in the fare cabin is selectable', async () => {
    const { el } = await setup({
      availability: {
        flightId: 'fl-1',
        occupiedSeatIds: ['s-e-10a', 's-e-10b', 's-e-10c', 's-e-10d', 's-e-10e', 's-e-10f', 's-e-12a'],
        heldSeatIds: [],
      },
    });
    expect(el.textContent).toContain('No seats left in your cabin');
    expect(continueButton(el).disabled).toBe(true);
  });
});
