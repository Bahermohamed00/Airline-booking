import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ManageLookupPage } from './manage-lookup.component';
import { AuthService } from '../../../core/services/auth.service';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';

const ID = 'b1c2d3e4-1111-4222-8333-944455556666';

function booking(overrides: Partial<CustomerBooking> = {}): CustomerBooking {
  return {
    id: ID,
    bookingReference: 'NVA7K2',
    status: 'PENDING',
    totalAmount: 289.5,
    currency: 'EUR',
    contactEmail: 'aya@example.com',
    contactPhone: null,
    cabinClass: 'ECONOMY',
    perPassengerTotal: 289.5,
    bookedAt: '2026-09-20T10:15:00Z',
    flight: null,
    passengers: [],
    seats: [],
    ...overrides,
  };
}

interface SetupOptions {
  loggedIn: boolean;
  myBookings?: ReturnType<typeof vi.fn>;
}

async function setup(opts: SetupOptions) {
  const auth = { isLoggedIn: signal(opts.loggedIn) };
  const bookingService = { myBookings: opts.myBookings ?? vi.fn().mockReturnValue(of([booking()])) };

  await TestBed.configureTestingModule({
    imports: [ManageLookupPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: CustomerBookingService, useValue: bookingService },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ManageLookupPage> = TestBed.createComponent(ManageLookupPage);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, navigate, bookingService };
}

async function submitReference(fixture: ComponentFixture<ManageLookupPage>, el: HTMLElement, reference: string) {
  const input = el.querySelector<HTMLInputElement>('#reference')!;
  input.value = reference;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('ManageLookupPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('redirects guests to login with a returnUrl and explains that sign-in is required', async () => {
    const { fixture, el, navigate, bookingService } = await setup({ loggedIn: false });

    await submitReference(fixture, el, 'NVA7K2');

    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/manage' } });
    expect(bookingService.myBookings).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Sign in required');
  });

  it('finds a booking by reference case-insensitively and navigates to it', async () => {
    const myBookings = vi.fn().mockReturnValue(of([booking({ bookingReference: 'NVA7K2' })]));
    const { fixture, el, navigate } = await setup({ loggedIn: true, myBookings });

    await submitReference(fixture, el, 'nva7k2');

    expect(myBookings).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/bookings', ID]);
    expect(el.textContent).not.toContain('No booking found');
  });

  it('shows an inline error for an unknown reference without navigating or leaking which references exist', async () => {
    const { fixture, el, navigate } = await setup({ loggedIn: true });

    await submitReference(fixture, el, 'UNKNOWN1');

    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('No booking found for this reference');
  });

  it('shows a retryable error when the booking list cannot be loaded', async () => {
    const myBookings = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { fixture, el, navigate } = await setup({ loggedIn: true, myBookings });

    await submitReference(fixture, el, 'NVA7K2');

    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Unable to look up your booking right now');
  });

  it('does nothing while the reference is empty', async () => {
    const { fixture, el, navigate, bookingService } = await setup({ loggedIn: true });

    await submitReference(fixture, el, '');

    expect(bookingService.myBookings).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
