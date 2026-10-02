import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ScheduleRulesPage } from './schedule-rules.component';
import { ScheduleRulesService } from '../../../core/services/schedule-rules.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Aircraft, Airport, Route } from '../../../core/models/domain.model';
import type { ScheduleRule, Weekday } from '../../../core/models/schedule-rule-api.model';

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
const ROUTE: Route = {
  id: 'r-1',
  originAirportId: 'a1',
  destinationAirportId: 'a2',
  origin: FRA,
  destination: LHR,
  distanceKm: 654,
  durationMinutes: 105,
  status: 'ACTIVE',
};
const AIRCRAFT: Aircraft = {
  id: 'ac-1',
  registration: 'NV-738Z',
  model: 'Boeing 737-800',
  capacity: 180,
  status: 'ACTIVE',
};

function rule(partial: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'sr-1',
    flightNumber: 'NV720',
    routeId: 'r-1',
    aircraftId: 'ac-1',
    departureTimeLocal: '08:45',
    operatingDays: ['MON', 'WED', 'FRI'],
    effectiveFrom: '2026-03-01',
    effectiveTo: '2026-10-31',
    status: 'ACTIVE',
    originIata: 'FRA',
    destinationIata: 'LHR',
    aircraftRegistration: 'NV-738Z',
    ...partial,
  };
}

function mocks(rules: ScheduleRule[] = [rule()]) {
  return {
    rules: {
      listRules: vi.fn().mockReturnValue(of(rules)),
      createRule: vi.fn().mockReturnValue(of(rule({ id: 'sr-2', flightNumber: 'NV101' }))),
      updateRule: vi.fn().mockReturnValue(of(rule({ status: 'INACTIVE' }))),
    },
    catalog: {
      listRoutes: vi.fn().mockReturnValue(of([ROUTE])),
      listAircraft: vi.fn().mockReturnValue(of([AIRCRAFT])),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<ScheduleRulesPage>> {
  await TestBed.configureTestingModule({
    imports: [ScheduleRulesPage],
    providers: [
      provideRouter([]),
      { provide: ScheduleRulesService, useValue: m.rules },
      { provide: CatalogService, useValue: m.catalog },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScheduleRulesPage);
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

function clickDays(el: HTMLElement, days: Weekday[]): void {
  const buttons = [...el.querySelectorAll<HTMLElement>('.days__row .day')];
  for (const day of days) {
    buttons.find((b) => b.textContent?.trim() === day)!.click();
  }
}

function submitDrawer(el: HTMLElement): void {
  el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
}

async function openCreateDrawer(
  fixture: ComponentFixture<ScheduleRulesPage>,
): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.page__head na-button button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

function fillValidForm(el: HTMLElement): void {
  setField(el, '#sr-number', 'nv101');
  setField(el, '#sr-route', 'r-1');
  setField(el, '#sr-aircraft', 'ac-1');
  setField(el, '#sr-time', '08:45');
  clickDays(el, ['MON', 'WED', 'FRI']);
  setField(el, '#sr-from', '2026-03-01');
  setField(el, '#sr-to', '2026-10-31');
}

describe('ScheduleRulesPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the real rules with route, aircraft, days, effective range and status', async () => {
    const m = mocks([
      rule(),
      rule({
        id: 'sr-2',
        flightNumber: 'NV101',
        status: 'INACTIVE',
        operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.rules.listRules).toHaveBeenCalledTimes(1);
    expect(m.catalog.listRoutes).toHaveBeenCalledTimes(1);
    expect(m.catalog.listAircraft).toHaveBeenCalledTimes(1);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('NV720');
    expect(el.textContent).toContain('FRA → LHR');
    expect(el.textContent).toContain('NV-738Z');
    expect(el.textContent).toContain('08:45');
    expect(el.textContent).toContain('MON, WED, FRI');
    expect(el.textContent).toContain('Daily');
    expect(el.textContent).toContain('2026-03-01 → 2026-10-31');
    expect(el.textContent).toContain('ACTIVE');
    expect(el.textContent).toContain('INACTIVE');
  });

  it('shows an empty state when there are no rules', async () => {
    const fixture = await setup(mocks([]));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No schedule rules');
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.rules.listRules
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([rule()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load schedule rules.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.rules.listRules).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NV720');
  });

  it('hides create and row actions without the flights:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.page__head na-button')).toBeNull();
    expect(el.querySelector('.row-actions na-button')).toBeNull();
    expect(el.textContent).not.toContain('New rule');
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('creates a rule with the exact DTO and updates the list from the response', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    fillValidForm(el);
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.rules.createRule).toHaveBeenCalledTimes(1);
    expect(m.rules.createRule).toHaveBeenCalledWith({
      flightNumber: 'NV101',
      routeId: 'r-1',
      aircraftId: 'ac-1',
      departureTimeLocal: '08:45',
      operatingDays: ['MON', 'WED', 'FRI'],
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-10-31',
    });
    expect(m.toast.success).toHaveBeenCalledWith('Rule NV101 created.');
    expect(el.querySelector('.drawer')).toBeNull();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('NV101');
  });

  it('rejects a bad flight number client-side without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    fillValidForm(el);
    setField(el, '#sr-number', 'AB12');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.rules.createRule).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Flight number must be NV followed by 3–4 digits');
  });

  it('requires at least one operating day without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    fillValidForm(el);
    clickDays(el, ['MON', 'WED', 'FRI']);
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.rules.createRule).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Select at least one operating day.');
  });

  it('blocks an inverted effective range without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    fillValidForm(el);
    setField(el, '#sr-from', '2026-10-31');
    setField(el, '#sr-to', '2026-03-01');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.rules.createRule).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Effective from must be on or before effective to.');
  });

  it('shows the duplicate flight number message when the API returns 409', async () => {
    const m = mocks();
    m.rules.createRule.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    fillValidForm(el);
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('A schedule rule with this flight number already exists.');
    expect(el.querySelector('.drawer')).not.toBeNull();
  });

  it('edits a rule by PATCHing only the changed fields', async () => {
    const m = mocks();
    m.rules.updateRule.mockReturnValue(of(rule({ departureTimeLocal: '09:15' })));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.row-actions na-button button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector<HTMLInputElement>('#sr-number')!.value).toBe('NV720');
    expect(el.querySelector<HTMLInputElement>('#sr-time')!.value).toBe('08:45');

    setField(el, '#sr-time', '09:15');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.rules.updateRule).toHaveBeenCalledWith('sr-1', { departureTimeLocal: '09:15' });
    expect(m.rules.createRule).not.toHaveBeenCalled();
    expect(m.toast.success).toHaveBeenCalledWith('Rule NV720 updated.');
    expect(el.querySelector('.drawer')).toBeNull();
    expect(el.querySelector('tbody')!.textContent).toContain('09:15');
  });

  it('deactivates a rule via PATCH {status} after confirmation and updates the row', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.row-actions .btn--danger')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Deactivate this rule?');

    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.rules.updateRule).toHaveBeenCalledWith('sr-1', { status: 'INACTIVE' });
    expect(m.toast.success).toHaveBeenCalledWith('Rule NV720 deactivated.');
    const row = el.querySelector('tbody tr')!;
    expect(row.textContent).toContain('INACTIVE');
    expect(row.textContent).toContain('Activate');
  });
});
