import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CompletedFlightsPage } from './completed-flights.component';
import {
  FlightOpsService,
  type CompletedFlightItem,
  type CompletedFlightsPage as Page,
} from './flight-ops.service';

function item(partial: Partial<CompletedFlightItem> = {}): CompletedFlightItem {
  return {
    id: 'fl-1',
    flightNumber: 'NV720',
    publicNumber: 24,
    tripType: 'ROUND_TRIP',
    route: {
      origin: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt' },
      destination: { iataCode: 'JFK', name: 'John F. Kennedy', city: 'New York' },
    },
    aircraft: { registration: 'NV-738Z', model: 'Boeing 737-800' },
    operatingDate: '2026-10-05',
    departureTime: '2026-10-05T08:00:00.000Z',
    arrivalTime: '2026-10-05T10:00:00.000Z',
    status: 'COMPLETED',
    scheduleStatus: 'ONTIME',
    bookedSeats: 142,
    fares: [
      {
        cabinClass: 'ECONOMY',
        basePrice: 250,
        taxAmount: 40,
        feeAmount: 10,
        currency: 'EUR',
        availableCount: 0,
      },
    ],
    ...partial,
  };
}

function page(items: CompletedFlightItem[] = [item()], partial: Partial<Page> = {}): Page {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1, ...partial };
}

function mocks(result: Page = page()) {
  return {
    ops: {
      completed: vi.fn().mockReturnValue(of(result)),
    },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<CompletedFlightsPage>> {
  await TestBed.configureTestingModule({
    imports: [CompletedFlightsPage],
    providers: [provideRouter([]), { provide: FlightOpsService, useValue: m.ops }],
  }).compileComponents();

  const fixture = TestBed.createComponent(CompletedFlightsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function setField(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
}

describe('CompletedFlightsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads completed flights and shows the public FL id, route and booked seats', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.ops.completed).toHaveBeenCalledTimes(1);
    const text = el.textContent!;
    expect(text).toContain('FL-1024'); // 1000 + 24
    expect(text).toContain('NV720');
    expect(text).toContain('FRA → JFK');
    expect(text).toContain('NV-738Z');
    expect(text).toContain('142');
    expect(text).toContain('Round trip');
    expect(text).not.toContain('fl-1'); // UUID stays internal
  });

  it('filters server-side by search and date range, resetting to page 1', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-search', 'FL-1024');
    setField(el, '#filter-from', '2026-10-01');
    setField(el, '#filter-to', '2026-10-07');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.ops.completed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'FL-1024',
        from: '2026-10-01',
        to: '2026-10-07',
        page: 1,
      }),
    );
  });

  it('clear filters resets everything and reloads', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-search', 'NV720');
    fixture.detectChanges();
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.filters__clear na-button button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.ops.completed).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: undefined, from: undefined, to: undefined, page: 1 }),
    );
  });

  it('paginates with Previous/Next through the API', async () => {
    const m = mocks(page([item()], { page: 1, total: 45, totalPages: 3 }));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const buttons = el.querySelectorAll<HTMLElement>('.pagination na-button button');
    expect(buttons[0]!.hasAttribute('disabled')).toBe(true); // Previous on page 1

    buttons[1]!.click(); // Next
    fixture.detectChanges();
    await fixture.whenStable();
    expect(m.ops.completed).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    m.ops.completed.mockReturnValue(of(page([item()], { page: 2, total: 45, totalPages: 3 })));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Page 2 of 3');
  });

  it('opens a read-only detail drawer with flight facts and fares', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('na-data-table tbody tr')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const drawer = el.querySelector('.drawer')!;
    expect(drawer.textContent).toContain('FL-1024');
    expect(drawer.textContent).toContain('NV720');
    expect(drawer.textContent).toContain('Frankfurt Airport');
    expect(drawer.textContent).toContain('Round trip');
    expect(drawer.textContent).toContain('ECONOMY');
    expect(drawer.textContent).toContain('250');
    expect(drawer.querySelector('na-button')).toBeNull(); // no actions — read-only

    drawer.querySelector<HTMLElement>('.drawer__close')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.drawer')).toBeNull();
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.ops.completed.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load completed flights.');

    m.ops.completed.mockReturnValue(of(page()));
    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('FL-1024');
  });
});
