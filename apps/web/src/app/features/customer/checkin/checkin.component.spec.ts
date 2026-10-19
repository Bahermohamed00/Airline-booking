import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CheckInPage } from './checkin.component';
import { CheckInApiService } from '../../../core/services/checkin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import type { CheckInBooking, CheckInResponse } from '../../../core/models/checkin.model';

function booking(overrides: Partial<CheckInBooking> = {}): CheckInBooking {
  return {
    id: 'bk-1',
    bookingReference: 'T3ST99',
    status: 'CONFIRMED',
    contactEmail: 'aya@example.com',
    flight: {
      id: 'fl-1',
      flightNumber: 'NV777',
      departureTime: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      arrivalTime: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
      route: {
        originIata: 'FRA',
        destinationIata: 'JFK',
        originCity: 'Frankfurt',
        destinationCity: 'New York',
      },
    },
    segments: [{ id: 'seg-1', segmentNumber: 1 }],
    passengers: [
      {
        bookingPassengerId: 'bp-1',
        firstName: 'Aya',
        lastName: 'Mansour',
        passengerType: 'ADULT',
        seatNumber: '12A',
        checkedIn: false,
      },
      {
        bookingPassengerId: 'bp-2',
        firstName: 'Omar',
        lastName: 'Mansour',
        passengerType: 'ADULT',
        seatNumber: null,
        checkedIn: true,
      },
    ],
    ...overrides,
  };
}

function checkInResponse(overrides: Partial<CheckInResponse> = {}): CheckInResponse {
  return {
    checkIns: [
      {
        id: 'ci-1',
        bookingPassengerId: 'bp-1',
        flightSegmentId: 'seg-1',
        checkInTime: new Date().toISOString(),
        status: 'COMPLETED',
        boardingPass: {
          id: 'pass-1',
          boardingGroup: 'B',
          seatNumber: '12A',
          gate: null,
          issuedAt: new Date().toISOString(),
        },
      },
    ],
    bookingStatus: 'CHECKED_IN',
    baggage: [],
    ...overrides,
  };
}

interface Setup {
  fixture: ComponentFixture<CheckInPage>;
  component: CheckInPage;
  el: HTMLElement;
  api: {
    lookupByReference: ReturnType<typeof vi.fn>;
    lookupByEmail: ReturnType<typeof vi.fn>;
    checkIn: ReturnType<typeof vi.fn>;
    boardingPass: ReturnType<typeof vi.fn>;
  };
  router: Router;
}

