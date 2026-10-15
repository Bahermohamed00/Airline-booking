import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BoardingPassPage } from './boarding-pass.component';
import { CheckInApiService } from '../../../core/services/checkin-api.service';
import type { BoardingPassResponse } from '../../../core/models/checkin.model';

function response(overrides: Partial<BoardingPassResponse> = {}): BoardingPassResponse {
  return {
    id: 'bk-1',
    bookingReference: 'T3ST99',
    status: 'CHECKED_IN',
    flight: {
      id: 'fl-1',
      flightNumber: 'NV777',
      departureTime: '2026-10-01T09:00:00Z',
      arrivalTime: '2026-10-01T13:00:00Z',
      route: {
        originIata: 'FRA',
        destinationIata: 'JFK',
        originCity: 'Frankfurt',
        destinationCity: 'New York',
      },
    },
    checkIns: [
      {
        id: 'ci-1',
        bookingPassengerId: 'bp-1',
        flightSegmentId: 'seg-1',
        checkInTime: '2026-09-30T09:00:00Z',
        status: 'COMPLETED',
        passenger: { firstName: 'Aya', lastName: 'Mansour' },
        baggage: [],
        boardingPass: {
          id: 'pass-1',
          boardingGroup: 'B',
          seatNumber: '12A',
          gate: null,
          issuedAt: '2026-09-30T09:00:00Z',
        },
      },
    ],
    ...overrides,
  };
}

interface Setup {
  fixture: ComponentFixture<BoardingPassPage>;
  el: HTMLElement;
  api: { boardingPass: ReturnType<typeof vi.fn> };
}

async function setup(
  boardingPassImpl: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(of(response())),
): Promise<Setup> {
  const api = { boardingPass: boardingPassImpl };
  await TestBed.configureTestingModule({
    imports: [BoardingPassPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ bookingId: 'bk-1' }) } },
      },
      { provide: CheckInApiService, useValue: api },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(BoardingPassPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api };
}

describe('BoardingPassPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the boarding pass from the API for the route bookingId', async () => {
    const { api } = await setup();
    expect(api.boardingPass).toHaveBeenCalledWith('bk-1');
  });

  it('renders real pass data, with a graceful TBA for a null gate', async () => {
    const { el } = await setup();
    const text = el.textContent!;
    expect(text).toContain('Aya Mansour');
    expect(text).toContain('NV777');
    expect(text).toContain('FRA');
    expect(text).toContain('JFK');
    expect(text).toContain('12A');
    expect(text).toContain('T3ST99');
    const grid = el.querySelector('.pass__grid')!;
    expect(grid.textContent).toContain('B'); // boarding group
    expect(grid.textContent).toContain('TBA'); // null gate
    expect(el.querySelector('.pass__stub')?.textContent).toContain('T3ST99');
  });

  it('shows issued bag tags on the pass when the passenger checked bags', async () => {
    const withBags = response({
      checkIns: [
        {
          ...response().checkIns[0]!,
          baggage: [
            { tagNumber: 'NV48291037', status: 'CHECKED_IN' },
            { tagNumber: 'NV01736485', status: 'CHECKED_IN' },
          ],
        },
      ],
    });
    const { el } = await setup(vi.fn().mockReturnValue(of(withBags)));
    const grid = el.querySelector('.pass__grid')!;
    expect(grid.textContent).toContain('Bag tags');
    expect(grid.textContent).toContain('NV48291037');
    expect(grid.textContent).toContain('NV01736485');
  });

  it('omits the bag-tag row when no bags were checked', async () => {
    const { el } = await setup(vi.fn().mockReturnValue(of(response())));
    expect(el.querySelector('.pass__grid')!.textContent).not.toContain('Bag tags');
  });

  it('shows the empty state when the booking has no completed check-ins', async () => {
    const { el } = await setup(vi.fn().mockReturnValue(of(response({ checkIns: [] }))));
    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('No boarding pass available');
    expect(el.textContent).toContain('Complete online check-in to get your boarding pass.');
  });

  it('shows the empty state gracefully when the flight summary is null', async () => {
    const { el } = await setup(vi.fn().mockReturnValue(of(response({ flight: null }))));
    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.querySelector('.pass')).toBeNull();
  });

  it('shows a retryable error state when the API fails, and retry recovers', async () => {
    const boardingPass = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of(response()));
    const { fixture, el } = await setup(boardingPass);

    expect(el.querySelector('na-alert .alert__retry')).not.toBeNull();
    (el.querySelector('na-alert .alert__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(boardingPass).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.pass')).not.toBeNull();
  });
});
