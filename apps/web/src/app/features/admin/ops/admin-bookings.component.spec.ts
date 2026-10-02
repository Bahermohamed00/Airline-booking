import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AdminBookingsPage } from './admin-bookings.component';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AuditService, type AuditLogPage } from '../../../core/services/audit.service';
import { AuthService } from '../../../core/services/auth.service';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';

function booking(partial: Partial<CustomerBooking> = {}): CustomerBooking {
  return {
    id: 'bk-1',
    bookingReference: 'NVABC1',
    status: 'PENDING',
    totalAmount: 498.5,
    currency: 'EUR',
    contactEmail: 'lena@example.com',
    contactPhone: '+49 170 1234567',
    cabinClass: 'ECONOMY',
    perPassengerTotal: 249.25,
    bookedAt: '2026-01-10T09:30:00Z',
    flight: {
      id: 'fl-1',
      flightNumber: 'NV123',
      departureTime: '2026-02-01T08:00:00Z',
      arrivalTime: '2026-02-01T12:00:00Z',
      status: 'SCHEDULED',
      origin: 'FRA',
      destination: 'JFK',
    },
    passengers: [
      {
        id: 'p1',
        firstName: 'Lena',
        lastName: 'Hoffmann',
        dateOfBirth: '1990-05-12',
        nationality: 'DE',
        passportNumber: 'C01X00T47',
        passengerType: 'ADULT',
      },
    ],
    seats: [
      {
        seatId: 'st-1',
        seatNumber: '12A',
        holdStatus: 'CONVERTED',
        holdExpiresAt: '2026-01-10T09:45:00Z',
      },
    ],
    ...partial,
  };
}

