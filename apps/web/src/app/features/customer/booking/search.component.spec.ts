import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { SearchPage } from './search.component';
import { FlightService } from '../../../core/services/flight.service';
import type { Airport } from '../../../core/models/domain.model';

const AIRPORTS: Airport[] = [
  { id: 'a-dxb', iataCode: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai', status: 'ACTIVE' },
  { id: 'a-fra', iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin', status: 'ACTIVE' },
  { id: 'a-jfk', iataCode: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA', timezone: 'America/New_York', status: 'ACTIVE' },
];

async function setup(listAirports: ReturnType<typeof vi.fn> = vi.fn(() => of(AIRPORTS))) {
  await TestBed.configureTestingModule({
    imports: [SearchPage],
    providers: [provideRouter([]), { provide: FlightService, useValue: { listAirports } }],
  }).compileComponents();

  const fixture: ComponentFixture<SearchPage> = TestBed.createComponent(SearchPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, listAirports };
}

function typeInAutocomplete(el: HTMLElement, index: number, query: string): void {
  const input = el.querySelectorAll<HTMLInputElement>('na-autocomplete input')[index]!;
  input.value = query;
  input.dispatchEvent(new Event('input'));
}

function pickFirstOption(el: HTMLElement): void {
  const option = el.querySelector<HTMLElement>('.ac__option');
  expect(option, 'expected an autocomplete option to be listed').not.toBeNull();
  option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

describe('SearchPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('loads airports from the flight service and offers them in the autocomplete', async () => {
    const { fixture, el, listAirports } = await setup();
    expect(listAirports).toHaveBeenCalledOnce();

    typeInAutocomplete(el, 0, 'FRA');
    fixture.detectChanges();

    const options = el.querySelectorAll('.ac__option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('FRA — Frankfurt Airport');
    expect(options[0].textContent).toContain('Frankfurt, Germany');
  });

  it('shows a loading state while airports are being fetched', async () => {
    const listAirports = vi.fn(() => new Subject<Airport[]>().asObservable());
    const { el } = await setup(listAirports);

    expect(el.textContent).toContain('Loading airports');
    expect(el.querySelector<HTMLInputElement>('na-autocomplete input')!.disabled).toBe(true);
  });

  it('submits the search and navigates to /results with the form query params', async () => {
    const { fixture, el } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    typeInAutocomplete(el, 0, 'FRA');
    fixture.detectChanges();
    pickFirstOption(el);
    fixture.detectChanges();

    typeInAutocomplete(el, 1, 'JFK');
    fixture.detectChanges();
    pickFirstOption(el);
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('na-button button')!.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(
      ['/results'],
      {
        queryParams: expect.objectContaining({
          tripType: 'ONE_WAY',
          origin: 'FRA',
          destination: 'JFK',
          depart: expect.any(String),
          adults: 1,
          children: 0,
          infants: 0,
          cabin: 'ECONOMY',
        }),
      },
    );
  });

  it('blocks submission until origin and destination differ', async () => {
    const { fixture, el } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    typeInAutocomplete(el, 0, 'FRA');
    fixture.detectChanges();
    pickFirstOption(el);
    fixture.detectChanges();
    typeInAutocomplete(el, 1, 'FRA');
    fixture.detectChanges();
    pickFirstOption(el);
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('na-button button')!.click();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Origin and destination must be different.');
  });

  it('shows a retryable error state when airports fail to load', async () => {
    const listAirports = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('unavailable')))
      .mockReturnValue(of(AIRPORTS));
    const { fixture, el } = await setup(listAirports);

    expect(el.textContent).toContain('Airports unavailable');
    expect(el.querySelector<HTMLInputElement>('na-autocomplete input')!.disabled).toBe(true);

    (el.querySelector('na-alert .alert__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listAirports).toHaveBeenCalledTimes(2);
    expect(el.textContent).not.toContain('Airports unavailable');

    typeInAutocomplete(el, 0, 'JFK');
    fixture.detectChanges();
    expect(el.querySelectorAll('.ac__option').length).toBe(1);
  });

  it('shows an honest empty state when no airports are available', async () => {
    const { el } = await setup(vi.fn(() => of([])));
    expect(el.textContent).toContain('No airports available');
  });
});
