import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyBookingsPage } from './my-bookings.component';
import { CustomerBookingService } from '../../core/services/customer-booking.service';
import type { CustomerBooking } from '../../core/models/customer-booking.model';

function booking(overrides: Partial<CustomerBooking> = {}): CustomerBooking {
  return {
    id: 'b1c2d3e4-1111-4222-8333-944455556666',
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

const UPCOMING = booking();
const PAST = booking({
  id: 'b1c2d3e4-2222-4222-8333-944455556666',
  bookingReference: 'PAST01',
  status: 'CONFIRMED',
  flight: {
    id: 'f2',
    flightNumber: 'LH900',
    departureTime: '2020-01-10T09:30:00Z',
    arrivalTime: '2020-01-10T11:05:00Z',
    status: 'COMPLETED',
    origin: 'FRA',
    destination: 'JFK',
  },
});
const CANCELLED = booking({ id: 'b1c2d3e4-3333-4222-8333-944455556666', bookingReference: 'CANC01', status: 'CANCELLED' });

async function setup(myBookings: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [MyBookingsPage],
    providers: [provideRouter([]), { provide: CustomerBookingService, useValue: { myBookings } }],
  }).compileComponents();

  const fixture: ComponentFixture<MyBookingsPage> = TestBed.createComponent(MyBookingsPage);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, navigate };
}

function tab(el: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="tab"]')).find((b) =>
    b.textContent?.includes(label),
  );
  if (!found) throw new Error(`tab ${label} not found`);
  return found;
}

async function settle(fixture: ComponentFixture<MyBookingsPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('MyBookingsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the owner-scoped list via the API and renders the upcoming tab', async () => {
    const myBookings = vi.fn().mockReturnValue(of([UPCOMING, PAST, CANCELLED]));
    const { el } = await setup(myBookings);

    expect(myBookings).toHaveBeenCalledOnce();
    expect(tab(el, 'Upcoming').textContent).toContain('1');
    expect(tab(el, 'Past').textContent).toContain('1');
    expect(tab(el, 'Cancelled').textContent).toContain('1');

    const cards = el.querySelectorAll<HTMLElement>('ul.cards li.journey');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('FRA');
    expect(cards[0].textContent).toContain('LHR');
    expect(cards[0].textContent).toContain('LH101');
    expect(cards[0].textContent).toContain('NVA7K2');
    expect(cards[0].textContent).toContain('1 passenger');
    expect(cards[0].textContent).toContain('Economy');
  });

  it('switches between upcoming, past and cancelled buckets', async () => {
    const myBookings = vi.fn().mockReturnValue(of([UPCOMING, PAST, CANCELLED]));
    const { fixture, el } = await setup(myBookings);

    tab(el, 'Past').click();
    await settle(fixture);
    expect(el.querySelectorAll('ul.cards li.journey').length).toBe(1);
    expect(el.textContent).toContain('PAST01');

    tab(el, 'Cancelled').click();
    await settle(fixture);
    expect(el.querySelectorAll('ul.cards li.journey').length).toBe(1);
    expect(el.textContent).toContain('CANC01');
    expect(el.textContent).toContain('Cancelled');
  });

  it('renders the empty state when there are no bookings', async () => {
    const myBookings = vi.fn().mockReturnValue(of([]));
    const { el } = await setup(myBookings);

    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('No upcoming journeys');
  });

  it('shows an error state and retries', async () => {
    const myBookings = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of([UPCOMING]));
    const { fixture, el } = await setup(myBookings);

    expect(el.querySelector('.alert--danger')).not.toBeNull();
    (el.querySelector('.alert__retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(myBookings).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NVA7K2');
  });

  it('never offers check-in for a PENDING booking — it shows a payment hint and a manage action', async () => {
    const myBookings = vi.fn().mockReturnValue(of([UPCOMING]));
    const { fixture, el, navigate } = await setup(myBookings);

    const card = el.querySelector<HTMLElement>('ul.cards li.journey')!;
    const buttons = Array.from(card.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).not.toContain('Check in');
    expect(card.textContent).toContain('Payment pending');

    const manage = Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Manage'),
    )!;
    manage.click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith(['/bookings', UPCOMING.id]);
  });

  it('offers check-in only for confirmed bookings', async () => {
    const confirmed = booking({ status: 'CONFIRMED' });
    const myBookings = vi.fn().mockReturnValue(of([confirmed]));
    const { el } = await setup(myBookings);

    const card = el.querySelector<HTMLElement>('ul.cards li.journey')!;
    const buttons = Array.from(card.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Check in');
    expect(card.textContent).not.toContain('Payment pending');
  });

  it('keeps bookings without flight details visible in the upcoming tab', async () => {
    const noFlight = booking({ flight: null });
    const myBookings = vi.fn().mockReturnValue(of([noFlight]));
    const { el } = await setup(myBookings);

    const card = el.querySelector<HTMLElement>('ul.cards li.journey');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('Flight details are being finalized');
    expect(card!.textContent).toContain('NVA7K2');
  });
});
