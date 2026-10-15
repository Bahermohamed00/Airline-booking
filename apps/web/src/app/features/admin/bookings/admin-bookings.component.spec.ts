import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AdminBookingsPage } from './admin-bookings.component';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AdminPaymentsService } from '../payments/admin-payments.service';
import { AdminNotificationsService, type AdminNotificationItem } from '../notifications/admin-notifications.service';
import { AuditService, type AuditLogPage } from '../audit/audit.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';
import type { AdminPayment } from '../../../core/models/payment.model';

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

function payment(partial: Partial<AdminPayment> = {}): AdminPayment {
  return {
    id: 'pay-1',
    bookingId: 'bk-1',
    bookingReference: 'NVABC1',
    bookingStatus: 'CONFIRMED',
    contactEmail: 'lena@example.com',
    amount: 498.5,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'stripe',
    providerReference: 'pi_test_123',
    paidAt: '2026-01-10T10:05:00Z',
    failedAt: null,
    createdAt: '2026-01-10T10:00:00Z',
    refunds: [],
    ...partial,
  };
}

function notificationItem(partial: Partial<AdminNotificationItem> = {}): AdminNotificationItem {
  return {
    id: 'ntf-1',
    type: 'BOOKING_CONFIRMED',
    channel: 'IN_APP',
    status: 'DELIVERED',
    title: 'Booking confirmed',
    content: 'Your booking NVABC1 is confirmed.',
    userId: 'user-1',
    bookingId: 'bk-1',
    readAt: null,
    attempts: 1,
    error: null,
    sentAt: '2026-01-10T09:31:00Z',
    createdAt: '2026-01-10T09:30:05Z',
    ...partial,
  };
}

