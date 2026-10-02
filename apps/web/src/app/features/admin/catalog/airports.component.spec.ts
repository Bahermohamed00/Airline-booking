import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AirportsPage } from './airports.component';
import { CatalogService } from '../../../core/services/catalog.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Airport, Route } from '../../../core/models/domain.model';

function airport(partial: Partial<Airport> = {}): Airport {
  return {
    id: 'airport-fra',
    iataCode: 'FRA',
    icaoCode: 'EDDF',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    status: 'ACTIVE',
    ...partial,
  };
}

function jfk(partial: Partial<Airport> = {}): Airport {
  return airport({
    id: 'airport-jfk',
    iataCode: 'JFK',
    icaoCode: 'KJFK',
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States',
    timezone: 'America/New_York',
    ...partial,
  });
}

function route(partial: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    originAirportId: 'airport-fra',
    destinationAirportId: 'airport-jfk',
    origin: airport(),
    destination: jfk(),
    distanceKm: 6200,
    durationMinutes: 480,
    status: 'ACTIVE',
    ...partial,
  };
}

function mocks(airports: Airport[] = [airport()], routes: Route[] = [route()]) {
  return {
    catalog: {
      listAirports: vi.fn().mockReturnValue(of(airports)),
      listRoutes: vi.fn().mockReturnValue(of(routes)),
      createAirport: vi.fn().mockReturnValue(of(jfk())),
      updateAirport: vi.fn().mockReturnValue(of(airport({ status: 'INACTIVE' }))),
    },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AirportsPage>> {
  await TestBed.configureTestingModule({
    imports: [AirportsPage],
    providers: [
      provideRouter([]),
      { provide: CatalogService, useValue: m.catalog },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AirportsPage);
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

function submitDrawer(el: HTMLElement): void {
  el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
}

function fact(el: HTMLElement, label: string): string | null | undefined {
  const dt = [...el.querySelectorAll('.facts dt')].find((d) => d.textContent?.trim() === label);
  return dt?.parentElement?.querySelector('dd')?.textContent?.trim();
}

async function openCreateDrawer(fixture: ComponentFixture<AirportsPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.page__head na-button button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AirportsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads airports and routes from the API exactly once', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.catalog.listAirports).toHaveBeenCalledTimes(1);
    expect(m.catalog.listRoutes).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('FRA');
    expect(el.textContent).toContain('Frankfurt Airport');
  });

  it('shows the loading skeleton until the catalog responds', async () => {
    const m = mocks();
    const airports$ = new Subject<Airport[]>();
    const routes$ = new Subject<Route[]>();
    m.catalog.listAirports.mockReturnValue(airports$.asObservable());
    m.catalog.listRoutes.mockReturnValue(routes$.asObservable());

    await TestBed.configureTestingModule({
      imports: [AirportsPage],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: m.catalog },
        { provide: ToastService, useValue: m.toast },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AirportsPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('na-skeleton')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();

    airports$.next([airport()]);
    airports$.complete();
    routes$.next([route()]);
    routes$.complete();
    fixture.detectChanges();

    expect(el.querySelector('na-skeleton')).toBeNull();
    expect(el.textContent).toContain('FRA');
  });

  it('shows an empty state when the catalog is empty', async () => {
    const fixture = await setup(mocks([], []));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No airports');
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.catalog.listAirports
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([airport()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load the airport catalog.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.listAirports).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('FRA');
  });

  it('creates an airport through the API with a DTO-only payload', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ap-iata', 'jfk');
    setField(el, '#ap-name', 'John F. Kennedy International Airport');
    setField(el, '#ap-city', 'New York');
    setField(el, '#ap-country', 'United States');
    setField(el, '#ap-tz', 'America/New_York');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.createAirport).toHaveBeenCalledTimes(1);
    const payload = m.catalog.createAirport.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toEqual({
      iataCode: 'JFK',
      name: 'John F. Kennedy International Airport',
      city: 'New York',
      country: 'United States',
      timezone: 'America/New_York',
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('icaoCode');
    expect(m.toast.success).toHaveBeenCalledWith('Airport JFK added to the catalog.');
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('blocks invalid IATA codes client-side without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ap-iata', 'FR');
    setField(el, '#ap-name', 'Nowhere Airport');
    setField(el, '#ap-city', 'Nowhere');
    setField(el, '#ap-country', 'Nowhereland');
    setField(el, '#ap-tz', 'Europe/Berlin');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.catalog.createAirport).not.toHaveBeenCalled();
    expect(el.textContent).toContain('IATA code must be exactly three uppercase letters.');
  });

  it('shows the duplicate-IATA message when the API returns 409', async () => {
    const m = mocks();
    m.catalog.createAirport.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ap-iata', 'JFK');
    setField(el, '#ap-name', 'John F. Kennedy International Airport');
    setField(el, '#ap-city', 'New York');
    setField(el, '#ap-country', 'United States');
    setField(el, '#ap-tz', 'America/New_York');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('An airport with this IATA code already exists.');
    expect(el.querySelector('.drawer')).not.toBeNull();
  });

  it('deactivates an airport via PATCH {status} and updates the row from the response', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    el.querySelector<HTMLElement>('.actions na-button button')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.updateAirport).toHaveBeenCalledWith('airport-fra', { status: 'INACTIVE' });
    expect(m.toast.success).toHaveBeenCalledWith('FRA deactivated.');
    expect(el.querySelector('tbody')).toBeTruthy();
    expect(el.querySelector('tbody')!.textContent).toContain('Inactive');
  });

  it('derives the drawer route counts from the loaded routes', async () => {
    const m = mocks(
      [airport(), jfk()],
      [
        route(),
        route({
          id: 'route-2',
          originAirportId: 'airport-jfk',
          destinationAirportId: 'airport-fra',
          origin: jfk(),
          destination: airport(),
        }),
      ],
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fact(el, 'Routes from here')).toBe('1');
    expect(fact(el, 'Routes to here')).toBe('1');
    expect(el.textContent).toContain('Associated routes');
    expect(el.querySelector('.drawer')!.textContent).toContain('FRA → JFK');
    // No per-airport requests: everything came from the initial load.
    expect(m.catalog.listAirports).toHaveBeenCalledTimes(1);
    expect(m.catalog.listRoutes).toHaveBeenCalledTimes(1);
  });
});
