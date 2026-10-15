import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FlightHistoryPage } from './flight-history.component';
import {
  FlightOpsService,
  type HistoryItem,
  type HistoryPage as Page,
} from './flight-ops.service';

function item(partial: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'h-1',
    action: 'FLIGHT_STATUS_CHANGED',
    actorType: 'Staff',
    actorId: 'u-1',
    targetType: 'Flight',
    targetId: 'fl-1',
    metadata: { previousStatus: 'SCHEDULED', newStatus: 'COMPLETED' },
    createdAt: '2026-10-07T14:32:00.000Z',
    ...partial,
  };
}

function page(items: HistoryItem[] = [item()], partial: Partial<Page> = {}): Page {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1, ...partial };
}

function mocks(result: Page = page()) {
  return {
    ops: {
      history: vi.fn().mockReturnValue(of(result)),
    },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<FlightHistoryPage>> {
  await TestBed.configureTestingModule({
    imports: [FlightHistoryPage],
    providers: [provideRouter([]), { provide: FlightOpsService, useValue: m.ops }],
  }).compileComponents();

  const fixture = TestBed.createComponent(FlightHistoryPage);
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

describe('FlightHistoryPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads history records with readable action, affected record, actor and before/after detail', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.ops.history).toHaveBeenCalledTimes(1);
    const text = el.textContent!;
    expect(text).toContain('Flight status changed'); // not the raw FLIGHT_STATUS_CHANGED enum
    expect(text).toContain('Flight'); // affected record type, readable
    expect(text).not.toContain('fl-1'); // raw target UUID/ID is not displayed
    expect(text).toContain('Staff');
    expect(text).toContain('Scheduled → Completed'); // status labels, not enums
  });

  it('states that records are immutable and offers no delete affordance', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('cannot be edited or deleted');
    const labels = [...el.querySelectorAll('button')].map((b) => b.textContent?.toLowerCase() ?? '');
    expect(labels.some((l) => l.includes('delete') || l.includes('clear history'))).toBe(false);
  });

  it('filters by domain, action, actor, search and date range', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-domain', 'airports');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(m.ops.history).toHaveBeenLastCalledWith(
      expect.objectContaining({ domain: 'airports', event: undefined, page: 1 }),
    );

    setField(el, '#filter-event', 'AIRPORT_CREATED');
    setField(el, '#filter-actor', 'Staff');
    setField(el, '#filter-search', 'FRA');
    setField(el, '#filter-from', '2026-10-01');
    setField(el, '#filter-to', '2026-10-07');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.ops.history).toHaveBeenLastCalledWith(
      expect.objectContaining({
        domain: 'airports',
        event: 'AIRPORT_CREATED',
        actorType: 'Staff',
        search: 'FRA',
        from: '2026-10-01',
        to: '2026-10-07',
      }),
    );
  });

  it('switching domain clears a now-inconsistent action filter', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-event', 'FLIGHT_CREATED');
    fixture.detectChanges();
    setField(el, '#filter-domain', 'airports');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.ops.history).toHaveBeenLastCalledWith(
      expect.objectContaining({ domain: 'airports', event: undefined }),
    );
  });

  it('clear filters resets every filter and reloads', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#filter-search', 'NV720');
    fixture.detectChanges();
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.filters__clear na-button button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.ops.history).toHaveBeenLastCalledWith(
      expect.objectContaining({
        domain: undefined,
        event: undefined,
        actorType: undefined,
        search: undefined,
        page: 1,
      }),
    );
  });

  it('paginates through the API', async () => {
    const m = mocks(page([item()], { page: 1, total: 60, totalPages: 3 }));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const buttons = el.querySelectorAll<HTMLElement>('.pagination na-button button');
    buttons[1]!.click(); // Next
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.ops.history).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.ops.history.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load history.');

    m.ops.history.mockReturnValue(of(page()));
    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Flight status changed');
  });

  it('renders readable labels for the action filter while keeping raw values for the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const options = [...el.querySelectorAll<HTMLOptionElement>('#filter-event option')];
    const byValue = new Map(options.map((o) => [o.value, o.textContent?.trim()]));
    // Raw enum values are preserved as option values (API contract)…
    expect(byValue.get('FLIGHT_STATUS_CHANGED')).toBe('Flight status changed');
    expect(byValue.get('SCHEDULE_RULE_CREATED')).toBe('Schedule rule created');
    expect(byValue.get('AIRCRAFT_UPDATED')).toBe('Aircraft updated');

    // …and selecting one still sends the raw value to the API.
    setField(el, '#filter-event', 'AIRPORT_CREATED');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(m.ops.history).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'AIRPORT_CREATED' }));
  });

  it('maps record types and falls back to raw values for unknown actions/types', async () => {
    const m = mocks(
      page([
        item({ id: 'a', action: 'ROUTE_UPDATED', targetType: 'Route', metadata: {} }),
        item({ id: 'b', action: 'SCHEDULE_RULE_CREATED', targetType: 'ScheduleRule', metadata: {} }),
        item({ id: 'c', action: 'FUTURE_NEW_EVENT', targetType: 'FutureThing', metadata: {} }),
      ]),
    );
    const fixture = await setup(m);
    const text = (fixture.nativeElement as HTMLElement).textContent!;

    expect(text).toContain('Route updated');
    expect(text).toContain('Schedule rule created');
    // Fallbacks: unknown values pass through unchanged rather than breaking the page.
    expect(text).toContain('FUTURE_NEW_EVENT');
    expect(text).toContain('FutureThing');
  });
});
