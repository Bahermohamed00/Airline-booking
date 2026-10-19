import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BaggagePage } from './baggage.component';
import { BaggageTrackingService, type TrackedBaggage } from '../../../core/services/baggage-tracking.service';

const BAG: TrackedBaggage = {
  tagNumber: 'NV00000001',
  type: 'CHECKED',
  pieces: 1,
  weightKg: 22,
  status: 'LOADED',
  events: [
    { eventType: 'CHECKED_IN', location: 'FRA Terminal 1', occurredAt: '2026-10-14T08:00:00.000Z' },
    { eventType: 'LOADED', location: 'FRA Ramp B', occurredAt: '2026-10-14T10:00:00.000Z' },
  ],
};

const DELAYED_BAG: TrackedBaggage = {
  ...BAG,
  tagNumber: 'NV00000002',
  status: 'DELAYED',
  events: [...BAG.events, { eventType: 'DELAYED', location: 'JFK Baggage Services', occurredAt: '2026-10-14T12:00:00.000Z' }],
};

interface SetupOptions {
  result?: TrackedBaggage;
  notFound?: boolean;
  fails?: boolean;
}

async function setup(opts: SetupOptions = {}) {
  const track = vi.fn().mockImplementation(() => {
    if (opts.fails) return throwError(() => ({ status: 500 }));
    if (opts.notFound) return of(undefined);
    return of(opts.result ?? BAG);
  });

  await TestBed.configureTestingModule({
    imports: [BaggagePage],
    providers: [provideRouter([]), { provide: BaggageTrackingService, useValue: { track } }],
  }).compileComponents();

  const fixture: ComponentFixture<BaggagePage> = TestBed.createComponent(BaggagePage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, track };
}

async function search(fixture: ComponentFixture<BaggagePage>, el: HTMLElement, tag: string): Promise<void> {
  const input = el.querySelector<HTMLInputElement>('#tag')!;
  input.value = tag;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  (el.querySelector<HTMLButtonElement>('form button[type="submit"]') ?? el.querySelector('form button')!).click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('BaggagePage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('tracks a bag by tag and renders status, facts and journey from the API view', async () => {
    const { fixture, el, track } = await setup();
    await search(fixture, el, 'nv00000001');

    expect(track).toHaveBeenCalledWith('nv00000001');
    expect(el.textContent).toContain('Loaded');
    expect(el.textContent).toContain('NV00000001');
    expect(el.textContent).toContain('Checked bag');
    expect(el.textContent).toContain('22 kg');
    expect(el.textContent).toContain('FRA Terminal 1');
    expect(el.textContent).toContain('FRA Ramp B');
    expect(el.textContent).toContain('Now');
  });

  it('shows the not-found empty state when the API has no bag for the tag', async () => {
    const { fixture, el } = await setup({ notFound: true });
    await search(fixture, el, 'NV99999999');
    expect(el.textContent).toContain('Bag not found');
  });

  it('shows a retryable error state on API failure', async () => {
    const { fixture, el, track } = await setup({ fails: true });
    await search(fixture, el, 'NV00000001');
    expect(el.textContent).toContain('Tracking failed');

    (el.querySelector('.alert__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('does not call the API with an empty tag', async () => {
    const { fixture, el, track } = await setup();
    await search(fixture, el, '');
    expect(track).not.toHaveBeenCalled();
  });

  it('flags delayed/lost bags as exceptions with a support hint', async () => {
    const { fixture, el } = await setup({ result: DELAYED_BAG });
    await search(fixture, el, 'NV00000002');
    expect(el.textContent).toContain('There is an issue with this bag');
    expect(el.textContent).toContain('delayed');
    expect(el.textContent).toContain('Contact support');
  });
});
