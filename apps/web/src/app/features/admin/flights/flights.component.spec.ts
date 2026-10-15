import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { FlightsPage } from './flights.component';
import { FlightService } from '../../../core/services/flight.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Airport, Flight } from '../../../core/models/domain.model';

const FRA: Airport = {
  id: 'a1',
  iataCode: 'FRA',
  icaoCode: 'EDDF',
  name: 'Frankfurt am Main',
  city: 'Frankfurt',
  country: 'Germany',
  timezone: 'Europe/Berlin',
  status: 'ACTIVE',
};
const LHR: Airport = {
  id: 'a2',
  iataCode: 'LHR',
  icaoCode: 'EGLL',
  name: 'Heathrow',
  city: 'London',
  country: 'United Kingdom',
  timezone: 'Europe/London',
  status: 'ACTIVE',
};

function flight(partial: Partial<Flight> = {}): Flight {
  return {
    id: 'fl-1',
    flightNumber: 'NV720',
    publicNumber: 720,
    tripType: 'ONE_WAY',
    routeId: 'r-1',
    route: {
      id: 'r-1',
      originAirportId: 'a1',
      destinationAirportId: 'a2',
      origin: FRA,
      destination: LHR,
      distanceKm: 654,
      durationMinutes: 105,
      status: 'ACTIVE',
    },
    aircraftId: 'ac-1',
    aircraft: {
      id: 'ac-1',
      registration: 'NV-738Z',
      model: 'Boeing 737-800',
      capacity: 180,
      status: 'ACTIVE',
    },
    departureTime: '2026-03-02T07:45:00.000Z',
    arrivalTime: '2026-03-02T09:30:00.000Z',
    operatingDate: '2026-03-02',
    status: 'SCHEDULED',
    scheduleStatus: 'ONTIME',
    segments: [],
    fares: [
      {
        id: 'fare-1',
        flightId: 'fl-1',
        cabinClass: 'ECONOMY',
        basePrice: 129,
        taxAmount: 20.64,
        feeAmount: 5.16,
        currency: 'EUR',
        availableCount: 174,
        rules: null,
      },
    ],
    ...partial,
  };
}

/** Detail response: the only place segments come from. */
function flightDetail(): Flight {
  return flight({
    segments: [
      {
        id: 'seg-1',
        flightId: 'fl-1',
        segmentNumber: 1,
        originAirportId: 'a1',
        origin: FRA,
        destinationAirportId: 'a2',
        destination: LHR,
        departureTime: '2026-03-02T07:45:00.000Z',
        arrivalTime: '2026-03-02T09:30:00.000Z',
      },
    ],
  });
}

const SUMMARY_ROUTE = flight().route;
const SUMMARY_AIRCRAFT = flight().aircraft;
const AIRCRAFT_SEATS = [
  { id: 's-1', aircraftId: 'ac-1', seatNumber: '1A', cabinClass: 'BUSINESS' as const, isExitRow: false },
  { id: 's-2', aircraftId: 'ac-1', seatNumber: '10A', cabinClass: 'ECONOMY' as const, isExitRow: false },
  { id: 's-3', aircraftId: 'ac-1', seatNumber: '10B', cabinClass: 'ECONOMY' as const, isExitRow: false },
];