async function setup(opts: { loggedIn?: boolean } = {}): Promise<Setup> {
  const api = {
    lookupByReference: vi.fn().mockReturnValue(of([booking()])),
    lookupByEmail: vi.fn().mockReturnValue(of([booking()])),
    checkIn: vi.fn().mockReturnValue(of(checkInResponse())),
    boardingPass: vi.fn(),
  };
  await TestBed.configureTestingModule({
    imports: [CheckInPage],
    providers: [
      provideRouter([]),
      { provide: CheckInApiService, useValue: api },
      { provide: AuthService, useValue: { isLoggedIn: signal(opts.loggedIn ?? true) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CheckInPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return {
    fixture,
    component: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
    api,
    router,
  };
}

function submitLookup(s: Setup): void {
  s.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
}

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function settle(s: Setup): Promise<void> {
  await s.fixture.whenStable();
  s.fixture.detectChanges();
}

describe('CheckInPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the reference input by default and hides the email input', async () => {
    const { el, component } = await setup();
    expect(component.lookupMode()).toBe('reference');
    expect(el.querySelector('#reference')).not.toBeNull();
    expect(el.querySelector('#email')).toBeNull();
    expect(el.textContent).toContain('Find your booking');
  });

  it('toggles to email mode via the segmented control, swapping the visible input', async () => {
    const s = await setup();
    const buttons = s.el.querySelectorAll<HTMLButtonElement>('na-segmented .seg__btn');
    expect(buttons).toHaveLength(2);
    buttons[1]!.click();
    await settle(s);

    expect(s.component.lookupMode()).toBe('email');
    expect(s.el.querySelector('#email')).not.toBeNull();
    expect(s.el.querySelector('#reference')).toBeNull();

    buttons[0]!.click();
    await settle(s);
    expect(s.component.lookupMode()).toBe('reference');
  });

  it('keeps the submit disabled until the reference is filled, then looks up by reference', async () => {
    const s = await setup();
    const submit = s.el.querySelector<HTMLButtonElement>('form na-button button')!;
    expect(submit.disabled).toBe(true);

    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    expect(submit.disabled).toBe(false);

    submitLookup(s);
    await settle(s);
    expect(s.api.lookupByReference).toHaveBeenCalledWith('T3ST99');
    expect(s.api.lookupByEmail).not.toHaveBeenCalled();
  });

  it('validates email format in email mode and looks up by email', async () => {
    const s = await setup();
    s.el.querySelectorAll<HTMLButtonElement>('na-segmented .seg__btn')[1]!.click();
    await settle(s);

    setInput(s.el, '#email', 'not-an-email');
    await settle(s);
    expect(s.el.querySelector<HTMLButtonElement>('form na-button button')!.disabled).toBe(true);

    setInput(s.el, '#email', 'aya@example.com');
    await settle(s);
    submitLookup(s);
    await settle(s);
    expect(s.api.lookupByEmail).toHaveBeenCalledWith('aya@example.com');
    expect(s.api.lookupByReference).not.toHaveBeenCalled();
  });

  it('shows a loading spinner while the lookup is in flight', async () => {
    const s = await setup();
    const pending = new Subject<CheckInBooking[]>();
    s.api.lookupByReference.mockReturnValue(pending.asObservable());

    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    s.fixture.detectChanges();

    expect(s.component.lookupLoading()).toBe(true);
    expect(s.el.querySelector('form .btn__spinner')).not.toBeNull();

    pending.next([booking()]);
    pending.complete();
    await settle(s);
    expect(s.component.lookupLoading()).toBe(false);
  });

  it('shows "No booking found" on a 404 lookup', async () => {
    const s = await setup();
    s.api.lookupByReference.mockReturnValue(
      throwError(() => ({ status: 404, error: { code: 'BOOKING_NOT_FOUND' } })),
    );
    setInput(s.el, '#reference', 'ZZZZZZ');
    await settle(s);
    submitLookup(s);
    await settle(s);

    expect(s.el.querySelector('na-alert')?.textContent).toContain('No booking found');
    expect(s.component.results()).toBeNull();
  });

  it('shows the email-mismatch message when the server rejects with EMAIL_MISMATCH', async () => {
    const s = await setup();
    s.api.lookupByEmail.mockReturnValue(
      throwError(() => ({ status: 403, error: { code: 'EMAIL_MISMATCH' } })),
    );
    s.el.querySelectorAll<HTMLButtonElement>('na-segmented .seg__btn')[1]!.click();
    await settle(s);
    setInput(s.el, '#email', 'someone@else.dev');
    await settle(s);
    submitLookup(s);
    await settle(s);

    expect(s.el.querySelector('na-alert')?.textContent).toContain(
      "This email doesn't match your account",
    );
  });

  it('shows a retryable alert on generic failure and retry recovers', async () => {
    const s = await setup();
    s.api.lookupByReference
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of([booking()]));

    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);

    const retry = s.el.querySelector<HTMLButtonElement>('na-alert .alert__retry');
    expect(retry).not.toBeNull();
    retry!.click();
    await settle(s);

    expect(s.api.lookupByReference).toHaveBeenCalledTimes(2);
    expect(s.el.querySelector('.mine__list')).not.toBeNull();
  });

  it('renders lookup results with route, flight, reference and status badge', async () => {
    const s = await setup();
    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);

    const row = s.el.querySelector('.mine__row')!;
    expect(row.textContent).toContain('FRA');
    expect(row.textContent).toContain('JFK');
    expect(row.textContent).toContain('NV777');
    expect(row.textContent).toContain('T3ST99');
    expect(row.textContent).toContain('Confirmed');
  });

  it('select opens the detail with per-passenger rows fed by real API data', async () => {
    const s = await setup();
    submitLookup(s);
    await settle(s);
    // reference input must be filled for the form to be valid
    expect(s.api.lookupByReference).not.toHaveBeenCalled();

    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);

    s.el.querySelector<HTMLButtonElement>('.mine__row na-button button')!.click();
    await settle(s);

    const detail = s.el.querySelector('.detail')!;
    expect(detail.textContent).toContain('Aya Mansour');
    expect(detail.textContent).toContain('Omar Mansour');
    expect(detail.textContent).toContain('Seat 12A');
    expect(detail.textContent).toContain('Seat assigned at gate');
    // Already checked-in passenger shows the state, not the confirm checkbox.
    expect(detail.textContent).toContain('Checked in');
    expect(s.el.querySelector('#doc-bp-2')).toBeNull();
    expect(s.el.querySelector('#doc-bp-1')).not.toBeNull();
  });

  it('requires document confirmation before completing check-in', async () => {
    const s = await setup();
    s.api.lookupByReference.mockReturnValue(
      of([
        booking({
          passengers: [booking().passengers[0]!],
        }),
      ]),
    );
    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.mine__row na-button button')!.click();
    await settle(s);

    const completeBtn = s.el.querySelector<HTMLButtonElement>('.pax na-button button')!;
    expect(completeBtn.disabled).toBe(true);

    const checkbox = s.el.querySelector<HTMLInputElement>('#doc-bp-1')!;
    checkbox.click();
    await settle(s);
    expect(completeBtn.disabled).toBe(false);
  });

  it('completes check-in via the API and updates passenger and booking status from the response', async () => {
    const s = await setup();
    s.api.lookupByReference.mockReturnValue(
      of([booking({ passengers: [booking().passengers[0]!] })]),
    );
    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.mine__row na-button button')!.click();
    await settle(s);

    s.el.querySelector<HTMLInputElement>('#doc-bp-1')!.click();
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.pax na-button button')!.click();
    await settle(s);

    expect(s.api.checkIn).toHaveBeenCalledWith('bk-1', 'bp-1', 0);
    const selected = s.component.selected()!;
    expect(selected.status).toBe('CHECKED_IN');
    expect(selected.passengers[0]!.checkedIn).toBe(true);
    expect(s.el.querySelector('.detail')!.textContent).toContain("You're checked in");
    expect(s.el.querySelector('.detail')!.textContent).toContain('Checked in'); // status badge
  });

  it('declares checked bags at check-in and shows the issued tags with a tracking link', async () => {
    const s = await setup();
    s.api.lookupByReference.mockReturnValue(
      of([booking({ passengers: [booking().passengers[0]!] })]),
    );
    s.api.checkIn.mockReturnValue(
      of(
        checkInResponse({
          baggage: [
            { tagNumber: 'NV48291037', status: 'CHECKED_IN' },
            { tagNumber: 'NV01736485', status: 'CHECKED_IN' },
          ],
        }),
      ),
    );
    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.mine__row na-button button')!.click();
    await settle(s);

    // Declare two checked bags, confirm documents, complete check-in.
    const select = s.el.querySelector<HTMLSelectElement>('#bags-bp-1')!;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await settle(s);
    s.el.querySelector<HTMLInputElement>('#doc-bp-1')!.click();
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.pax na-button button')!.click();
    await settle(s);

    expect(s.api.checkIn).toHaveBeenCalledWith('bk-1', 'bp-1', 2);
    const text = s.el.querySelector('.detail')!.textContent!;
    expect(text).toContain('NV48291037');
    expect(text).toContain('NV01736485');
    expect(s.el.querySelector('.success__bags a')?.getAttribute('href')).toBe('/baggage');
  });

  it.each([
    ['CHECKIN_NOT_OPEN', 'not open yet'],
    ['CHECKIN_CLOSED', 'has closed'],
    ['ALREADY_CHECKED_IN', 'already checked in'],
    ['CHECKIN_NOT_ELIGIBLE', 'not eligible'],
  ])('maps the 409 code %s to a clear message', async (code, fragment) => {
    const s = await setup();
    s.api.lookupByReference.mockReturnValue(
      of([booking({ passengers: [booking().passengers[0]!] })]),
    );
    s.api.checkIn.mockReturnValue(
      throwError(() => ({ status: 409, error: { code, message: 'server message' } })),
    );
    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.mine__row na-button button')!.click();
    await settle(s);
    s.el.querySelector<HTMLInputElement>('#doc-bp-1')!.click();
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.pax na-button button')!.click();
    await settle(s);

    expect(s.el.querySelector('.detail na-alert')?.textContent).toContain(fragment);
  });

  it('shows the "not open yet" window with countdown when departure is more than 24h away', async () => {
    const s = await setup();
    s.api.lookupByReference.mockReturnValue(
      of([
        booking({
          flight: {
            ...booking().flight,
            departureTime: new Date(Date.now() + 30 * 3600 * 1000).toISOString(),
            arrivalTime: new Date(Date.now() + 32 * 3600 * 1000).toISOString(),
          },
        }),
      ]),
    );
    setInput(s.el, '#reference', 'T3ST99');
    await settle(s);
    submitLookup(s);
    await settle(s);
    s.el.querySelector<HTMLButtonElement>('.mine__row na-button button')!.click();
    await settle(s);

    const alert = s.el.querySelector('.detail na-alert');
    expect(alert?.textContent).toContain('Check-in not open yet');
    expect(alert?.textContent).toContain('opens at');
  });

  it('prompts for sign-in when reached logged out', async () => {
    const s = await setup({ loggedIn: false });
    expect(s.el.querySelector('na-empty-state')?.textContent).toContain('Sign in to check in');
    s.el.querySelector<HTMLButtonElement>('na-empty-state na-button button')!.click();
    await settle(s);
    expect(s.router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/checkin' },
    });
  });

  it('contains no mock bookings or legacy mock services in its sources', () => {
    const dir = join(process.cwd(), 'src/app/features/customer/checkin');
    const html = readFileSync(join(dir, 'checkin.component.html'), 'utf8');
    const ts = readFileSync(join(dir, 'checkin.component.ts'), 'utf8');
    for (const ref of ['FRALAX', 'FRALHR', 'NV150', 'NV360', 'NVA7K2', 'NVM3P8']) {
      expect(html).not.toContain(ref);
      expect(ts).not.toContain(ref);
    }
    expect(html).not.toContain('Search flights');
    expect(ts).not.toContain('BookingService');
    expect(ts).not.toContain('domain-services');
    expect(ts).not.toContain('core/mock');
  });
});
