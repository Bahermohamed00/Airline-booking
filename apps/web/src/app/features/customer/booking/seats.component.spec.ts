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

const CATALOG: Seat[] = [BIZ_1A, BIZ_1D, ECO_10A, ECO_10B, ECO_10C, ECO_10D];

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
}

async function setup(opts: SetupOptions = {}) {
  const draftStub = {
    outbound: { id: 'fl-1', aircraftId: 'ac-1' },
    fare: { cabinClass: opts.fareCabin ?? 'ECONOMY' },
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
  const seatAvailability = vi.fn().mockReturnValue(of(AVAILABILITY));
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
});
