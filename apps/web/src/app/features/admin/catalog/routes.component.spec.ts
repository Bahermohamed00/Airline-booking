import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RoutesPage } from './routes.component';
import { CatalogService } from '../../../core/services/catalog.service';
import { FlightService } from '../../../core/services/flight.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Airport, Flight, Route } from '../../../core/models/domain.model';

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

function flight(partial: Partial<Flight> = {}): Flight {
  return {
    id: 'flight-1',
    flightNumber: 'NV100',
    routeId: 'route-1',
    route: route(),
    aircraftId: 'ac-1',
    aircraft: {
      id: 'ac-1',
      registration: 'NV-738Z',
      model: 'Boeing 737-800',
      capacity: 189,
      status: 'ACTIVE',
    },
    departureTime: '2026-03-01T10:00:00Z',
    arrivalTime: '2026-03-01T18:00:00Z',
    operatingDate: '2026-03-01',
    status: 'SCHEDULED',
    scheduleStatus: 'ONTIME',
    segments: [],
    fares: [],
    ...partial,
  };
}

function mocks(
  routes: Route[] = [route()],
  airports: Airport[] = [airport(), jfk()],
  flights: Flight[] = [],
) {
  return {
    catalog: {
      listRoutes: vi.fn().mockReturnValue(of(routes)),
      listAirports: vi.fn().mockReturnValue(of(airports)),
      createRoute: vi.fn().mockReturnValue(of(route())),
      updateRoute: vi.fn().mockReturnValue(of(route({ status: 'INACTIVE' }))),
    },
    flights: {
      adminFlights: vi.fn().mockReturnValue(of(flights)),
    },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<RoutesPage>> {
  await TestBed.configureTestingModule({
    imports: [RoutesPage],
    providers: [
      provideRouter([]),
      { provide: CatalogService, useValue: m.catalog },
      { provide: FlightService, useValue: m.flights },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RoutesPage);
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

async function openCreateDrawer(fixture: ComponentFixture<RoutesPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.page__head na-button button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('RoutesPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads routes and airports from the API and renders the mapped route pair', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.catalog.listRoutes).toHaveBeenCalledTimes(1);
    expect(m.catalog.listAirports).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('FRA → JFK');
    expect(el.textContent).toContain('6200 km');
    expect(el.textContent).toContain('8h 00m');
  });

  it('labels flight counts as "Upcoming flights" from a single /flights fetch', async () => {
    const m = mocks([route()], [airport(), jfk()], [flight(), flight({ id: 'flight-2' })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.flights.adminFlights).toHaveBeenCalledTimes(1);
    expect(el.querySelector('th:nth-child(4)')!.textContent).toContain('Upcoming flights');
    expect(el.querySelector('tbody td:nth-child(4)')!.textContent!.trim()).toBe('2');

    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.drawer')!.textContent).toContain('Upcoming flights');
    expect(el.querySelector('.drawer')!.textContent).toContain('current scheduling window');
    expect(m.flights.adminFlights).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.catalog.listRoutes
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([route()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load the route catalog.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.listRoutes).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('FRA → JFK');
  });

  it('creates a route through the API with airport UUIDs and numeric distance/duration', async () => {
    const m = mocks([], [airport(), jfk()]);
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#rt-origin', 'airport-fra');
    setField(el, '#rt-dest', 'airport-jfk');
    setField(el, '#rt-dist', '6200');
    setField(el, '#rt-dur', '480');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.createRoute).toHaveBeenCalledWith({
      originAirportId: 'airport-fra',
      destinationAirportId: 'airport-jfk',
      distanceKm: 6200,
      durationMinutes: 480,
    });
    expect(m.toast.success).toHaveBeenCalledWith('Route FRA → JFK added.');
  });

  it('blocks origin = destination client-side without calling the API', async () => {
    const m = mocks([], [airport(), jfk()]);
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#rt-origin', 'airport-fra');
    setField(el, '#rt-dest', 'airport-fra');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.catalog.createRoute).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Origin and destination must be different airports.');
  });

  it('blocks a duplicate pair client-side without calling the API', async () => {
    const m = mocks([route()], [airport(), jfk()]);
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#rt-origin', 'airport-fra');
    setField(el, '#rt-dest', 'airport-jfk');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.catalog.createRoute).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Route FRA → JFK already exists.');
  });

  it('shows the duplicate-route message when the API returns 409', async () => {
    const m = mocks([], [airport(), jfk()]);
    m.catalog.createRoute.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#rt-origin', 'airport-fra');
    setField(el, '#rt-dest', 'airport-jfk');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Route FRA → JFK already exists.');
    expect(el.querySelector('.drawer')).not.toBeNull();
  });

  it('deactivates a route via PATCH {status} and updates the row from the response', async () => {
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

    expect(m.catalog.updateRoute).toHaveBeenCalledWith('route-1', { status: 'INACTIVE' });
    expect(m.toast.success).toHaveBeenCalledWith('Route FRA → JFK deactivated.');
    expect(el.querySelector('tbody')!.textContent).toContain('Inactive');
  });
});
