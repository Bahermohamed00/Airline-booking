import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AircraftPage } from './aircraft.component';
import { CatalogService } from './catalog.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Aircraft, Seat } from '../../../core/models/domain.model';

function aircraft(partial: Partial<Aircraft> = {}): Aircraft {
  return {
    id: 'ac-1',
    registration: 'NV-738Z',
    model: 'Boeing 737-800',
    capacity: 180,
    status: 'ACTIVE',
    seatCount: 174,
    ...partial,
  };
}

function seat(partial: Partial<Seat> = {}): Seat {
  return {
    id: 'seat-1',
    aircraftId: 'ac-1',
    seatNumber: '1A',
    cabinClass: 'ECONOMY',
    seatRow: 1,
    seatColumn: 'A',
    isExitRow: false,
    features: {},
    ...partial,
  };
}

const SEATS: Seat[] = [
  seat({ id: 's1', cabinClass: 'BUSINESS' }),
  seat({ id: 's2', cabinClass: 'BUSINESS', seatNumber: '1B', seatColumn: 'B' }),
  seat({ id: 's3', seatNumber: '7A', seatRow: 7 }),
  seat({ id: 's4', seatNumber: '7B', seatRow: 7, seatColumn: 'B' }),
  seat({ id: 's5', seatNumber: '7C', seatRow: 7, seatColumn: 'C' }),
  seat({ id: 's6', seatNumber: '7D', seatRow: 7, seatColumn: 'D' }),
];

function mocks(fleet: Aircraft[] = [aircraft()]) {
  return {
    catalog: {
      listAircraft: vi.fn().mockReturnValue(of(fleet)),
      getAircraftSeats: vi.fn().mockReturnValue(of(SEATS)),
      createAircraft: vi.fn().mockReturnValue(of(aircraft({ id: 'ac-2' }))),
      updateAircraft: vi.fn().mockReturnValue(of(aircraft({ status: 'MAINTENANCE' }))),
    },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AircraftPage>> {
  await TestBed.configureTestingModule({
    imports: [AircraftPage],
    providers: [
      provideRouter([]),
      { provide: CatalogService, useValue: m.catalog },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AircraftPage);
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

async function openDetail(fixture: ComponentFixture<AircraftPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.grid .card')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

async function openCreateDrawer(fixture: ComponentFixture<AircraftPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.page__head na-button button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AircraftPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('has no client-side seat generator', () => {
    expect(Object.getOwnPropertyNames(AircraftPage.prototype)).not.toContain('buildSeats');
  });

  it('loads the fleet from the API and shows the server seat count on the card', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.catalog.listAircraft).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('NV-738Z');
    expect(el.textContent).toContain('180 seats · 174 configured');
    expect(el.textContent).toContain('Active');
  });

  it('shows an empty state when the fleet is empty', async () => {
    const fixture = await setup(mocks([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No aircraft');
    expect(el.querySelector('.grid .card')).toBeNull();
  });

  it('shows a retryable error state when the fleet fails to load', async () => {
    const m = mocks();
    m.catalog.listAircraft
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([aircraft()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load the aircraft fleet.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.listAircraft).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NV-738Z');
  });

  it('lazily loads real seats when the drawer opens and summarizes cabins from them', async () => {
    const m = mocks();
    const fixture = await setup(m);

    expect(m.catalog.getAircraftSeats).not.toHaveBeenCalled();

    const el = await openDetail(fixture);

    expect(m.catalog.getAircraftSeats).toHaveBeenCalledTimes(1);
    expect(m.catalog.getAircraftSeats).toHaveBeenCalledWith('ac-1');
    const drawer = el.querySelector('.drawer')!;
    expect(drawer.textContent).toContain('Business');
    expect(drawer.textContent).toContain('2 seats');
    expect(drawer.textContent).toContain('Economy');
    expect(drawer.textContent).toContain('4 seats');
    expect(drawer.querySelectorAll('.seatmap .seat').length).toBe(6);
  });

  it('shows a retryable error inside the drawer when seats fail to load', async () => {
    const m = mocks();
    m.catalog.getAircraftSeats
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of(SEATS));
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.drawer')!.textContent).toContain('Could not load the seat map.');

    el.querySelector<HTMLElement>('.drawer .list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.getAircraftSeats).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer')!.textContent).toContain('Business');
  });

  it('creates an aircraft through the API with a DTO-only payload', async () => {
    const m = mocks([]);
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ac-reg', 'nv-738z');
    setField(el, '#ac-model', 'Boeing 737-800');
    setField(el, '#ac-cap', '180');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.createAircraft).toHaveBeenCalledTimes(1);
    const payload = m.catalog.createAircraft.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toEqual({ registration: 'NV-738Z', model: 'Boeing 737-800', capacity: 180 });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('seats');
    expect(m.toast.success).toHaveBeenCalledWith('Aircraft NV-738Z added to the fleet.');
  });

  it('rejects an invalid registration pattern client-side without calling the API', async () => {
    const m = mocks([]);
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ac-reg', 'N1');
    setField(el, '#ac-model', 'Boeing 737-800');
    setField(el, '#ac-cap', '180');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.catalog.createAircraft).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Registration must be 3–20 characters');
  });

  it('rejects an out-of-range capacity client-side without calling the API', async () => {
    const m = mocks([]);
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ac-reg', 'NV-738Z');
    setField(el, '#ac-model', 'Boeing 737-800');
    setField(el, '#ac-cap', '4');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.catalog.createAircraft).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Capacity must be between 6 and 600 seats.');
  });

  it('shows the duplicate-registration message when the API returns 409', async () => {
    const m = mocks([]);
    m.catalog.createAircraft.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#ac-reg', 'NV-738Z');
    setField(el, '#ac-model', 'Boeing 737-800');
    setField(el, '#ac-cap', '180');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('An aircraft with this registration already exists.');
    expect(el.querySelector('.drawer')).not.toBeNull();
  });

  it('sends an aircraft to maintenance via PATCH {status} and updates the card from the response', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    el.querySelector<HTMLElement>('.actions na-button button')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.catalog.updateAircraft).toHaveBeenCalledWith('ac-1', { status: 'MAINTENANCE' });
    expect(m.toast.success).toHaveBeenCalledWith('NV-738Z sent to maintenance.');
    expect(el.querySelector('.grid')!.textContent).toContain('Maintenance');
  });
});
