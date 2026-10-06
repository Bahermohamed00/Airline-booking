import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { ManageBookingPage } from './manage-booking.component';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { PaymentService } from './payment.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';
import type { CustomerPayment } from '../../../core/models/payment.model';

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
      {
        seatId: 's1',
        seatNumber: '12A',
        holdStatus: 'ACTIVE',
        holdExpiresAt: '2026-09-20T10:30:00Z',
      },
    ],
    ...overrides,
  };
}

function payment(overrides: Partial<CustomerPayment> = {}): CustomerPayment {
  return {
    id: 'pay-1',
    bookingId: ID,
    amount: 289.5,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'mockpay',
    providerReference: 'mp_1234567890',
    paidAt: '2026-09-20T10:20:00Z',
    failedAt: null,
    createdAt: '2026-09-20T10:19:55Z',
    refunds: [],
    ...overrides,
  };
}

type PaymentMock = {
  getPayments: ReturnType<typeof vi.fn>;
  pay: ReturnType<typeof vi.fn>;
  tokenize: ReturnType<typeof vi.fn>;
};

interface SetupResult {
  fixture: ComponentFixture<ManageBookingPage>;
  el: HTMLElement;
  bookingService: { getById: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
  paymentService: PaymentMock;
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

async function setup(
  getById: ReturnType<typeof vi.fn>,
  cancel?: ReturnType<typeof vi.fn>,
  paymentMock: Partial<PaymentMock> = {},
): Promise<SetupResult> {
  const bookingService = { getById, cancel: cancel ?? vi.fn() };
  const paymentService: PaymentMock = {
    getPayments: vi.fn().mockReturnValue(of([])),
    pay: vi.fn(),
    tokenize: vi.fn().mockReturnValue(of('tok_testtoken')),
    ...paymentMock,
  };
  const toast = { success: vi.fn(), error: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [ManageBookingPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ id: ID }) },
          paramMap: of(convertToParamMap({ id: ID })),
        },
      },
      { provide: CustomerBookingService, useValue: bookingService },
      { provide: PaymentService, useValue: paymentService },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<ManageBookingPage> = TestBed.createComponent(ManageBookingPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    bookingService,
    paymentService,
    toast,
  };
}

async function settle(fixture: ComponentFixture<ManageBookingPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function buttonByText(el: HTMLElement | Element, text: string): HTMLButtonElement | null {
  return (
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text,
    ) ?? null
  );
}

