import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { FlightsPage } from './flights.component';
import { FlightService } from '../../../core/services/flight.service';
import { ScheduleRulesService } from './schedule-rules.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Airport, Flight } from '../../../core/models/domain.model';
import type { GenerationSummary } from './schedule-rule-api.model';

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

const SUMMARY: GenerationSummary = {
  rulesEvaluated: 3,
  operatingDates: 40,
  flightsCreated: 38,
  flightsUpdated: 2,
  segmentsCreated: 38,
  segmentsUpdated: 2,
  faresCreated: 76,
  faresUpdated: 4,
  skippedRules: [{ flightNumber: 'NV999', reason: 'route has no durationMinutes' }],
};

function mocks(list: Flight[] = [flight()]) {
  return {
    flights: {
      adminFlights: vi.fn().mockReturnValue(of(list)),
      getFlight: vi.fn().mockReturnValue(of(flightDetail())),
    },
    rules: { generateFlights: vi.fn().mockReturnValue(of(SUMMARY)) },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<FlightsPage>> {
  await TestBed.configureTestingModule({
    imports: [FlightsPage],
    providers: [
      provideRouter([]),
      { provide: FlightService, useValue: m.flights },
      { provide: ScheduleRulesService, useValue: m.rules },
      { provide: AuthService, useValue: m.auth },
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

  it('filters rows by the search query', async () => {
    const m = mocks([flight(), flight({ id: 'fl-2', flightNumber: 'NV101' })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#flight-search', 'nv101');
    fixture.detectChanges();

    expect(rows(el).length).toBe(1);
    expect(el.querySelector('na-data-table')!.textContent).toContain('NV101');
    expect(el.querySelector('na-data-table')!.textContent).not.toContain('NV720');
  });

  it('filters rows by status', async () => {
    const m = mocks([flight(), flight({ id: 'fl-2', flightNumber: 'NV101', status: 'CANCELLED' })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#status-filter', 'CANCELLED');
    fixture.detectChanges();

    expect(rows(el).length).toBe(1);
    expect(el.querySelector('na-data-table')!.textContent).toContain('NV101');
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

  it('has no manual create, cancel, reschedule or assign-aircraft controls', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.textContent).not.toContain('New flight');
    expect(el.textContent).not.toContain('Cancel flight');
    expect(el.textContent).not.toContain('Reschedule');
    expect(el.textContent).not.toContain('Assign aircraft');
    expect(el.querySelector('#nf-number')).toBeNull();
    expect(el.querySelector('na-dialog')).toBeNull();
    expect(el.textContent).toContain('Flights are created from schedule rules via generation');
  });

  it('hides the generate button without the flights:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.page__head na-button')).toBeNull();
    expect(el.textContent).not.toContain('Generate flights');
  });

  it('blocks generation ranges over 62 days without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-from', '2026-01-01');
    setField(el, '#gen-to', '2026-06-01');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();

    expect(m.rules.generateFlights).not.toHaveBeenCalled();
    expect(el.textContent).toContain('The range cannot exceed 62 days.');
  });

  it('blocks an inverted generation range without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-from', '2026-04-30');
    setField(el, '#gen-to', '2026-03-01');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();

    expect(m.rules.generateFlights).not.toHaveBeenCalled();
    expect(el.textContent).toContain('From must be on or before to.');
  });

  it('generates flights, renders the real summary and refreshes the list', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-from', '2026-03-01');
    setField(el, '#gen-to', '2026-04-30');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.rules.generateFlights).toHaveBeenCalledTimes(1);
    expect(m.rules.generateFlights).toHaveBeenCalledWith('2026-03-01', '2026-04-30');

    const summary = el.querySelector('.gen-summary')!;
    expect(summary.textContent).toContain('Rules evaluated');
    expect(summary.textContent).toContain('3');
    expect(summary.textContent).toContain('38');
    expect(summary.textContent).toContain('NV999');
    expect(summary.textContent).toContain('route has no durationMinutes');

    expect(m.flights.adminFlights).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer')).not.toBeNull();
  });

  it('does not submit twice while a generation is running', async () => {
    const m = mocks();
    const pending = new Subject<GenerationSummary>();
    m.rules.generateFlights.mockReturnValue(pending.asObservable());
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-from', '2026-03-01');
    setField(el, '#gen-to', '2026-04-30');
    fixture.detectChanges();
    const form = el.querySelector<HTMLFormElement>('.drawer form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(m.rules.generateFlights).toHaveBeenCalledTimes(1);

    pending.next(SUMMARY);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.gen-summary')).not.toBeNull();
  });

  it('surfaces generation errors inline via toErrorMessage', async () => {
    const m = mocks();
    m.rules.generateFlights.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    const el = await openGenerateDrawer(fixture);

    setField(el, '#gen-from', '2026-03-01');
    setField(el, '#gen-to', '2026-04-30');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('You do not have permission to perform this action.');
    expect(el.querySelector('.gen-summary')).toBeNull();
  });
});