function mocks(list: CustomerBooking[] = [booking()]) {
  return {
    bookings: {
      listAdmin: vi.fn().mockReturnValue(of(list)),
      getAdmin: vi.fn().mockReturnValue(of(list[0] ?? booking())),
    },
    payments: {
      listPayments: vi.fn().mockReturnValue(of([])),
      refund: vi.fn(),
    },
    notifications: {
      list: vi.fn().mockReturnValue(of({ data: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    },
    audit: { listLogs: vi.fn().mockReturnValue(of(AUDIT_PAGE)) },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminBookingsPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminBookingsPage],
    providers: [
      provideRouter([]),
      { provide: CustomerBookingService, useValue: m.bookings },
      { provide: AdminPaymentsService, useValue: m.payments },
      { provide: AdminNotificationsService, useValue: m.notifications },
      { provide: AuditService, useValue: m.audit },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
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

  // ---------- Notifications tab ----------

  it('loads booking-scoped notifications when the tab opens and renders them', async () => {
    const m = mocks();
    m.notifications.list.mockReturnValue(
      of({ data: [notificationItem()], page: 1, limit: 20, total: 1, totalPages: 1 }),
    );
    const fixture = await setup(m);

    expect(m.notifications.list).not.toHaveBeenCalled();
    await openRow(fixture);
    expect(m.notifications.list).not.toHaveBeenCalled();

    const el = await switchTab(fixture, 'Notifications');
    expect(m.notifications.list).toHaveBeenCalledWith({ bookingId: 'bk-1', limit: 20 });
    const text = el.querySelector('.drawer')!.textContent!;
    expect(text).toContain('Booking confirmed');
    expect(text).toContain('BOOKING_CONFIRMED');
    expect(text).toContain('IN_APP');
    expect(text).toContain('DELIVERED');
    expect(text).toContain('Sent');
  });

  it('shows an honest empty state when the booking has no notifications', async () => {
    const m = mocks();
    const fixture = await setup(m);
    await openRow(fixture);
    const el = await switchTab(fixture, 'Notifications');

    expect(el.querySelector('.drawer')!.textContent).toContain('No notifications for this booking');
    expect(el.querySelector('.drawer')!.textContent).not.toContain('Could not load notifications');
  });

  it('distinguishes failure from empty and retries on demand', async () => {
    const m = mocks();
    m.notifications.list
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of({ data: [notificationItem()], page: 1, limit: 20, total: 1, totalPages: 1 }));
    const fixture = await setup(m);
    await openRow(fixture);
    let el = await switchTab(fixture, 'Notifications');

    expect(el.querySelector('.drawer')!.textContent).toContain('Could not load notifications for this booking.');
    expect(el.querySelector('.drawer')!.textContent).not.toContain('No notifications for this booking');

    el.querySelector<HTMLElement>('.drawer .list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(m.notifications.list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer')!.textContent).toContain('Booking confirmed');
  });

  it('never leaks the previous booking\'s notifications when switching bookings mid-flight', async () => {
    const pending = new Subject<unknown>();
    const m = mocks([booking(), booking({ id: 'bk-2', bookingReference: 'NVXYZ9' })]);
    m.notifications.list.mockImplementation((q: { bookingId?: string }) =>
      q.bookingId === 'bk-1'
        ? pending.asObservable()
        : of({ data: [notificationItem({ id: 'ntf-2', bookingId: 'bk-2', title: 'Payment succeeded' })], page: 1, limit: 20, total: 1, totalPages: 1 }),
    );
    m.bookings.getAdmin.mockImplementation((id: string) =>
      of(booking({ id, bookingReference: id === 'bk-1' ? 'NVABC1' : 'NVXYZ9' })),
    );
    const fixture = await setup(m);
    let el = await openRow(fixture);
    await switchTab(fixture, 'Notifications');

    el.querySelectorAll<HTMLElement>('tbody tr')[1]!.click();
    fixture.detectChanges();
    await switchTab(fixture, 'Notifications');
    expect(el.querySelector('.drawer')!.textContent).toContain('Payment succeeded');

    // Late response for bk-1 is discarded.
    pending.next({ data: [notificationItem({ title: 'Booking confirmed' })], page: 1, limit: 20, total: 1, totalPages: 1 });
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = el.querySelector('.drawer')!.textContent!;
    expect(text).not.toContain('Booking confirmed');
    expect(text).toContain('Payment succeeded');
  });

  it('shows a friendly state on 403 and never calls the API without notifications:read', async () => {
    const m = mocks();
    m.notifications.list.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    await openRow(fixture);
    let el = await switchTab(fixture, 'Notifications');
    expect(el.querySelector('.drawer')!.textContent).toContain("You don't have permission");

    TestBed.resetTestingModule();
    const m2 = mocks();
    m2.auth.hasPermission.mockImplementation((p: string) => p !== 'notifications:read');
    const fixture2 = await setup(m2);
    await openRow(fixture2);
    el = await switchTab(fixture2, 'Notifications');
    expect(m2.notifications.list).not.toHaveBeenCalled();
    expect(el.querySelector('.drawer')!.textContent).toContain("You don't have permission");
  });

  it('has no cancel action and no BR-14 exception action in the drawer', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openRow(fixture);
    const drawer = el.querySelector('.drawer')!;

    expect(drawer.textContent).not.toContain('Cancel booking');
    expect(drawer.textContent).not.toContain('Confirm without payment');
    expect(drawer.textContent).not.toContain('Estimated refund');
    // The obsolete "future backend phase" claim is gone; the footer points at
    // the real Payments and Cancellation-requests screens.
    expect(drawer.textContent).not.toContain('future backend phase');
    expect(drawer.textContent).toContain('Payments');
    expect(drawer.textContent).toContain('Cancellation requests');
  });

  // ---------- Payments & refunds tab ----------

  it('loads payments for the selected booking only when the payments tab opens', async () => {
    const m = mocks();
    m.payments.listPayments.mockReturnValue(of([payment()]));
    const fixture = await setup(m);

    // Not fetched before the tab is opened.
    expect(m.payments.listPayments).not.toHaveBeenCalled();

    await openRow(fixture);
    expect(m.payments.listPayments).not.toHaveBeenCalled();

    const el = await switchTab(fixture, 'Payments');
    expect(m.payments.listPayments).toHaveBeenCalledWith({ bookingId: 'bk-1' });
    const text = el.querySelector('.drawer')!.textContent!;
    expect(text).toContain('€498.50');
    expect(text).toContain('Paid'); // SUCCESS status badge label
    expect(text).toContain('stripe');
    expect(text).toContain('pi_test_123');
    expect(text).toContain('Paid');
  });

  it('renders refund records with their statuses under the payment', async () => {
    const m = mocks();
    m.payments.listPayments.mockReturnValue(
      of([
        payment({
          status: 'PARTIALLY_REFUNDED',
          refunds: [
            {
              id: 'rf-1',
              paymentId: 'pay-1',
              bookingId: 'bk-1',
              amount: 100,
              currency: 'EUR',
              status: 'PROCESSED',
              reason: 'Customer cancellation',
              processedAt: '2026-01-12T09:00:00Z',
              createdAt: '2026-01-11T09:00:00Z',
              updatedAt: '2026-01-12T09:00:00Z',
            },
          ],
        }),
      ]),
    );
    const fixture = await setup(m);
    await openRow(fixture);
    const el = await switchTab(fixture, 'Payments');

    const text = el.querySelector('.drawer')!.textContent!;
    expect(text).toContain('Partially refunded');
    expect(text).toContain('Refund €100.00');
    expect(text).toContain('Processed');
    expect(text).toContain('Customer cancellation');
  });

  it('shows an honest empty state when the booking has no payments', async () => {
    const m = mocks();
    m.payments.listPayments.mockReturnValue(of([]));
    const fixture = await setup(m);
    await openRow(fixture);
    const el = await switchTab(fixture, 'Payments');

    expect(el.querySelector('.drawer')!.textContent).toContain('No payments yet');
    expect(el.querySelector('.drawer')!.textContent).not.toContain('Could not load payments');
  });

  it('distinguishes failure from empty and retries on demand', async () => {
    const m = mocks();
    m.payments.listPayments
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([payment()]));
    const fixture = await setup(m);
    await openRow(fixture);
    let el = await switchTab(fixture, 'Payments');

    let drawer = el.querySelector('.drawer')!;
    expect(drawer.textContent).toContain('Could not load payments for this booking.');
    expect(drawer.textContent).not.toContain('No payments yet');

    drawer.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    drawer = el.querySelector('.drawer')!;
    expect(m.payments.listPayments).toHaveBeenCalledTimes(2);
    expect(drawer.textContent).toContain('€498.50');
  });

  it('never leaks the previous booking\'s payments when switching bookings mid-flight', async () => {
    const first = payment({ id: 'pay-1', bookingId: 'bk-1', providerReference: 'pi_first' });
    const second = payment({ id: 'pay-2', bookingId: 'bk-2', providerReference: 'pi_second' });
    const pending = new Subject<AdminPayment[]>();
    const m = mocks([booking(), booking({ id: 'bk-2', bookingReference: 'NVXYZ9' })]);
    m.payments.listPayments.mockImplementation((q: { bookingId?: string }) =>
      q.bookingId === 'bk-1' ? pending.asObservable() : of([second]),
    );
    m.bookings.getAdmin.mockImplementation((id: string) =>
      of(booking({ id, bookingReference: id === 'bk-1' ? 'NVABC1' : 'NVXYZ9' })),
    );
    const fixture = await setup(m);
    let el = await openRow(fixture);
    await switchTab(fixture, 'Payments');

    // Switch to the second booking before the first request resolves.
    el.querySelectorAll<HTMLElement>('tbody tr')[1]!.click();
    fixture.detectChanges();
    await switchTab(fixture, 'Payments');
    let drawerText = el.querySelector('.drawer')!.textContent!;
    expect(drawerText).toContain('pi_second');

    // The late response for bk-1 must be discarded.
    pending.next([first]);
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    drawerText = el.querySelector('.drawer')!.textContent!;
    expect(drawerText).not.toContain('pi_first');
    expect(drawerText).toContain('pi_second');
  });

  it('hides the refund action without payments:refund and shows it for eligible payments', async () => {
    const m = mocks();
    m.auth.hasPermission.mockImplementation((p: string) => p !== 'payments:refund');
    m.payments.listPayments.mockReturnValue(of([payment()]));
    const fixture = await setup(m);
    await openRow(fixture);
    let el = await switchTab(fixture, 'Payments');
    expect(el.querySelector('.drawer')!.textContent).not.toContain('Issue refund');

    // With the permission and a SUCCESS payment, the action is available.
    TestBed.resetTestingModule();
    const m2 = mocks();
    m2.payments.listPayments.mockReturnValue(of([payment()]));
    const fixture2 = await setup(m2);
    await openRow(fixture2);
    el = await switchTab(fixture2, 'Payments');
    const btn = Array.from(el.querySelectorAll<HTMLElement>('.drawer na-button')).find((b) =>
      b.textContent?.includes('Issue refund'),
    );
    expect(btn).toBeDefined();
    btn!.querySelector('button')!.click();
    fixture2.detectChanges();
    expect(el.querySelector('na-refund-dialog')).not.toBeNull();
  });

  it('never triggers a refund from loading or tab switching alone', async () => {
    const m = mocks();
    m.payments.listPayments.mockReturnValue(of([payment()]));
    const fixture = await setup(m);
    await openRow(fixture);
    await switchTab(fixture, 'Payments');
    expect(m.payments.refund).not.toHaveBeenCalled();
  });

  it('shows a friendly state when the payments API returns 403', async () => {
    const m = mocks();
    m.payments.listPayments.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    await openRow(fixture);
    const el = await switchTab(fixture, 'Payments');

    expect(el.querySelector('.drawer')!.textContent).toContain("You don't have permission");
  });

  it('does not call the payments API at all without the payments:read permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockImplementation((p: string) => p !== 'payments:read');
    const fixture = await setup(m);
    await openRow(fixture);
    const el = await switchTab(fixture, 'Payments');

    expect(m.payments.listPayments).not.toHaveBeenCalled();
    expect(el.querySelector('.drawer')!.textContent).toContain("You don't have permission");
  });
});