describe('ManageBookingPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the booking by route id and renders reference, itinerary, passengers, seats, contact and amounts', async () => {
    const getById = vi.fn().mockReturnValue(of(booking()));
    const { el } = await setup(getById);

    expect(getById).toHaveBeenCalledWith(ID);
    expect(el.textContent).toContain('NVA7K2');
    expect(el.textContent).toContain('Pending payment');
    expect(el.textContent).toContain('LH101');
    expect(el.textContent).toContain('FRA');
    expect(el.textContent).toContain('LHR');
    expect(el.textContent).toContain('Aya Mansour');
    expect(el.textContent).toContain('Seat 12A');
    expect(el.textContent).toContain('Held'); // seat hold badge
    expect(el.textContent).toContain('aya@example.com');
    expect(el.textContent).toContain('+49 170 1234567');
    expect(el.textContent).toContain('€289.50');
    expect(el.textContent).toContain('per passenger');
  });

  it('shows a payment-due panel for a PENDING booking and no mock payments, extras or timeline sections', async () => {
    const getById = vi.fn().mockReturnValue(of(booking()));
    const { el } = await setup(getById);

    expect(el.textContent).toContain('Payment due');
    expect(el.textContent).toContain('€289.50');
    expect(buttonByText(el, 'Pay now')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('na-timeline')).toBeNull();
    expect(el.textContent).not.toContain('Refunds');
    expect(el.textContent).not.toContain('Estimated refund');
    expect(el.textContent).not.toContain('Extras');
    expect(el.textContent).not.toContain('History');
  });

  it('offers cancel for a PENDING booking and updates the view on success', async () => {
    const getById = vi.fn().mockReturnValue(of(booking()));
    const cancel = vi.fn().mockReturnValue(of(booking({ status: 'CANCELLED' })));
    const { fixture, el, toast } = await setup(getById, cancel);

    buttonByText(el, 'Cancel booking')!.click();
    await settle(fixture);

    const dialog = el.querySelector('na-dialog')!;
    expect(dialog.textContent).toContain('no charge has been made');
    expect(dialog.textContent).not.toContain('refund');

    buttonByText(dialog, 'Cancel booking')!.click();
    await settle(fixture);

    expect(cancel).toHaveBeenCalledWith(ID);
    expect(toast.success).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('Cancelled');
    expect(buttonByText(el, 'Cancel booking')).toBeNull();
  });

  it('shows a clear message when the server rejects cancellation with 409', async () => {
    const getById = vi.fn().mockReturnValue(of(booking()));
    const cancel = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const { fixture, el, toast } = await setup(getById, cancel);

    buttonByText(el, 'Cancel booking')!.click();
    await settle(fixture);
    buttonByText(el.querySelector('na-dialog')!, 'Cancel booking')!.click();
    await settle(fixture);

    expect(toast.error).toHaveBeenCalledWith('Only pending bookings can be cancelled.');
    // The booking is untouched and can be retried.
    expect(el.textContent).toContain('Pending payment');
  });

  it('hides the cancel action for non-pending bookings', async () => {
    const getById = vi.fn().mockReturnValue(of(booking({ status: 'CANCELLED' })));
    const { el } = await setup(getById);

    expect(buttonByText(el, 'Cancel booking')).toBeNull();
  });

  it('shows a not-found state when the API answers 404', async () => {
    const getById = vi.fn().mockReturnValue(throwError(() => ({ status: 404 })));
    const { el } = await setup(getById);

    expect(el.querySelector('na-empty-state')).not.toBeNull();
    expect(el.textContent).toContain('Booking not found');
    expect(el.querySelector('.alert--danger')).toBeNull();
  });

  it('shows a retryable error state on other failures and retry recovers', async () => {
    const getById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of(booking()));
    const { fixture, el } = await setup(getById);

    expect(el.querySelector('.alert--danger')).not.toBeNull();
    (el.querySelector('.alert__retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(getById).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NVA7K2');
  });

  it('shows "Pay now" only for PENDING bookings', async () => {
    let ctx = await setup(vi.fn().mockReturnValue(of(booking({ status: 'PENDING' }))));
    expect(buttonByText(ctx.el, 'Pay now')).not.toBeNull();

    TestBed.resetTestingModule();
    ctx = await setup(vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))));
    expect(buttonByText(ctx.el, 'Pay now')).toBeNull();

    TestBed.resetTestingModule();
    ctx = await setup(vi.fn().mockReturnValue(of(booking({ status: 'CANCELLED' }))));
    expect(buttonByText(ctx.el, 'Pay now')).toBeNull();
  });

  it('pays via token + idempotency key and updates the booking to CONFIRMED on success', async () => {
    const result = { payment: payment(), booking: booking({ status: 'CONFIRMED' }) };
    const pay = vi.fn().mockReturnValue(of(result));
    const { fixture, el, paymentService, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      { pay },
    );

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);

    const dialog =
      el.querySelector('na-dialog[title="Pay for your booking"]') ??
      Array.from(el.querySelectorAll('na-dialog')).find((d) =>
        d.textContent?.includes('mock provider'),
      )!;
    expect(dialog.textContent).toContain('€289.50');
    expect(dialog.textContent).toContain('no card data is collected');

    buttonByText(dialog, 'Pay €289.50')!.click();
    await settle(fixture);

    expect(paymentService.tokenize).toHaveBeenCalledOnce();
    expect(pay).toHaveBeenCalledOnce();
    expect(pay).toHaveBeenCalledWith(ID, {
      token: 'tok_testtoken',
      idempotencyKey: expect.any(String),
    });
    expect(toast.success).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('Confirmed');
    expect(buttonByText(el, 'Pay now')).toBeNull();
    // The new payment record is prepended to the list.
    expect(el.textContent).toContain('mp_1234567890');
    expect(el.textContent).toContain('Paid');
  });

  it('shows the server message with a retry option when the provider declines (402)', async () => {
    const pay = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => ({ status: 402, error: { message: 'Card declined by issuer.' } })),
      )
      .mockReturnValue(of({ payment: payment(), booking: booking({ status: 'CONFIRMED' }) }));
    const { fixture, el } = await setup(vi.fn().mockReturnValue(of(booking())), undefined, { pay });

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);
    const dialog = Array.from(el.querySelectorAll('na-dialog')).find((d) =>
      d.textContent?.includes('mock provider'),
    )!;
    buttonByText(dialog, 'Pay €289.50')!.click();
    await settle(fixture);

    expect(el.querySelector('.alert--danger')?.textContent).toContain('Card declined by issuer.');
    expect(buttonByText(el, 'Pay now')).not.toBeNull();

    // Try again = a fresh attempt with a new idempotency key.
    const firstKey = pay.mock.calls[0][1].idempotencyKey as string;
    buttonByText(el, 'Try again')!.click();
    await settle(fixture);
    const dialog2 = Array.from(el.querySelectorAll('na-dialog')).find((d) =>
      d.textContent?.includes('mock provider'),
    )!;
    buttonByText(dialog2, 'Pay €289.50')!.click();
    await settle(fixture);

    expect(pay).toHaveBeenCalledTimes(2);
    expect(pay.mock.calls[1][1].idempotencyKey).not.toBe(firstKey);
    expect(el.textContent).toContain('Confirmed');
  });

  it('prevents duplicate submission while a payment is processing', async () => {
    const pendingPay = new Subject<unknown>();
    const pay = vi.fn().mockReturnValue(pendingPay.asObservable());
    const { fixture, el } = await setup(vi.fn().mockReturnValue(of(booking())), undefined, { pay });

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);
    const dialog = Array.from(el.querySelectorAll('na-dialog')).find((d) =>
      d.textContent?.includes('mock provider'),
    )!;
    const confirm = buttonByText(dialog, 'Pay €289.50')!;
    confirm.click();
    await settle(fixture);

    // Dialog is blocked and the action is inert while processing.
    expect(dialog.textContent).toContain('Processing…');
    confirm.click();
    (
      dialog.querySelector('.dialog__actions na-button button') as HTMLButtonElement | null
    )?.click();
    await settle(fixture);

    expect(pay).toHaveBeenCalledOnce();
  });

  it('renders payment details and refunds for a CONFIRMED booking', async () => {
    const getPayments = vi.fn().mockReturnValue(
      of([
        payment({
          refunds: [
            {
              id: 'r1',
              paymentId: 'pay-1',
              bookingId: ID,
              amount: 50,
              currency: 'EUR',
              status: 'PROCESSED',
              reason: 'Goodwill gesture',
              processedAt: '2026-09-21T09:00:00Z',
              createdAt: '2026-09-21T08:55:00Z',
            },
          ],
        }),
      ]),
    );
    const { el, paymentService } = await setup(
      vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))),
      undefined,
      { getPayments },
    );

    expect(paymentService.getPayments).toHaveBeenCalledWith(ID);
    expect(el.textContent).toContain('€289.50');
    expect(el.textContent).toContain('Paid');
    expect(el.textContent).toContain('mockpay');
    expect(el.textContent).toContain('mp_1234567890');
    expect(el.textContent).toContain('€50.00');
    expect(el.textContent).toContain('Processed');
    expect(el.textContent).toContain('Goodwill gesture');
  });

  it('shows a non-blocking retryable note when payments fail to load', async () => {
    const getPayments = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of([payment()]));
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))),
      undefined,
      { getPayments },
    );

    // The booking itself still renders fine.
    expect(el.textContent).toContain('NVA7K2');
    expect(el.textContent).toContain('Could not load payment details.');

    (el.querySelector('.pay-load-error__retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(getPayments).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('mp_1234567890');
  });
});
