import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { FlightOverviewPage } from './flight-overview.component';
import { FlightOpsService, type FlightOverview, type HistoryItem } from './flight-ops.service';
import { DashboardRealtimeService } from '../dashboard/dashboard-realtime.service';
import type { ApiFlight } from '../../../core/models/flight-api.model';

function apiFlight(partial: Partial<ApiFlight> = {}): ApiFlight {
  return {
    id: 'fl-1',
    flightNumber: 'NV720',
    publicNumber: 24,
    tripType: 'ONE_WAY',
    routeId: 'r-1',
    aircraftId: 'ac-1',
    scheduleRuleId: null,
    operatingDate: '2026-10-10',
    departureTime: '2026-10-10T08:00:00.000Z',
    arrivalTime: '2026-10-10T10:00:00.000Z',
    status: 'SCHEDULED',
    scheduleStatus: 'ONTIME',
    route: {
      id: 'r-1',
      originAirportId: 'a1',
      destinationAirportId: 'a2',
      originAirport: {
        id: 'a1',
        iataCode: 'FRA',
        icaoCode: 'EDDF',
        name: 'Frankfurt Airport',
        city: 'Frankfurt',
        country: 'Germany',
        timezone: 'Europe/Berlin',
        status: 'ACTIVE',
      },
      destinationAirport: {
        id: 'a2',
        iataCode: 'JFK',
        icaoCode: 'KJFK',
        name: 'John F. Kennedy',
        city: 'New York',
        country: 'USA',
        timezone: 'America/New_York',
        status: 'ACTIVE',
      },
      distanceKm: 6200,
      durationMinutes: 480,
      status: 'ACTIVE',
    },
    aircraft: { id: 'ac-1', registration: 'NV-738Z', model: 'Boeing 737-800', capacity: 180, status: 'ACTIVE' },
    fares: [],
    ...partial,
  };
}

function historyItem(partial: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'h-1',
    action: 'FLIGHT_CREATED',
    actorType: 'Staff',
    actorId: 'u-1',
    targetType: 'Flight',
    targetId: 'fl-1',
    metadata: { flightNumber: 'NV720' },
    createdAt: '2026-10-07T14:32:00.000Z',
    ...partial,
  };
}

function overview(partial: Partial<FlightOverview> = {}): FlightOverview {
  return {
    totalFlights: 10,
    upcomingFlights: 4,
    activeFlights: 2,
    completedFlights: 3,
    cancelledFlights: 1,
    delayedFlights: 0,
    routes: 6,
    airports: 8,
    aircraft: 5,
    statusBreakdown: { SCHEDULED: 4, BOARDING: 1, DEPARTED: 1, COMPLETED: 3, CANCELLED: 1 },
    upcoming: [apiFlight()],
    recentActivity: [historyItem()],
    ...partial,
  };
}

function mocks(data: FlightOverview = overview()) {
  const invalidate = new Subject<string>();
  return {
    ops: {
      overview: vi.fn().mockReturnValue(of(data)),
    },
    realtime: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      invalidate$: invalidate.asObservable(),
    },
    invalidate,
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<FlightOverviewPage>> {
  await TestBed.configureTestingModule({
    imports: [FlightOverviewPage],
    providers: [
      provideRouter([]),
      { provide: FlightOpsService, useValue: m.ops },
      { provide: DashboardRealtimeService, useValue: m.realtime },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(FlightOverviewPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('FlightOverviewPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('loads the overview and renders real KPI numbers', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    const text = el.textContent!;
    expect(text).toContain('Total flights');
    expect(text).toContain('Upcoming');
    expect(text).toContain('Completed');
    expect(text).toContain('Routes');
    expect(text).toContain('Airports');
    expect(text).toContain('Aircraft');
    const values = [...el.querySelectorAll('.kpi__value')].map((n) => n.textContent);
    expect(values).toEqual(['10', '4', '2', '3', '1', '6', '8', '5']);
  });

  it('renders the status distribution only for statuses present in the data', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    const rows = [...el.querySelectorAll('.status-list__row')].map((r) => r.textContent ?? '');
    expect(rows.some((r) => r.includes('Scheduled'))).toBe(true);
    expect(rows.some((r) => r.includes('Completed'))).toBe(true);
    expect(rows.some((r) => r.includes('Delayed'))).toBe(false); // 0 → hidden
  });

  it('lists upcoming flights with the public FL id, never the UUID', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    const table = el.querySelector('na-data-table')!;
    expect(table.textContent).toContain('FL-1024'); // 1000 + 24
    expect(table.textContent).toContain('NV720');
    expect(table.textContent).toContain('FRA → JFK');
    expect(table.textContent).not.toContain('fl-1');
  });

  it('renders recent audit activity with action and detail', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    const activity = el.querySelector('.activity-list')!;
    expect(activity.textContent).toContain('FLIGHT_CREATED');
    expect(activity.textContent).toContain('NV720');
  });

  it('connects to the realtime channel and reloads on invalidation (debounced)', async () => {
    const m = mocks();
    const fixture = await setup(m);
    expect(m.realtime.connect).toHaveBeenCalledTimes(1);
    expect(m.ops.overview).toHaveBeenCalledTimes(1);

    m.invalidate.next('flight.created');
    m.invalidate.next('flight.updated'); // burst → one reload
    vi.advanceTimersByTime(500);
    await fixture.whenStable();

    expect(m.ops.overview).toHaveBeenCalledTimes(2);

    fixture.destroy();
    expect(m.realtime.disconnect).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable error state when the overview fails to load', async () => {
    const m = mocks();
    m.ops.overview.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load the flight overview.');

    m.ops.overview.mockReturnValue(of(overview()));
    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    // Fake timers are active in this suite; flush the scheduled change-detection
    // tick so whenStable can settle (same pattern as the debounce test above).
    vi.advanceTimersByTime(500);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.ops.overview).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Total flights');
  });
});
