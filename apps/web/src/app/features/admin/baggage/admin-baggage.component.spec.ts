import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminBaggagePage } from './admin-baggage.component';
import { AdminBaggageService, type AdminBaggage } from './admin-baggage.service';
import { ToastService } from '../../../shared/ui/toast.service';

function bag(overrides: Partial<AdminBaggage> = {}): AdminBaggage {
  return {
    id: 'bag-1',
    bookingPassengerId: 'bp-1',
    type: 'CHECKED',
    weightKg: 18,
    pieces: 1,
    tagNumber: 'NV00000002',
    status: 'DELAYED',
    events: [
      {
        id: 'e1',
        baggageId: 'bag-1',
        eventType: 'CHECKED_IN',
        location: 'FRA Terminal 1',
        occurredAt: '2026-10-04T08:00:00Z',
      },
      {
        id: 'e2',
        baggageId: 'bag-1',
        eventType: 'DELAYED',
        location: 'JFK Baggage Services',
        occurredAt: '2026-10-04T20:00:00Z',
      },
    ],
    bookingPassenger: {
      passenger: { firstName: 'Demo', lastName: 'Customer' },
      booking: { bookingReference: 'NVABC1' },
    },
    ...overrides,
  };
}

function mocks(bags: AdminBaggage[] = [bag()]) {
  return {
    api: {
      adminList: vi.fn().mockReturnValue(of(bags)),
      recordEvent: vi.fn().mockReturnValue(of(bag())),
    },
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminBaggagePage>> {
  await TestBed.configureTestingModule({
    imports: [AdminBaggagePage],
    providers: [
      provideRouter([]),
      { provide: AdminBaggageService, useValue: m.api },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminBaggagePage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function settle(fixture: ComponentFixture<AdminBaggagePage>): Promise<void> {
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

describe('AdminBaggagePage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads baggage from the API and renders rows', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(m.api.adminList).toHaveBeenCalledOnce();
    expect(root.textContent).toContain('NV00000002');
    expect(root.textContent).toContain('18 kg');
  });

  it('shows passenger and booking context when a row is selected', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLElement>('tbody tr')!.click();
    await settle(fixture);

    expect(root.textContent).toContain('Demo Customer');
    expect(root.textContent).toContain('NVABC1');
  });

  it('records an event through the API and updates the row from the response', async () => {
    const m = mocks();
    m.api.recordEvent.mockReturnValue(
      of(
        bag({
          status: 'DELIVERED',
          events: [
            ...bag().events,
            {
              id: 'e3',
              baggageId: 'bag-1',
              eventType: 'DELIVERED',
              location: 'JFK Baggage Services',
              occurredAt: '2026-10-05T09:00:00Z',
            },
          ],
        }),
      ),
    );
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLElement>('tbody tr')!.click();
    await settle(fixture);

    const input = root.querySelector<HTMLInputElement>('#event-location')!;
    input.value = 'JFK Baggage Services';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    buttonByText(root, 'Record event')!.click();
    await settle(fixture);

    expect(m.api.recordEvent).toHaveBeenCalledWith('bag-1', 'DELIVERED', 'JFK Baggage Services');
    expect(m.toast.success).toHaveBeenCalled();
    expect(root.textContent).toContain('Delivered');
  });

  it('shows an error state with retry when the list fails to load', async () => {
    const m = mocks();
    m.api.adminList
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of([bag()]));
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Could not load baggage');

    buttonByText(root, 'Try again')!.click();
    await settle(fixture);

    expect(m.api.adminList).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('NV00000002');
  });
});
