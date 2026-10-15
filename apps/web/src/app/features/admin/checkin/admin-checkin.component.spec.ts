import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminCheckInPage } from './admin-checkin.component';
import {
  AdminCheckinService,
  type AdminCheckInBooking,
} from './admin-checkin.service';
import { ToastService } from '../../../shared/ui/toast.service';

function row(overrides: Partial<AdminCheckInBooking> = {}): AdminCheckInBooking {
  return {
    id: 'booking-1',
    bookingReference: 'NV8K4P2',
    status: 'CHECKED_IN',
    flight: {
      flightNumber: 'NV100',
      departureTime: '2026-10-20T09:30:00Z',
      arrivalTime: '2026-10-20T11:55:00Z',
      status: 'SCHEDULED',
      route: {
        originIata: 'FRA',
        destinationIata: 'JFK',
        originCity: 'Frankfurt',
        destinationCity: 'New York',
      },
    },
    passengersTotal: 2,
    checkedInCount: 2,
    invalidatedCount: 0,
    windowState: 'OPEN',
    ...overrides,
  };
}

function mocks(list: AdminCheckInBooking[] = [row()]) {
  return {
    api: {
      operationalList: vi.fn().mockReturnValue(of(list)),
      invalidatePasses: vi.fn().mockReturnValue(
        of({ bookingId: 'booking-1', invalidatedCount: 2, bookingStatus: 'CONFIRMED' }),
      ),
    },
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminCheckInPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminCheckInPage],
    providers: [
      provideRouter([]),
      { provide: AdminCheckinService, useValue: m.api },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminCheckInPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function settle(fixture: ComponentFixture<AdminCheckInPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text,
    ) ?? null
  );
}

describe('AdminCheckInPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the operational list from the API and renders real rows', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(m.api.operationalList).toHaveBeenCalledOnce();
    expect(root.textContent).toContain('NV8K4P2');
    expect(root.textContent).toContain('NV100');
    expect(root.textContent).toContain('FRA→JFK');
    expect(root.textContent).toContain('2/2');
    expect(root.textContent).toContain('Checked in');
    expect(root.textContent).toContain('Open'); // server-computed window state
  });

  it('shows not-yet-open and invalidated states from real API data', async () => {
    const m = mocks([
      row({
        status: 'CONFIRMED',
        checkedInCount: 0,
        invalidatedCount: 1,
        windowState: 'NOT_OPEN',
      }),
    ]);
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Opens 24h before');
    expect(root.textContent).toContain('Passes invalidated (1)');
  });

  it('invalidates passes through the API, toasts, and reloads authoritative state', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'Invalidate passes')!.click();
    await settle(fixture);
    buttonByText(root, 'Invalidate')!.click(); // dialog confirm
    await settle(fixture);

    expect(m.api.invalidatePasses).toHaveBeenCalledWith('booking-1');
    expect(m.toast.success).toHaveBeenCalledOnce();
    // The list was reloaded from the server — no local fake state.
    expect(m.api.operationalList).toHaveBeenCalledTimes(2);
  });

  it('disables invalidation when nothing is checked in', async () => {
    const m = mocks([row({ status: 'CONFIRMED', checkedInCount: 0 })]);
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(buttonByText(root, 'Invalidate passes')!.disabled).toBe(true);
  });

  it('surfaces the server error message when invalidation is rejected (409)', async () => {
    const m = mocks();
    m.api.invalidatePasses.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { code: 'NO_ACTIVE_CHECKIN', message: 'This booking has no active boarding passes to invalidate' },
      })),
    );
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'Invalidate passes')!.click();
    await settle(fixture);
    buttonByText(root, 'Invalidate')!.click();
    await settle(fixture);

    expect(m.toast.error).toHaveBeenCalledWith(
      'This booking has no active boarding passes to invalidate',
    );
    expect(m.toast.success).not.toHaveBeenCalled();
  });

  it('shows an empty state when no bookings are eligible for review', async () => {
    const m = mocks([]);
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No bookings');
  });

  it('shows a retryable error when the API fails — never silent demo data', async () => {
    const m = mocks();
    m.api.operationalList
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of([row()]));
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Could not load check-in data');
    expect(root.textContent).not.toContain('NV8K4P2');

    buttonByText(root, 'Try again')!.click();
    await settle(fixture);

    expect(m.api.operationalList).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('NV8K4P2');
  });
});