const AUDIT_PAGE: AuditLogPage = {
  items: [
    {
      id: 'log-1',
      event: 'BOOKING_CREATED',
      actorType: 'User',
      actorId: 'u-1',
      targetType: 'Booking',
      targetId: 'bk-1',
      ipAddress: null,
      createdAt: '2026-01-10T09:30:01Z',
      metadata: {},
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
};

function mocks(list: CustomerBooking[] = [booking()]) {
  return {
    bookings: {
      listAdmin: vi.fn().mockReturnValue(of(list)),
      getAdmin: vi.fn().mockReturnValue(of(list[0] ?? booking())),
    },
    audit: { listLogs: vi.fn().mockReturnValue(of(AUDIT_PAGE)) },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminBookingsPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminBookingsPage],
    providers: [
      provideRouter([]),
      { provide: CustomerBookingService, useValue: m.bookings },
      { provide: AuditService, useValue: m.audit },
      { provide: AuthService, useValue: m.auth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminBookingsPage);
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

function submitFilters(el: HTMLElement): void {
  el.querySelector<HTMLFormElement>('form.filters')!.dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
}

async function openRow(fixture: ComponentFixture<AdminBookingsPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('tbody tr')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

async function switchTab(
  fixture: ComponentFixture<AdminBookingsPage>,
  label: string,
): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  const tab = Array.from(el.querySelectorAll<HTMLElement>('.tabs .tab')).find((b) =>
    b.textContent?.includes(label),
  )!;
  tab.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AdminBookingsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the real booking list via listAdmin and renders rows from the flat view', async () => {
    const m = mocks([
      booking(),
      booking({
        id: 'bk-2',
        bookingReference: 'NVXYZ9',
        status: 'CONFIRMED',
        contactEmail: 'omar@example.com',
      }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.bookings.listAdmin).toHaveBeenCalledWith({});
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    const text = el.textContent!;
    expect(text).toContain('NVABC1');
    expect(text).toContain('NV123 FRA→JFK');
    expect(text).toContain('lena@example.com');
    expect(text).toContain('Economy');
    expect(text).toContain('€498.50');
    expect(text).toContain('Pending payment');
    expect(text).toContain('Confirmed');
  });

  it('shows a loading skeleton while the list loads', async () => {
    const m = mocks();
    const pending = new Subject<CustomerBooking[]>();
    m.bookings.listAdmin.mockReturnValue(pending.asObservable());
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.table-loading na-skeleton')).not.toBeNull();
    expect(el.querySelector('tbody tr')).toBeNull();
  });

  it('shows an empty state when there are no bookings', async () => {
    const fixture = await setup(mocks([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No bookings found');
    expect(el.querySelector('tbody tr')).toBeNull();
  });

  it('shows a retryable error state when the list fails to load', async () => {
    const m = mocks();
    m.bookings.listAdmin
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([booking()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load bookings.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.bookings.listAdmin).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NVABC1');
  });

  it('submits the reference filter as a server-side query', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#booking-reference', 'NVABC1');
    fixture.detectChanges();
    submitFilters(el);
    await fixture.whenStable();

    expect(m.bookings.listAdmin).toHaveBeenLastCalledWith({ reference: 'NVABC1' });
  });

  it('submits the email filter as a server-side query', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#booking-email', 'lena@example.com');
    fixture.detectChanges();
    submitFilters(el);
    await fixture.whenStable();

    expect(m.bookings.listAdmin).toHaveBeenLastCalledWith({ email: 'lena@example.com' });
  });

  it('reloads through the API when the status filter changes', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#booking-status', 'CONFIRMED');
    await fixture.whenStable();

    expect(m.bookings.listAdmin).toHaveBeenLastCalledWith({ status: 'CONFIRMED' });
    expect(m.bookings.listAdmin).toHaveBeenCalledTimes(2);
  });

  it('combines reference, email and status into one query', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#booking-reference', 'NVABC1');
    setField(el, '#booking-email', 'lena@example.com');
    fixture.detectChanges();
    setField(el, '#booking-status', 'PENDING');
    await fixture.whenStable();

    expect(m.bookings.listAdmin).toHaveBeenLastCalledWith({
      reference: 'NVABC1',
      email: 'lena@example.com',
      status: 'PENDING',
    });
  });

  it('has no passenger-name or flight-number search inputs', async () => {
    const fixture = await setup(mocks());
    const el = fixture.nativeElement as HTMLElement;

    const placeholders = Array.from(el.querySelectorAll('input')).map((i) =>
      (i.getAttribute('placeholder') ?? '').toLowerCase(),
    );
    expect(placeholders.some((p) => p.includes('passenger'))).toBe(false);
    expect(placeholders.some((p) => p.includes('flight'))).toBe(false);
    expect(el.querySelector('#booking-query')).toBeNull();
  });

  it('clearing the filters reloads the unfiltered list', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#booking-reference', 'NVABC1');
    fixture.detectChanges();
    submitFilters(el);
    await fixture.whenStable();
    expect(m.bookings.listAdmin).toHaveBeenLastCalledWith({ reference: 'NVABC1' });

    const clear = Array.from(el.querySelectorAll<HTMLElement>('.filters na-button button')).find(
      (b) => b.textContent?.includes('Clear'),
    )!;
    clear.click();
    await fixture.whenStable();

    expect(m.bookings.listAdmin).toHaveBeenLastCalledWith({});
  });

  it('lazily loads the booking detail once and serves reopens from cache', async () => {
    const m = mocks();
    const fixture = await setup(m);

    expect(m.bookings.getAdmin).not.toHaveBeenCalled();

    const el = await openRow(fixture);
    expect(m.bookings.getAdmin).toHaveBeenCalledTimes(1);
    expect(m.bookings.getAdmin).toHaveBeenCalledWith('bk-1');
    expect(el.querySelector('.drawer')).not.toBeNull();

    el.querySelector<HTMLElement>('.drawer__close')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.drawer')).toBeNull();

    await openRow(fixture);
    expect(m.bookings.getAdmin).toHaveBeenCalledTimes(1);
  });

  it('renders the real booking sections: totals, contact, flight, passengers and booking-level seats', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openRow(fixture);
    const drawer = el.querySelector('.drawer')!;

    expect(drawer.textContent).toContain('€498.50');
    expect(drawer.textContent).toContain('€249.25');
    expect(drawer.textContent).toContain('lena@example.com');
    expect(drawer.textContent).toContain('+49 170 1234567');
    expect(drawer.textContent).toContain('NV123');
    expect(drawer.textContent).toContain('FRA → JFK');
    expect(drawer.textContent).toContain('Scheduled');

    await switchTab(fixture, 'Passengers');
    expect(drawer.textContent).toContain('Lena Hoffmann');
    expect(drawer.textContent).toContain('ADULT');
    expect(drawer.textContent).toContain('DE');
    expect(drawer.textContent).toContain('C01X00T47');
    expect(drawer.textContent).toContain('12A');
    expect(drawer.textContent).toContain('Booked');
    expect(drawer.textContent).toContain('listed per booking');
  });

  it('shows a retryable error inside the drawer when the detail fails to load', async () => {
    const m = mocks();
    m.bookings.getAdmin
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of(booking()));
    const fixture = await setup(m);
    const el = await openRow(fixture);

    expect(el.querySelector('.drawer')!.textContent).toContain(
      'Could not load the booking details.',
    );

    el.querySelector<HTMLElement>('.drawer .list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.bookings.getAdmin).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer')!.textContent).toContain('€498.50');
  });

  it('loads the real audit trail for the booking when the audit tab opens', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openRow(fixture);

    expect(m.audit.listLogs).not.toHaveBeenCalled();

    await switchTab(fixture, 'Audit');

    expect(m.audit.listLogs).toHaveBeenCalledTimes(1);
    expect(m.audit.listLogs).toHaveBeenCalledWith({
      targetType: 'Booking',
      targetId: 'bk-1',
      limit: 20,
    });
    const drawer = el.querySelector('.drawer')!;
    expect(drawer.textContent).toContain('BOOKING_CREATED');
    expect(drawer.textContent).toContain('User');
  });

  it('shows a friendly state when the audit API returns 403', async () => {
    const m = mocks();
    m.audit.listLogs.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    await openRow(fixture);
    const el = await switchTab(fixture, 'Audit');

    expect(el.querySelector('.drawer')!.textContent).toContain(
      "You don't have permission to view the audit trail.",
    );
  });

  it('never calls the audit API without the audit:read permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = await openRow(fixture);
    await switchTab(fixture, 'Audit');

    expect(m.audit.listLogs).not.toHaveBeenCalled();
  });

  it('shows honest deferred states for payments/refunds and notifications', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openRow(fixture);

    await switchTab(fixture, 'Payments');
    expect(el.querySelector('.drawer')!.textContent).toContain(
      'Payments and refunds will be available in a future phase.',
    );

    await switchTab(fixture, 'Notifications');
    expect(el.querySelector('.drawer')!.textContent).toContain(
      'Notifications will be available in a future phase.',
    );
  });

  it('has no cancel action, no BR-14 exception action and no fabricated refund amounts', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openRow(fixture);
    const drawer = el.querySelector('.drawer')!;

    expect(drawer.textContent).not.toContain('Cancel booking');
    expect(drawer.textContent).not.toContain('Confirm without payment');
    expect(drawer.textContent).not.toContain('Estimated refund');
    expect(el.querySelector('.drawer na-dialog')).toBeNull();
    expect(el.querySelector('.drawer__actions na-button')).toBeNull();
    expect(drawer.textContent).toContain('future backend phase');
  });
});