function mocks(list: Flight[] = [flight()]) {
  return {
    flights: {
      adminFlights: vi.fn().mockReturnValue(of(list)),
      getFlight: vi.fn().mockReturnValue(of(flightDetail())),
      updateFlightStatus: vi.fn().mockReturnValue(of(flight({ status: 'BOARDING' }))),
      updateFlight: vi.fn().mockReturnValue(of(flight())),
      createFlight: vi.fn().mockReturnValue(of(flightDetail())),
    },
    catalog: {
      listRoutes: vi.fn().mockReturnValue(of([SUMMARY_ROUTE])),
      listAircraft: vi.fn().mockReturnValue(of([SUMMARY_AIRCRAFT])),
      getAircraftSeats: vi.fn().mockReturnValue(of(AIRCRAFT_SEATS)),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<FlightsPage>> {
  await TestBed.configureTestingModule({
    imports: [FlightsPage],
    providers: [
      provideRouter([]),
      { provide: FlightService, useValue: m.flights },
      { provide: CatalogService, useValue: m.catalog },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(FlightsPage);
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

function rows(el: HTMLElement): NodeListOf<HTMLElement> {
  return el.querySelectorAll('na-data-table tbody tr');
}

async function openDetail(fixture: ComponentFixture<FlightsPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  rows(el)[0]!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

async function openGenerateDrawer(fixture: ComponentFixture<FlightsPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.page__head na-button button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('FlightsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the real flight list through adminFlights', async () => {
    const m = mocks([flight(), flight({ id: 'fl-2', flightNumber: 'NV101', status: 'CANCELLED' })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.flights.adminFlights).toHaveBeenCalledTimes(1);
    expect(rows(el).length).toBe(2);
    expect(el.textContent).toContain('NV720');
    expect(el.textContent).toContain('FRA → LHR');
    expect(el.textContent).toContain('NV-738Z');
    expect(el.textContent).toContain('Scheduled');
    expect(el.textContent).toContain('Cancelled');
  });

  it('filters server-side by flight number', async () => {
    const m = mocks([flight(), flight({ id: 'fl-2', flightNumber: 'NV101' })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-number', 'nv101');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.flights.adminFlights).toHaveBeenLastCalledWith(
      expect.objectContaining({ flightNumber: 'nv101' }),
    );
  });

  it('filters server-side by status and date range — combined', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-from', '2026-03-01');
    setField(el, '#filter-to', '2026-03-31');
    fixture.detectChanges();
    setField(el, '#status-filter', 'CANCELLED');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.flights.adminFlights).toHaveBeenLastCalledWith({
      flightNumber: undefined,
      status: 'CANCELLED',
      // Explicit status choice wins over the operational default.
      excludeCompleted: false,
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });

  it('clear filters resets every filter and reloads the unfiltered list', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-number', 'NV101');
    fixture.detectChanges();
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.filters__clear na-button button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.flights.adminFlights).toHaveBeenLastCalledWith({
      flightNumber: undefined,
      status: undefined,
      // Operational view default: COMPLETED flights are excluded.
      excludeCompleted: true,
      from: undefined,
      to: undefined,
    });
    expect((el.querySelector('#filter-number') as HTMLInputElement).value).toBe('');
  });

  it('does not offer UUID search in the UI — flight number is the business-facing search field', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#filter-id')).toBeNull();
    expect(el.querySelector('#filter-number')).not.toBeNull();
  });

  it('renders a compact flight ID in the row and the full ID in the detail drawer', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('na-data-table')!.textContent).toContain('fl-1');
    const el2 = await openDetail(fixture);
    expect(el2.querySelector('.drawer')!.textContent).toContain('fl-1');
  });

  it('shows a retryable error state when the list fails to load', async () => {
    const m = mocks();
    m.flights.adminFlights
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([flight()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('na-data-table .table-loading, na-skeleton')).toBeNull();
    expect(el.textContent).toContain('Could not load the flight schedule.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.adminFlights).toHaveBeenCalledTimes(2);
    expect(rows(el).length).toBe(1);
  });

  it('lazily loads real segments when a row opens, and caches them on reopen', async () => {
    const m = mocks();
    const fixture = await setup(m);

    expect(m.flights.getFlight).not.toHaveBeenCalled();

    let el = await openDetail(fixture);

    expect(m.flights.getFlight).toHaveBeenCalledTimes(1);
    expect(m.flights.getFlight).toHaveBeenCalledWith('fl-1');
    const segments = el.querySelector('.drawer .segments')!;
    expect(segments.textContent).toContain('FRA → LHR');

    el.querySelector<HTMLElement>('.drawer__close')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    el = await openDetail(fixture);
    expect(m.flights.getFlight).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.drawer .segments')!.textContent).toContain('FRA → LHR');
  });

  it('shows a retryable error inside the drawer when the detail fails to load', async () => {
    const m = mocks();
    m.flights.getFlight.mockReturnValueOnce(of(undefined)).mockReturnValue(of(flightDetail()));
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.drawer')!.textContent).toContain(
      'Could not load the flight details.',
    );

    el.querySelector<HTMLElement>('.drawer .list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.getFlight).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer .segments')!.textContent).toContain('FRA → LHR');
  });

  it('has no reschedule or assign-aircraft controls in the detail drawer', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.textContent).not.toContain('Reschedule');
    expect(el.textContent).not.toContain('Assign aircraft');
    expect(el.querySelector('#nf-number')).toBeNull();
    expect(el.querySelector('na-dialog')).toBeNull();
    expect(el.textContent).toContain('Flights are created manually by the Flight Manager');
  });

  it('offers the allowed lifecycle transitions and applies one through the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    const buttons = [...el.querySelectorAll<HTMLElement>('.status-actions na-button')].map((b) =>
      b.textContent!.trim(),
    );
    expect(buttons).toEqual(['Mark as Boarding', 'Cancel flight']);

    el.querySelector<HTMLElement>('.status-actions na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.updateFlightStatus).toHaveBeenCalledWith('fl-1', 'BOARDING');
    expect(el.querySelector('.drawer')!.textContent).toContain('Boarding');
  });

  it('hides status actions without the flights:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockImplementation((p: string) => p !== 'flights:manage');
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.status-actions')).toBeNull();
  });

  it('offers no transitions for terminal states', async () => {
    const m = mocks([flight({ status: 'COMPLETED' })]);
    m.flights.getFlight.mockReturnValue(of(flight({ status: 'COMPLETED' })));
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.status-actions')).toBeNull();
  });

  it('surfaces status-change errors inline', async () => {
    const m = mocks();
    m.flights.updateFlightStatus.mockReturnValue(throwError(() => new Error('conflict')));
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    el.querySelector<HTMLElement>('.status-actions na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.status-actions')!.textContent).toContain(
      'Could not change the flight status.',
    );
  });

  it('edits schedule times through the API with ISO payloads', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    el.querySelector<HTMLElement>('.edit-times na-button button')!.click();
    fixture.detectChanges();

    setField(el, '#edit-departure', '2026-03-02T10:00');
    setField(el, '#edit-arrival', '2026-03-02T12:00');
    fixture.detectChanges();

    const buttons = [...el.querySelectorAll<HTMLElement>('.edit-times na-button button')];
    buttons.find((b) => b.textContent!.includes('Save times'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.updateFlight).toHaveBeenCalledWith('fl-1', {
      departureTime: new Date('2026-03-02T10:00').toISOString(),
      arrivalTime: new Date('2026-03-02T12:00').toISOString(),
      price: 129, // prefilled from the current economy fare
    });
    expect(el.querySelector('.edit-times__form')).toBeNull(); // form closed after save
  });

  it('sends an updated price when the Flight Manager changes it', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    el.querySelector<HTMLElement>('.edit-times na-button button')!.click();
    fixture.detectChanges();
    // Template-driven forms write the initial input value asynchronously.
    await fixture.whenStable();
    fixture.detectChanges();
    expect((el.querySelector('#edit-price') as HTMLInputElement).value).toBe('129'); // prefilled

    setField(el, '#edit-price', '299.5');
    setField(el, '#edit-departure', '2026-03-02T10:00');
    setField(el, '#edit-arrival', '2026-03-02T12:00');
    fixture.detectChanges();

    const buttons = [...el.querySelectorAll<HTMLElement>('.edit-times na-button button')];
    buttons.find((b) => b.textContent!.includes('Save times'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.updateFlight).toHaveBeenCalledWith('fl-1', expect.objectContaining({ price: 299.5 }));
  });

  it('blocks inverted time edits client-side without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    el.querySelector<HTMLElement>('.edit-times na-button button')!.click();
    fixture.detectChanges();
    setField(el, '#edit-departure', '2026-03-02T12:00');
    setField(el, '#edit-arrival', '2026-03-02T10:00');
    fixture.detectChanges();

    const buttons = [...el.querySelectorAll<HTMLElement>('.edit-times na-button button')];
    buttons.find((b) => b.textContent!.includes('Save times'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.updateFlight).not.toHaveBeenCalled();
    expect(el.querySelector('.edit-times')!.textContent).toContain('Departure must be before arrival.');
  });

  it('hides time editing for terminal flights', async () => {
    const m = mocks([flight({ status: 'CANCELLED' })]);
    m.flights.getFlight.mockReturnValue(of(flight({ status: 'CANCELLED' })));
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.edit-times')).toBeNull();
  });

  it('hides time editing without the flights:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockImplementation((p: string) => p !== 'flights:manage');
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.edit-times')).toBeNull();
  });

  it('hides the generate button without the flights:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.page__head na-button')).toBeNull();
    expect(el.textContent).not.toContain('Generate flights');
  });

  it('derives the airports from the selected route instead of free input', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    expect(el.querySelector('.gen-airports')).toBeNull(); // nothing before a route is chosen

    setField(el, '#gen-route', 'r-1');
    fixture.detectChanges();

    const airports = el.querySelector('.gen-airports')!;
    expect(airports.textContent).toContain('FRA — Frankfurt am Main');
    expect(airports.textContent).toContain('LHR — Heathrow');
    // No airport text inputs exist — airports come from the route only.
    expect(airports.querySelector('input')).toBeNull();
  });

  it('shows a preview of the selected configuration and creates the flight on Generate, then opens its details', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    expect(el.querySelector('.gen-preview')).toBeNull(); // no preview before the form is complete

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    fixture.detectChanges();
    expect(el.querySelector('.gen-preview')).toBeNull(); // flight number still missing

    setField(el, '#gen-number', 'nv720'); // lowercase accepted, normalized to NV720
    setField(el, '#gen-price', '250');
    fixture.detectChanges();

    const preview = el.querySelector('.gen-preview')!;
    expect(preview.textContent).toContain('Frankfurt → London'); // city-level route line
    expect(preview.textContent).toContain('FRA — Frankfurt am Main');
    expect(preview.textContent).toContain('LHR — Heathrow');
    expect(preview.textContent).toContain('NV-738Z — Boeing 737-800');
    expect(preview.textContent).toContain('2026-10-07 · 10:00');
    expect(preview.textContent).toContain('2026-10-07 · 13:30');
    expect(preview.textContent).toContain('NV720'); // normalized flight number shown
    expect(preview.textContent).toContain('250'); // entered price shown

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.createFlight).toHaveBeenCalledWith({
      routeId: 'r-1',
      aircraftId: 'ac-1',
      departureDate: '2026-10-07',
      departureTime: '10:00',
      arrivalDate: '2026-10-07',
      arrivalTime: '13:30',
      flightNumber: 'NV720',
      price: 250,
      tripType: 'ONE_WAY',
    });
    // Navigated straight into the created flight's detail drawer.
    expect(m.toast.success).toHaveBeenCalledWith('Flight NV720 created.');
    expect(el.querySelector('.drawer')!.textContent).toContain('NV720');
    expect(el.querySelector('.drawer')!.textContent).toContain('fl-1'); // full flight ID
    expect(m.flights.adminFlights).toHaveBeenCalledTimes(2); // list reloaded
  });

  it.each(['100', 'ABC100', 'NVABC', ''])(
    'shows a clear flight-number error for "%s" and does not call the API',
    async (flightNumber) => {
      const m = mocks();
      const fixture = await setup(m);
      const el = await openGenerateDrawer(fixture);

      setField(el, '#gen-route', 'r-1');
      setField(el, '#gen-aircraft', 'ac-1');
      setField(el, '#gen-dep-date', '2026-10-07');
      setField(el, '#gen-dep-time', '10:00');
      setField(el, '#gen-arr-date', '2026-10-07');
      setField(el, '#gen-arr-time', '13:30');
      setField(el, '#gen-number', flightNumber);
      setField(el, '#gen-price', '250'); // valid price — the number is the only invalid field
      fixture.detectChanges();

      el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      fixture.detectChanges();

      expect(m.flights.createFlight).not.toHaveBeenCalled();
      const expected =
        flightNumber === '' ? 'Flight number is required.' : 'Flight number must start with NV followed by digits';
      expect(el.textContent).toContain(expected);
    },
  );

  it('does not submit twice while a creation is running', async () => {
    const m = mocks();
    const pending = new Subject<Flight>();
    m.flights.createFlight.mockReturnValue(pending.asObservable());
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', '250');
    fixture.detectChanges();

    const form = el.querySelector<HTMLFormElement>('.drawer form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(m.flights.createFlight).toHaveBeenCalledTimes(1);

    pending.next(flightDetail());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.drawer')!.textContent).toContain('NV720');
  });

  it('surfaces creation errors inline via toErrorMessage', async () => {
    const m = mocks();
    m.flights.createFlight.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', '250');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('You do not have permission to perform this action.');
    expect(m.toast.success).not.toHaveBeenCalled();
  });

  it('reveals required-field errors on Generate attempt instead of silently failing, and generates once valid', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    // Empty form: no errors shown until the user tries to generate.
    expect(el.textContent).not.toContain('is required');

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();

    // All required errors appear, and the API is never called.
    expect(m.flights.createFlight).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Please select a route. Example: FRA → LHR');
    expect(el.textContent).toContain('Please select an aircraft. Example: NV-738Z');
    expect(el.textContent).toContain('Departure date is required (yyyy-mm-dd).');
    expect(el.textContent).toContain('Departure time is required.');
    expect(el.textContent).toContain('Arrival date is required (yyyy-mm-dd).');
    expect(el.textContent).toContain('Arrival time is required.');
    expect(el.textContent).toContain('Flight number is required.');
    expect(el.textContent).toContain('Flight price is required. Example: 15000 or 250.00');

    // Fill everything → generation proceeds exactly as before.
    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'nv720');
    setField(el, '#gen-price', '250');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.createFlight).toHaveBeenCalled();
    expect(el.textContent).not.toContain('is required.');
  });

  it('shows a clear time error for a malformed time even with everything else filled', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    // type="time" inputs reject malformed values — the model receives '' and the
    // required message is shown (the HH:mm branch covers programmatic junk).
    setField(el, '#gen-dep-time', '99:99');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', '250');
    fixture.detectChanges();

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();

    expect(m.flights.createFlight).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Departure time is required.');
  });

  it.each([
    ['0', 'Price must be greater than 0. Example: 15000'],
    ['-100', 'Price must be greater than 0. Example: 15000'],
    // type="number" inputs reject "abc" — the model receives '' and the
    // required message is shown.
    ['abc', 'Flight price is required. Example: 15000 or 250.00'],
    ['250.555', 'Price can have up to 2 decimal places. Example: 15000 or 15000.50'],
  ])('shows a clear price error for "%s" and does not call the API', async (price, expectedMessage) => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', price);
    fixture.detectChanges();

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();

    expect(m.flights.createFlight).not.toHaveBeenCalled();
    expect(el.textContent).toContain(expectedMessage as string);
  });

  it.each(['15000', '15000.00', '250', '250.50'])(
    'accepts the valid price "%s" and generates successfully',
    async (price) => {
      const m = mocks();
      const fixture = await setup(m);
      const el = await openGenerateDrawer(fixture);

      setField(el, '#gen-route', 'r-1');
      setField(el, '#gen-aircraft', 'ac-1');
      setField(el, '#gen-dep-date', '2026-10-07');
      setField(el, '#gen-dep-time', '10:00');
      setField(el, '#gen-arr-date', '2026-10-07');
      setField(el, '#gen-arr-time', '13:30');
      setField(el, '#gen-number', 'NV720');
      setField(el, '#gen-price', price);
      fixture.detectChanges();

      // Valid price: no invalid state before submit.
      expect(el.querySelector('#gen-price')!.getAttribute('aria-invalid')).toBeNull();

      el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(m.flights.createFlight).toHaveBeenCalledWith(
        expect.objectContaining({ price: Number(price) }),
      );
      // On success the drawer closes and the new flight's details open, so the
      // form field no longer exists to assert against.
    },
  );

  it('accepts a numeric genPrice (type="number" inputs hand Angular a number) without crashing and generates', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    // The real type="number" value accessor emits a number — simulate it.
    fixture.componentInstance.genPrice.set(15000 as never);
    fixture.detectChanges();

    expect(() => fixture.componentInstance.priceError()).not.toThrow();
    expect(fixture.componentInstance.priceError()).toBeNull();
    expect(fixture.componentInstance.parsedGenPrice()).toBe(15000);

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.createFlight).toHaveBeenCalledWith(
      expect.objectContaining({ price: 15000 }),
    );
  });

  it('computes the same price errors for numeric and string genPrice values', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const component = fixture.componentInstance;

    for (const [value, expected] of [
      ['', 'Flight price is required. Example: 15000 or 250.00'],
      [0, 'Price must be greater than 0. Example: 15000'],
      [-100, 'Price must be greater than 0. Example: 15000'],
      ['abc', 'Enter a valid price. Use numbers only, for example: 15000 or 250.00'],
      ['250.555', 'Price can have up to 2 decimal places. Example: 15000 or 15000.50'],
      [15000.0, null],
      [250.5, null],
    ] as const) {
      component.genPrice.set(value as never);
      expect(component.priceError(), `genPrice=${String(value)}`).toBe(expected);
    }
  });

  it('handles a numeric editPrice in the edit drawer without crashing', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    el.querySelector<HTMLElement>('.edit-times na-button button')!.click();
    fixture.detectChanges();
    // The real type="number" value accessor emits a number — simulate it.
    fixture.componentInstance.editPrice = 299.5 as never;
    setField(el, '#edit-departure', '2026-03-02T10:00');
    setField(el, '#edit-arrival', '2026-03-02T12:00');
    fixture.detectChanges();

    const buttons = [...el.querySelectorAll<HTMLElement>('.edit-times na-button button')];
    expect(() => buttons.find((b) => b.textContent!.includes('Save times'))!.click()).not.toThrow();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.flights.updateFlight).toHaveBeenCalledWith('fl-1', expect.objectContaining({ price: 299.5 }));
  });

  it('maps the backend cross-field error (arrival before departure across timezones) to the arrival time field', async () => {
    const m = mocks();
    m.flights.createFlight.mockReturnValue(
      throwError(() => ({ status: 400, error: { message: 'arrivalTime must be after departureTime' } })),
    );
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '05:00'); // valid form — backend still rejects ordering
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', '250');
    fixture.detectChanges();

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Arrival must be after departure.');
    expect(m.toast.success).not.toHaveBeenCalled();
  });

  it('shows the public Flight ID prominently and the real price in the details drawer', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    const drawer = el.querySelector('.drawer')!;
    expect(drawer.textContent).toContain('FL-1720'); // 1000 + publicNumber(720)
    expect(drawer.textContent).toContain('Internal ID');
    expect(drawer.textContent).toContain('129'); // economy base price from the fare
  });

  it('offers a trip-type select (default One way) and sends ROUND_TRIP when chosen', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-aircraft', 'ac-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', '250');
    setField(el, '#gen-trip-type', 'ROUND_TRIP');
    fixture.detectChanges();

    expect(el.querySelector('.gen-preview')!.textContent).toContain('Round trip');

    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    expect(m.flights.createFlight).toHaveBeenCalledWith(
      expect.objectContaining({ tripType: 'ROUND_TRIP' }),
    );
  });

  it('shows the cabin classes of the selected aircraft and per-cabin fares in the preview', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-aircraft', 'ac-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.getAircraftSeats).toHaveBeenCalledWith('ac-1');
    const cabins = el.querySelector('.gen-cabins')!;
    expect(cabins.textContent).toContain('ECONOMY');
    expect(cabins.textContent).toContain('BUSINESS');
    expect(cabins.textContent).toContain('2 seats'); // two economy seats in the fixture
    expect(cabins.textContent).toContain('1 seats');

    // Cabin fares appear in the preview once the form is complete.
    setField(el, '#gen-route', 'r-1');
    setField(el, '#gen-dep-date', '2026-10-07');
    setField(el, '#gen-dep-time', '10:00');
    setField(el, '#gen-arr-date', '2026-10-07');
    setField(el, '#gen-arr-time', '13:30');
    setField(el, '#gen-number', 'NV720');
    setField(el, '#gen-price', '200');
    fixture.detectChanges();

    const fares = el.querySelector('.gen-cabin-fares')!;
    expect(fares.textContent).toContain('ECONOMY');
    expect(fares.textContent).toContain('200'); // economy base
    expect(fares.textContent).toContain('700'); // business 3.5× rounded
  });
});
