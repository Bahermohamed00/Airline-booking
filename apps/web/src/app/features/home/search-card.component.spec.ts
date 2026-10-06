import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SearchCard } from './search-card.component';
import { FlightService } from '../../core/services/flight.service';
import type { Airport } from '../../core/models/domain.model';

const AIRPORTS: Airport[] = [
  {
    id: 'a-fra',
    iataCode: 'FRA',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    status: 'ACTIVE',
  },
  {
    id: 'a-jfk',
    iataCode: 'JFK',
    name: 'John F. Kennedy International',
    city: 'New York',
    country: 'USA',
    timezone: 'America/New_York',
    status: 'ACTIVE',
  },
];

async function setup(listAirports: ReturnType<typeof vi.fn> = vi.fn(() => of(AIRPORTS))) {
  await TestBed.configureTestingModule({
    imports: [SearchCard],
    providers: [provideRouter([]), { provide: FlightService, useValue: { listAirports } }],
  }).compileComponents();

  const fixture: ComponentFixture<SearchCard> = TestBed.createComponent(SearchCard);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, listAirports };
}

describe('SearchCard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('clamps the return date when departure moves past it', async () => {
    const { fixture, el } = await setup();

    const depart = el.querySelector<HTMLInputElement>('#hs-depart')!;
    const returnInput = el.querySelector<HTMLInputElement>('#hs-return')!;
    const before = returnInput.value;

    depart.value = '2099-06-15';
    depart.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(before).not.toBe('2099-06-15');
    expect(returnInput.value).toBe('2099-06-15');
  });

  it('shows an error when no destination is selected', async () => {
    const { fixture, el } = await setup();

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(el.querySelector('.card__error')?.textContent).toContain('origin and a destination');
  });

  it('loads airports from the flight service into the origin/destination selects', async () => {
    const { el, listAirports } = await setup();
    expect(listAirports).toHaveBeenCalledOnce();

    const from = el.querySelector<HTMLSelectElement>('#hs-from')!;
    const to = el.querySelector<HTMLSelectElement>('#hs-to')!;
    for (const select of [from, to]) {
      const labels = Array.from(select.options).map((o) => o.textContent);
      expect(labels).toContain('Frankfurt (FRA)');
      expect(labels).toContain('New York (JFK)');
      expect(select.disabled).toBe(false);
    }
  });

  it('shows a retryable error state when airports fail to load', async () => {
    const listAirports = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('unavailable')))
      .mockReturnValue(of(AIRPORTS));
    const { fixture, el } = await setup(listAirports);

    expect(el.querySelector('.card__error')?.textContent).toContain(
      "couldn't load the airport list",
    );
    expect(el.querySelector<HTMLSelectElement>('#hs-from')!.disabled).toBe(true);

    (el.querySelector('.card__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listAirports).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.card__error')).toBeNull();
    const from = el.querySelector<HTMLSelectElement>('#hs-from')!;
    expect(from.disabled).toBe(false);
    expect(Array.from(from.options).map((o) => o.textContent)).toContain('Frankfurt (FRA)');
  });

  it('shows an honest empty state when no airports are available', async () => {
    const { el } = await setup(vi.fn(() => of([])));
    expect(el.querySelector('.card__error')?.textContent).toContain('No airports are available');
  });
});
