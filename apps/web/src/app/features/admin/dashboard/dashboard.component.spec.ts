import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardPage } from './dashboard.component';
import { DashboardService, type DashboardData } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';

function data(partial: Partial<DashboardData> = {}): DashboardData {
  return {
    range: '30d',
    totalFlights: 12,
    totalBookings: 5,
    confirmedBookings: 3,
    passengers: 7,
    occupancyPercent: 42,
    revenue: null,
    currency: 'EUR',
    scheduledCount: 2,
    delayedCount: 0,
    cancelledCount: 0,
    completedCount: 0,
    pendingRefunds: 0,
    openBaggageCases: 0,
    todaysFlights: [
      {
        id: 'f1',
        flightNumber: 'NV100',
        status: 'SCHEDULED',
        departureTime: '2026-09-29T06:00:00Z',
        arrivalTime: '2026-09-29T14:00:00Z',
        originIata: 'FRA',
        destinationIata: 'JFK',
        aircraftRegistration: 'NV-320A',
      },
    ],
    recentBookings: [
      {
        id: 'b1',
        bookingReference: 'NVABC1',
        status: 'PENDING',
        totalAmount: 505,
        currency: 'EUR',
        bookedAt: '2026-09-29T08:00:00Z',
      },
    ],
    bookingsTrend: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-09-${String(i).padStart(2, '0')}`,
      value: i,
    })),
    revenueTrend: null,
    ...partial,
  };
}

function mocks(overrides: Partial<DashboardData> = {}) {
  return {
    dashboard: { getDashboard: vi.fn().mockReturnValue(of(data(overrides))) },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<DashboardPage>> {
  await TestBed.configureTestingModule({
    imports: [DashboardPage],
    providers: [
      provideRouter([]),
      { provide: DashboardService, useValue: m.dashboard },
      { provide: AuthService, useValue: m.auth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(DashboardPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('DashboardPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the dashboard from the API with the default 30d range and renders KPI cards', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.dashboard.getDashboard).toHaveBeenCalledWith('30d');
    const text = el.textContent!;
    expect(text).toContain('Operations overview');
    expect(text).toContain('Total flights');
    expect(text).toContain('12');
    expect(text).toContain('3 confirmed');
    expect(text).toContain('42%');
    expect(el.querySelectorAll('.kpi-grid .kpi').length).toBeGreaterThanOrEqual(8);
  });

  it("renders today's operations from the API response", async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('NV100');
    expect(el.textContent).toContain('FRA → JFK');
    expect(el.textContent).toContain('NV-320A');
    expect(el.textContent).toContain('2 scheduled');
  });

  it('renders recent bookings with amount and status', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('NVABC1');
    expect(el.textContent).toContain('505');
    expect(el.textContent).toContain('Pending payment');
  });

  it('shows a truthful placeholder instead of revenue while payments are deferred', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Available once payments are implemented');
    expect(el.textContent).toContain('No payment data yet');
  });

  it('renders the bookings trend bars from API trend points', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    const bars = el.querySelectorAll('.chart-card .bar--navy');
    expect(bars.length).toBe(30);
  });

  it('hides financial sections without the payments:read permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Financial data restricted');
    expect(el.textContent).not.toContain('Revenue trend');
  });

  it('refetches with the selected range when the segment changes', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const sevenDay = Array.from(el.querySelectorAll<HTMLButtonElement>('.seg__btn')).find((b) =>
      b.textContent?.includes('7 days'),
    )!;
    sevenDay.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.dashboard.getDashboard).toHaveBeenLastCalledWith('7d');
    expect(m.dashboard.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('shows an error state with retry when the API fails', async () => {
    const m = mocks();
    m.dashboard.getDashboard
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of(data()));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load the operations dashboard');

    el.querySelector<HTMLElement>('.load-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.dashboard.getDashboard).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Total flights');
  });

  it('shows empty states when there are no flights or bookings today', async () => {
    const fixture = await setup(mocks({ todaysFlights: [], recentBookings: [] }));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No flights today');
    expect(el.textContent).toContain('No bookings yet');
  });

  it('shows the all-clear alert when nothing needs attention, and alerts when it does', async () => {
    let fixture = await setup(mocks());
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('All clear');

    TestBed.resetTestingModule();
    fixture = await setup(mocks({ delayedCount: 2, pendingRefunds: 1 }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Delayed flights');
    expect(el.textContent).toContain('Pending refunds');
    expect(el.textContent).not.toContain('All clear');
  });

  it('never touches the legacy mock AdminService', async () => {
    // The component must depend only on DashboardService; if it still injected
    // the mock AdminService, TestBed would fail without providing it.
    const fixture = await setup(mocks());
    expect(fixture.componentInstance).toBeTruthy();
  });
});
