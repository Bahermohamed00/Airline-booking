import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ConfirmationPage } from './confirmation.component';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { BookingDraftService } from './booking-draft.service';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';
import type { BookingDraft } from '../../../core/models/booking-flow.model';

const ID = 'b1c2d3e4-1111-4222-8333-944455556666';

function booking(overrides: Partial<CustomerBooking> = {}): CustomerBooking {
  return {
    id: ID,
    bookingReference: 'NVA7K2',
    status: 'PENDING',
    totalAmount: 289.5,
    currency: 'EUR',
    contactEmail: 'aya@example.com',
    contactPhone: '+49 170 1234567',
    cabinClass: 'ECONOMY',
    perPassengerTotal: 289.5,
    bookedAt: '2026-09-20T10:15:00Z',
    flight: {
      id: 'f1',
      flightNumber: 'LH101',
      departureTime: '2027-01-10T09:30:00Z',
      arrivalTime: '2027-01-10T11:05:00Z',
      status: 'SCHEDULED',
      origin: 'FRA',
      destination: 'LHR',
    },
    passengers: [
      {
        id: 'p1',
        firstName: 'Aya',
        lastName: 'Mansour',
        dateOfBirth: '1994-03-12',
        nationality: 'Germany',
        passportNumber: 'C01X00T47',
        passengerType: 'ADULT',
      },
    ],
    seats: [
      { seatId: 's1', seatNumber: '12A', holdStatus: 'ACTIVE', holdExpiresAt: '2026-09-20T10:30:00Z' },
    ],
    ...overrides,
  };
}

interface SetupOptions {
  id?: string | null;
  confirmed?: CustomerBooking | null;
  getById?: ReturnType<typeof vi.fn>;
}

async function setup(opts: SetupOptions = {}) {
  const draftValue = opts.confirmed ? ({ confirmedBooking: opts.confirmed } as unknown as BookingDraft) : null;
  const draftService = { draft: signal<BookingDraft | null>(draftValue), clear: vi.fn() };
  const bookingService = {
    getById: opts.getById ?? vi.fn().mockReturnValue(of(booking())),
  };

  await TestBed.configureTestingModule({
    imports: [ConfirmationPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(opts.id ? { id: opts.id } : {}) } },
      },
      { provide: CustomerBookingService, useValue: bookingService },
      { provide: BookingDraftService, useValue: draftService },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ConfirmationPage> = TestBed.createComponent(ConfirmationPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, draftService, bookingService };
}

describe('ConfirmationPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the freshly created booking from the draft when the id matches, without calling the API', async () => {
    const { el, draftService, bookingService } = await setup({ id: ID, confirmed: booking() });

    expect(bookingService.getById).not.toHaveBeenCalled();
    expect(draftService.clear).toHaveBeenCalledOnce();
    expect(el.querySelector('.hero__ref')?.textContent).toContain('NVA7K2');
    expect(el.textContent).toContain('LH101');
    expect(el.textContent).toContain('FRA');
    expect(el.textContent).toContain('LHR');
    expect(el.textContent).toContain('Aya Mansour');
    expect(el.textContent).toContain('12A');
    expect(el.textContent).toContain('€289.50');
  });

  it('falls back to GET by id when the draft holds no matching booking', async () => {
    const getById = vi.fn().mockReturnValue(of(booking({ bookingReference: 'ZX9QWE' })));
    const { el, draftService } = await setup({ id: ID, confirmed: null, getById });

    expect(getById).toHaveBeenCalledWith(ID);
    expect(el.querySelector('.hero__ref')?.textContent).toContain('ZX9QWE');
    // The funnel only resets once a booking was actually obtained.
    expect(draftService.clear).toHaveBeenCalledOnce();
  });

  it('shows honest pending-payment messaging with a Pay now link and never payment-success wording', async () => {
    const { el } = await setup({ id: ID, confirmed: booking() });

    expect(el.textContent).toContain('Payment pending');
    expect(el.textContent).toContain('Pending payment'); // status badge
    expect(el.textContent).toContain('no payment has been taken');
    expect(el.textContent).not.toContain('confirmed');
    expect(el.textContent).not.toContain('Confirmed');
    expect(el.textContent).not.toContain('Total paid');
    expect(el.textContent).not.toContain('confirmation email');

    // The Pay now link goes to the manage-booking page where payment happens.
    const payLink = Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).find((a) =>
      a.textContent?.trim().includes('Pay now'),
    );
    expect(payLink?.getAttribute('href')).toBe(`/bookings/${ID}`);
  });

  it('shows a not-found state with search and bookings links when the id is missing', async () => {
    const { el, bookingService } = await setup({ id: null });

    expect(bookingService.getById).not.toHaveBeenCalled();
    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('Booking not found');
    const hrefs = Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/bookings');
    expect(hrefs).toContain('/search');
  });

  it('shows the not-found state for a malformed id without calling the API', async () => {
    const { el, bookingService } = await setup({ id: 'not-a-uuid' });

    expect(bookingService.getById).not.toHaveBeenCalled();
    expect(el.querySelector('na-empty-state')).not.toBeNull();
  });

  it('shows a retryable error state when the fetch fails, and retry recovers', async () => {
    const getById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of(booking()));
    const { fixture, el } = await setup({ id: ID, getById });

    expect(el.querySelector('na-alert .alert__retry')).not.toBeNull();
    (el.querySelector('na-alert .alert__retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getById).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.hero__ref')?.textContent).toContain('NVA7K2');
  });
});
