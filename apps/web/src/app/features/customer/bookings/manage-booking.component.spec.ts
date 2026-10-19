import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError, Subject, EMPTY, NEVER } from 'rxjs';
import { ManageBookingPage } from './manage-booking.component';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { PaymentService } from './payment.service';
import { RealtimeService, type BookingRealtimeEvent } from '../../../core/services/realtime.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { CancellationPreview, CustomerBooking } from '../../../core/models/customer-booking.model';
import type { CustomerPayment } from '../../../core/models/payment.model';
import { formatMoney } from '../../../core/services/pricing.service';

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

/** Server-calculated cancellation preview fixture — all values are backend-owned. */
function preview(overrides: Partial<CancellationPreview> = {}): CancellationPreview {
  return {
    allowed: true,
    reason: 'REFUND_100_PERCENT',
    refundPercentage: 100,
    refundAmount: 0,
    paidAmount: 0,
    retainedAmount: 0,
    currency: 'EUR',
    departureTime: '2027-01-10T09:30:00Z',
    hoursUntilDeparture: 200,
    ...overrides,
  };
}

type PaymentMock = {
  providerMode: 'stripe' | 'mock';
  getPayments: ReturnType<typeof vi.fn>;
  pay: ReturnType<typeof vi.fn>;
  tokenize: ReturnType<typeof vi.fn>;
  mountPaymentElement: ReturnType<typeof vi.fn>;
  confirmPayment: ReturnType<typeof vi.fn>;
  unmountPaymentElement: ReturnType<typeof vi.fn>;
  pollUntilSettled: ReturnType<typeof vi.fn>;
  pollUntilTerminal: ReturnType<typeof vi.fn>;
};

type RealtimeMock = {
  watchBooking: ReturnType<typeof vi.fn>;
};

interface SetupResult {
  fixture: ComponentFixture<ManageBookingPage>;
  el: HTMLElement;
  bookingService: {
    getById: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    cancellationPreview: ReturnType<typeof vi.fn>;
    requestCancellation: ReturnType<typeof vi.fn>;
  };
  paymentService: PaymentMock;
  realtime: RealtimeMock;
  toast: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
}

async function setup(
  getById: ReturnType<typeof vi.fn>,
  cancel?: ReturnType<typeof vi.fn>,
  paymentMock: Partial<PaymentMock> = {},
  previewMock?: ReturnType<typeof vi.fn>,
  requestCancellationMock?: ReturnType<typeof vi.fn>,
  realtimeMock: Partial<RealtimeMock> = {},
): Promise<SetupResult> {
  const bookingService = {
    getById,
    cancel: cancel ?? vi.fn(),
    cancellationPreview: previewMock ?? vi.fn().mockReturnValue(of(preview())),
    requestCancellation:
      requestCancellationMock ??
      vi.fn().mockReturnValue(
        of({
          id: 'cr-1',
          bookingId: ID,
          status: 'PENDING',
          reason: null,
          requestedAt: '2026-10-06T11:00:00Z',
        }),
      ),
  };
  const paymentService: PaymentMock = {
    providerMode: 'mock',
    getPayments: vi.fn().mockReturnValue(of([])),
    pay: vi.fn(),
    tokenize: vi.fn().mockReturnValue(of('tok_testtoken')),
    mountPaymentElement: vi.fn().mockResolvedValue(undefined),
    confirmPayment: vi.fn(),
    unmountPaymentElement: vi.fn(),
    pollUntilSettled: vi.fn(),
    pollUntilTerminal: vi.fn().mockReturnValue(EMPTY),
    ...paymentMock,
  };
  const realtime: RealtimeMock = {
    watchBooking: vi.fn().mockReturnValue(NEVER),
    ...realtimeMock,
  };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

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
      { provide: RealtimeService, useValue: realtime },
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
    realtime,
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

/** The payment dialog (there are also cancel/request dialogs on the page). */
function payDialog(el: HTMLElement): HTMLElement {
  const dialog = el.querySelector<HTMLElement>('na-dialog[title="Pay for your booking"]');
  if (!dialog) throw new Error('payment dialog not found');
  return dialog;
}

/** The cancellation-request dialog for CONFIRMED bookings. */
function requestDialog(el: HTMLElement): HTMLElement {
  const dialog = el.querySelector<HTMLElement>('na-dialog[title="Request cancellation"]');
  if (!dialog) throw new Error('request dialog not found');
  return dialog;
}

/** The direct-cancel dialog for unpaid PENDING bookings. */
function cancelDialog(el: HTMLElement): HTMLElement {
  const dialog = el.querySelector<HTMLElement>('na-dialog[title="Cancel this booking?"]');
  if (!dialog) throw new Error('cancel dialog not found');
  return dialog;
}

describe('ManageBookingPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

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

    const dialog = cancelDialog(el);
    expect(dialog.textContent).toContain('no charge has been made');
    expect(dialog.textContent).not.toContain('refund');

    buttonByText(dialog, 'Cancel booking')!.click();
    await settle(fixture);

    expect(cancel).toHaveBeenCalledWith(ID);
    expect(toast.success).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('Cancelled');
    expect(buttonByText(el, 'Cancel booking')).toBeNull();
  });

  it('surfaces the server-provided reason when cancellation is rejected with 409', async () => {
    const getById = vi.fn().mockReturnValue(of(booking()));
    const cancel = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'Cancellation is no longer possible — the scheduled departure time has passed' },
      })),
    );
    const { fixture, el, toast } = await setup(getById, cancel);

    buttonByText(el, 'Cancel booking')!.click();
    await settle(fixture);
    buttonByText(cancelDialog(el), 'Cancel booking')!.click();
    await settle(fixture);

    expect(toast.error).toHaveBeenCalledWith(
      'Cancellation is no longer possible — the scheduled departure time has passed',
    );
    // The booking is untouched and can be retried.
    expect(el.textContent).toContain('Pending payment');
  });

  it('falls back to a generic message when the rejection carries no server reason', async () => {
    const getById = vi.fn().mockReturnValue(of(booking()));
    const cancel = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const { fixture, el, toast } = await setup(getById, cancel);

    buttonByText(el, 'Cancel booking')!.click();
    await settle(fixture);
    buttonByText(cancelDialog(el), 'Cancel booking')!.click();
    await settle(fixture);

    expect(toast.error).toHaveBeenCalledWith('Could not cancel this booking. Please try again.');
  });

  it('offers "Request cancellation" for a CONFIRMED booking when the backend preview allows it and renders the server refund values', async () => {
    const getById = vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' })));
    const requestCancellation = vi.fn().mockReturnValue(
      of({
        id: 'cr-1',
        bookingId: ID,
        status: 'PENDING',
        reason: null,
        requestedAt: '2026-10-06T11:00:00Z',
      }),
    );
    const previewMock = vi.fn().mockReturnValue(
      of(
        preview({
          reason: 'REFUND_80_PERCENT',
          refundPercentage: 80,
          refundAmount: 400,
          paidAmount: 500,
          retainedAmount: 100,
        }),
      ),
    );
    const { fixture, el, toast } = await setup(
      getById,
      undefined,
      {},
      previewMock,
      requestCancellation,
    );

    // Direct cancel is now unpaid-only; CONFIRMED bookings request a review.
    expect(buttonByText(el, 'Cancel booking')).toBeNull();
    buttonByText(el, 'Request cancellation')!.click();
    await settle(fixture);

    const dialog = requestDialog(el);
    expect(dialog.textContent).toContain('Estimated refund');
    expect(dialog.textContent).toContain(formatMoney(400, 'EUR'));
    expect(dialog.textContent).toContain(formatMoney(100, 'EUR'));
    expect(dialog.textContent).toContain('will be retained according to the');
    expect(dialog.textContent).toContain('remain active while our team reviews');

    buttonByText(dialog, 'Submit request')!.click();
    await settle(fixture);

    expect(requestCancellation).toHaveBeenCalledWith(ID, undefined);
    expect(toast.success).toHaveBeenCalledWith(
      'Cancellation requested — our team will review it shortly.',
    );
    // The booking is NOT cancelled — it stays Confirmed under pending review.
    expect(el.textContent).toContain('Confirmed');
    expect(el.textContent).not.toContain('Cancelled');
    expect(el.textContent).toContain('Cancellation requested — pending review');
    expect(buttonByText(el, 'Request cancellation')).toBeNull();
  });

  it('sends the trimmed reason when one is entered in the request dialog', async () => {
    const requestCancellation = vi.fn().mockReturnValue(
      of({
        id: 'cr-1',
        bookingId: ID,
        status: 'PENDING',
        reason: 'Plans changed',
        requestedAt: '2026-10-06T11:00:00Z',
      }),
    );
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))),
      undefined,
      {},
      undefined,
      requestCancellation,
    );

    buttonByText(el, 'Request cancellation')!.click();
    await settle(fixture);

    const dialog = requestDialog(el);
    const textarea = dialog.querySelector<HTMLTextAreaElement>('#cancel-reason')!;
    textarea.value = '  Plans changed  ';
    textarea.dispatchEvent(new Event('input'));
    await settle(fixture);

    buttonByText(dialog, 'Submit request')!.click();
    await settle(fixture);

    expect(requestCancellation).toHaveBeenCalledWith(ID, 'Plans changed');
  });

  it('warns when the backend preview reports a zero refund for a cancellation request', async () => {
    const requestCancellation = vi.fn().mockReturnValue(
      of({
        id: 'cr-1',
        bookingId: ID,
        status: 'PENDING',
        reason: null,
        requestedAt: '2026-10-06T11:00:00Z',
      }),
    );
    const previewMock = vi.fn().mockReturnValue(
      of(
        preview({
          reason: 'NON_REFUNDABLE_FARE',
          refundPercentage: 0,
          refundAmount: 0,
          paidAmount: 500,
          retainedAmount: 500,
        }),
      ),
    );
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))),
      undefined,
      {},
      previewMock,
      requestCancellation,
    );

    buttonByText(el, 'Request cancellation')!.click();
    await settle(fixture);

    const dialog = requestDialog(el);
    expect(dialog.textContent).toContain('no refund will be issued');

    buttonByText(dialog, 'Submit request')!.click();
    await settle(fixture);

    expect(toast.success).toHaveBeenCalledWith(
      'Cancellation requested — our team will review it shortly.',
    );
  });

  it('shows the pending-review state for a PENDING cancellation request and blocks duplicate requests', async () => {
    const getById = vi.fn().mockReturnValue(
      of(
        booking({
          status: 'CONFIRMED',
          cancellationRequest: {
            id: 'cr-1',
            status: 'PENDING',
            requestedAt: '2026-10-06T11:00:00Z',
            rejectionReason: null,
          },
        }),
      ),
    );
    const { el } = await setup(getById);

    expect(el.textContent).toContain('Cancellation requested — pending review');
    expect(buttonByText(el, 'Request cancellation')).toBeNull();
    expect(buttonByText(el, 'Cancel booking')).toBeNull();
  });

  it('shows the rejection reason for a REJECTED cancellation request and allows a new request', async () => {
    const requestCancellation = vi.fn().mockReturnValue(
      of({
        id: 'cr-2',
        bookingId: ID,
        status: 'PENDING',
        reason: null,
        requestedAt: '2026-10-07T09:00:00Z',
      }),
    );
    const getById = vi.fn().mockReturnValue(
      of(
        booking({
          status: 'CONFIRMED',
          cancellationRequest: {
            id: 'cr-1',
            status: 'REJECTED',
            requestedAt: '2026-10-06T11:00:00Z',
            rejectionReason: 'Fare rules do not allow a refund after check-in.',
          },
        }),
      ),
    );
    const { fixture, el } = await setup(getById, undefined, {}, undefined, requestCancellation);

    expect(el.textContent).toContain('Cancellation request rejected');
    expect(el.textContent).toContain('Fare rules do not allow a refund after check-in.');
    expect(el.textContent).toContain('Confirmed'); // booking stays active

    // A NEW request may be submitted.
    buttonByText(el, 'Request cancellation')!.click();
    await settle(fixture);
    buttonByText(requestDialog(el), 'Submit request')!.click();
    await settle(fixture);

    expect(requestCancellation).toHaveBeenCalledWith(ID, undefined);
    expect(el.textContent).toContain('Cancellation requested — pending review');
  });

  it('shows "Cancellation approved — refund in progress" while the booking is not yet CANCELLED', async () => {
    const getById = vi.fn().mockReturnValue(
      of(
        booking({
          status: 'CONFIRMED',
          cancellationRequest: {
            id: 'cr-1',
            status: 'APPROVED',
            requestedAt: '2026-10-06T11:00:00Z',
            rejectionReason: null,
          },
        }),
      ),
    );
    const { el } = await setup(getById);

    expect(el.textContent).toContain('Cancellation approved — refund in progress');
    expect(buttonByText(el, 'Request cancellation')).toBeNull();
    expect(buttonByText(el, 'Cancel booking')).toBeNull();
  });

  it('handles 409 CANCELLATION_REQUEST_PENDING gracefully: refreshes and shows the pending state', async () => {
    const getById = vi
      .fn()
      .mockReturnValueOnce(of(booking({ status: 'CONFIRMED' })))
      .mockReturnValue(
        of(
          booking({
            status: 'CONFIRMED',
            cancellationRequest: {
              id: 'cr-9',
              status: 'PENDING',
              requestedAt: '2026-10-06T11:30:00Z',
              rejectionReason: null,
            },
          }),
        ),
      );
    const requestCancellation = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { code: 'CANCELLATION_REQUEST_PENDING', message: 'A request is already pending' },
      })),
    );
    const { fixture, el, toast } = await setup(
      getById,
      undefined,
      {},
      undefined,
      requestCancellation,
    );

    buttonByText(el, 'Request cancellation')!.click();
    await settle(fixture);
    buttonByText(requestDialog(el), 'Submit request')!.click();
    await settle(fixture);

    expect(getById).toHaveBeenCalledTimes(2); // refreshed to the server's truth
    expect(toast.info).toHaveBeenCalledWith('A cancellation request is already pending review.');
    expect(toast.error).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Cancellation requested — pending review');
    expect(buttonByText(el, 'Request cancellation')).toBeNull();
  });

  it('surfaces the server message when the cancellation request is rejected with another 409', async () => {
    const requestCancellation = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'Cancellation is no longer possible — the scheduled departure time has passed' },
      })),
    );
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))),
      undefined,
      {},
      undefined,
      requestCancellation,
    );

    buttonByText(el, 'Request cancellation')!.click();
    await settle(fixture);
    buttonByText(requestDialog(el), 'Submit request')!.click();
    await settle(fixture);

    expect(toast.error).toHaveBeenCalledWith(
      'Cancellation is no longer possible — the scheduled departure time has passed',
    );
    // The booking is untouched and can be retried.
    expect(buttonByText(el, 'Request cancellation')).not.toBeNull();
  });

  it('hides the cancellation actions and explains when the backend preview rejects eligibility', async () => {
    const getById = vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' })));
    const previewMock = vi.fn().mockReturnValue(
      of(preview({ allowed: false, reason: 'AFTER_DEPARTURE', refundPercentage: 0 })),
    );
    const { el } = await setup(getById, undefined, {}, previewMock);

    expect(buttonByText(el, 'Cancel booking')).toBeNull();
    expect(buttonByText(el, 'Request cancellation')).toBeNull();
    expect(el.textContent).toContain('Cancellation is no longer available for this booking.');
  });

  it('hides the cancellation actions for non-cancellable bookings', async () => {
    const getById = vi.fn().mockReturnValue(of(booking({ status: 'CANCELLED' })));
    const { el } = await setup(getById);

    expect(buttonByText(el, 'Cancel booking')).toBeNull();
    expect(buttonByText(el, 'Request cancellation')).toBeNull();
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

  it('pays via token + idempotency key and updates the booking to CONFIRMED on success (mock mode)', async () => {
    const result = { payment: payment(), booking: booking({ status: 'CONFIRMED' }) };
    const pay = vi.fn().mockReturnValue(of(result));
    const { fixture, el, paymentService, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      { pay },
    );

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);

    const dialog = payDialog(el);
    expect(dialog.textContent).toContain('€289.50');
    // Mock-provider language is gone; the dialog presents a real payment summary.
    expect(dialog.textContent).not.toContain('mock provider');
    expect(dialog.textContent).not.toContain('no card data is collected');
    expect(dialog.textContent).toContain('Amount due');

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
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
    await settle(fixture);

    expect(el.querySelector('.alert--danger')?.textContent).toContain('Card declined by issuer.');
    expect(buttonByText(el, 'Pay now')).not.toBeNull();

    // Try again = a fresh attempt with a new idempotency key.
    const firstKey = pay.mock.calls[0][1].idempotencyKey as string;
    buttonByText(el, 'Try again')!.click();
    await settle(fixture);
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
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
    const dialog = payDialog(el);
    const confirm = buttonByText(dialog, 'Pay €289.50')!;
    confirm.click();
    await settle(fixture);

    // Dialog is blocked and the action is inert while the payment runs.
    expect(dialog.textContent).toContain('Confirming…');
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
              updatedAt: '2026-09-21T09:00:00Z',
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

describe('ManageBookingPage — Stripe payment flow', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  const attemptKey = `novaair.paymentAttempt.${ID}`;

  const intentResult = () => ({
    payment: payment({ status: 'PENDING', provider: 'stripe', providerReference: 'pi_123' }),
    paymentIntent: {
      clientSecret: 'pi_123_secret_x',
      status: 'requires_payment_method',
      requiresAction: false,
    },
    booking: booking(),
  });

  const stripeMock = (overrides: Partial<PaymentMock> = {}): Partial<PaymentMock> => ({
    providerMode: 'stripe',
    mountPaymentElement: vi.fn().mockResolvedValue(undefined),
    unmountPaymentElement: vi.fn(),
    confirmPayment: vi.fn(),
    pollUntilSettled: vi.fn(),
    pollUntilTerminal: vi.fn().mockReturnValue(EMPTY),
    ...overrides,
  });

  /** Opens the pay dialog and waits for the Payment Element to be mounted. */
  async function openReadyDialog(
    el: HTMLElement,
    fixture: ComponentFixture<ManageBookingPage>,
  ): Promise<void> {
    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);
  }

  it('creates/resumes the PaymentIntent on dialog open and mounts the Payment Element — no token, no amount sent', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const { fixture, el, paymentService } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay }),
    );

    await openReadyDialog(el, fixture);

    expect(pay).toHaveBeenCalledWith(ID, { idempotencyKey: expect.any(String) });
    expect(pay.mock.calls[0][1]).not.toHaveProperty('token');
    expect(paymentService.mountPaymentElement).toHaveBeenCalledOnce();
    expect(paymentService.mountPaymentElement.mock.calls[0][1]).toBe('pi_123_secret_x');
    // The client secret is never rendered into the DOM.
    expect(el.textContent).not.toContain('pi_123_secret_x');
    // Ready state: amount on the button, Stripe security copy, no mock language.
    expect(buttonByText(payDialog(el), 'Pay €289.50')).not.toBeNull();
    expect(payDialog(el).textContent).toContain('Secure payment powered by Stripe');
    expect(payDialog(el).textContent).not.toContain('mock provider');
    // The idempotency key was persisted for refresh recovery — and nothing else.
    const persisted = sessionStorage.getItem(attemptKey);
    expect(persisted).toContain(pay.mock.calls[0][1].idempotencyKey);
    expect(persisted).not.toContain('secret');
    expect(persisted).not.toContain('pi_');
  });

  it('shows an open stripe attempt as a resume state — never as "Payment failed" — even without a persisted key', async () => {
    const openPayment = payment({
      status: 'PENDING',
      provider: 'stripe',
      providerReference: 'pi_open_1',
      providerStatus: 'requires_payment_method',
    });
    const { el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ getPayments: vi.fn().mockReturnValue(of([openPayment])) }),
    );

    // No terminal-failure presentation for a resumable attempt…
    expect(el.textContent).not.toContain('Payment failed');
    // …the resume banner replaces the bare pay-due CTA…
    expect(el.textContent).toContain('already started a payment');
    expect(buttonByText(el, 'Complete payment')).not.toBeNull();
    expect(buttonByText(el, 'Pay now')).toBeNull();
    // …and the truthful payment history remains visible.
    expect(el.textContent).toContain('pi_open_1');
  });

  it('resumes the existing PaymentIntent after "Complete payment" without a persisted key — no second intent', async () => {
    const openPayment = payment({ status: 'PENDING', provider: 'stripe' });
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const { fixture, el, paymentService } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, getPayments: vi.fn().mockReturnValue(of([openPayment])) }),
    );

    buttonByText(el, 'Complete payment')!.click();
    await settle(fixture);

    // One POST (the backend resumes the open intent), one element mount.
    expect(pay).toHaveBeenCalledOnce();
    expect(paymentService.mountPaymentElement).toHaveBeenCalledOnce();
    expect(buttonByText(payDialog(el), 'Pay €289.50')).not.toBeNull();
  });

  it('shows a terminal FAILED payment as a failure and allows a fresh attempt', async () => {
    const failedPayment = payment({ status: 'FAILED', failedAt: '2026-09-20T10:25:00Z' });
    const { el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ getPayments: vi.fn().mockReturnValue(of([failedPayment])) }),
    );

    // Terminal failure → no resume banner; a fresh attempt is available.
    expect(el.textContent).not.toContain('already started a payment');
    expect(buttonByText(el, 'Complete payment')).toBeNull();
    expect(buttonByText(el, 'Pay now')).not.toBeNull();
    expect(el.textContent).toContain('Failed');
  });

  it('treats a mock-mode mismatch with an open stripe payment as a resume state (data-driven flow)', async () => {
    // environment says mock, but the backend holds an open STRIPE payment —
    // the component must not run the legacy token flow.
    const openPayment = payment({ status: 'PENDING', provider: 'stripe' });
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const { fixture, el, paymentService } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      { pay, getPayments: vi.fn().mockReturnValue(of([openPayment])) }, // providerMode stays 'mock'
    );

    expect(el.textContent).toContain('already started a payment');
    buttonByText(el, 'Complete payment')!.click();
    await settle(fixture);

    // Stripe path taken despite mock mode: no token fabricated or sent.
    expect(paymentService.tokenize).not.toHaveBeenCalled();
    expect(pay.mock.calls[0][1]).not.toHaveProperty('token');
    expect(paymentService.mountPaymentElement).toHaveBeenCalledOnce();
  });

  it('keeps Pay disabled until the Payment Element reports ready', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    let releaseMount: (() => void) | null = null;
    const mountPaymentElement = vi
      .fn()
      .mockReturnValue(new Promise<void>((resolve) => (releaseMount = resolve)));
    const confirmPayment = vi.fn();
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, mountPaymentElement, confirmPayment }),
    );

    await openReadyDialog(el, fixture);

    // Mounted but not ready: loading state, no enabled Pay button.
    expect(mountPaymentElement).toHaveBeenCalledOnce();
    expect(buttonByText(payDialog(el), 'Loading…')).not.toBeNull();
    expect(buttonByText(payDialog(el), 'Pay €289.50')).toBeNull();

    releaseMount!();
    await settle(fixture);

    // Ready: Pay enabled and confirmPayment wired to the same Elements instance.
    const payButton = buttonByText(payDialog(el), 'Pay €289.50');
    expect(payButton).not.toBeNull();
    expect(payButton!.disabled).toBe(false);
  });

  it('reports a missing publishable key as a configuration problem — never as "Payment failed"', async () => {
    const { PaymentConfigurationError } = await import('./payment.service');
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const mountPaymentElement = vi
      .fn()
      .mockRejectedValue(new PaymentConfigurationError('no key'));
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, mountPaymentElement }),
    );

    await openReadyDialog(el, fixture);

    expect(payDialog(el).textContent).toContain('not configured');
    expect(el.textContent).not.toContain('Payment failed');
    expect(toast.success).not.toHaveBeenCalled();
    expect(buttonByText(payDialog(el), 'Pay €289.50')).toBeNull();
  });

  it('shows a loading state while the PaymentIntent is being created', async () => {
    const pending = new Subject<unknown>();
    const pay = vi.fn().mockReturnValue(pending.asObservable());
    const { fixture, el, paymentService } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay }),
    );

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);

    expect(payDialog(el).textContent).toContain('Preparing secure payment');
    expect(buttonByText(payDialog(el), 'Loading…')).not.toBeNull();
    expect(paymentService.mountPaymentElement).not.toHaveBeenCalled();
  });

  it('does NOT show success after the POST 200 — success only after the backend confirms via polling', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const confirmPayment = vi.fn().mockResolvedValue({ kind: 'confirmed' });
    const poll = new Subject<unknown>();
    const pollUntilSettled = vi.fn().mockReturnValue(poll.asObservable());
    const getById = vi.fn().mockReturnValue(of(booking()));
    const { fixture, el, toast } = await setup(getById, undefined, stripeMock({
      pay,
      confirmPayment,
      pollUntilSettled,
    }));

    await openReadyDialog(el, fixture);
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
    await settle(fixture);

    // Stripe accepted the payment — but the webhook has not finalized yet.
    expect(confirmPayment).toHaveBeenCalledOnce();
    expect(payDialog(el).textContent).toContain('confirming your booking');
    expect(toast.success).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Pending payment');

    // The webhook lands; polling observes the persisted SUCCESS.
    poll.next({ kind: 'settled', payment: payment({ status: 'SUCCESS' }) });
    await settle(fixture);

    expect(toast.success).toHaveBeenCalledWith('Payment successful — your booking is confirmed.');
    expect(getById).toHaveBeenCalledTimes(2); // booking + payments refreshed
    expect(sessionStorage.getItem(attemptKey)).toBeNull(); // terminal → attempt cleared
  });

  it('keeps the SAME PaymentIntent on a Stripe card error — no second POST, no new key', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const confirmPayment = vi
      .fn()
      .mockResolvedValue({ kind: 'failed', message: 'Your card was declined.' });
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, confirmPayment }),
    );

    await openReadyDialog(el, fixture);
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
    await settle(fixture);

    expect(pay).toHaveBeenCalledOnce(); // no new PaymentIntent
    expect(payDialog(el).textContent).toContain('Your card was declined.');
    // Back to ready — the customer can correct the card details.
    expect(buttonByText(payDialog(el), 'Pay €289.50')).not.toBeNull();
  });

  it('reuses the same idempotency key after a retryable POST failure (network/5xx)', async () => {
    const pay = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of(intentResult()));
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay }),
    );

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('payment attempt is preserved');
    const firstKey = pay.mock.calls[0][1].idempotencyKey as string;
    expect(sessionStorage.getItem(attemptKey)).toContain(firstKey);

    buttonByText(el, 'Complete payment')!.click();
    await settle(fixture);

    expect(pay).toHaveBeenCalledTimes(2);
    expect(pay.mock.calls[1][1].idempotencyKey).toBe(firstKey); // same attempt resumed
  });

  it('treats 402 as terminal: clears the attempt and mints a fresh key on the next attempt', async () => {
    const pay = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => ({
          status: 402,
          error: { message: 'Payment failed: the payment method was declined.' },
        })),
      )
      .mockReturnValue(of(intentResult()));
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay }),
    );

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);

    expect(el.querySelector('.alert--danger')?.textContent).toContain(
      'Payment failed: the payment method was declined.',
    );
    expect(sessionStorage.getItem(attemptKey)).toBeNull();
    const firstKey = pay.mock.calls[0][1].idempotencyKey as string;

    buttonByText(el, 'Try again')!.click();
    await settle(fixture);

    expect(pay).toHaveBeenCalledTimes(2);
    expect(pay.mock.calls[1][1].idempotencyKey).not.toBe(firstKey);
  });

  it('handles 409 payment-in-progress with a friendly message and polling — never a second attempt', async () => {
    const pay = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const pollUntilSettled = vi.fn().mockReturnValue(new Subject<unknown>().asObservable());
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, pollUntilSettled }),
    );

    buttonByText(el, 'Pay now')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('already in progress');
    expect(el.textContent).not.toContain('409');
    // A resumable in-progress state must never render as a terminal failure.
    expect(el.textContent).not.toContain('Payment failed');
    expect(buttonByText(el, 'Complete payment')).not.toBeNull();
    expect(pollUntilSettled).toHaveBeenCalledWith(ID);
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('offers to resume an unfinished payment after a browser refresh', async () => {
    sessionStorage.setItem(
      attemptKey,
      JSON.stringify({ bookingId: ID, idempotencyKey: 'persisted-key-123' }),
    );
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, getPayments: vi.fn().mockReturnValue(of([payment({ status: 'PENDING' })])) }),
    );

    expect(el.textContent).toContain('already started a payment');

    buttonByText(el, 'Complete payment')!.click();
    await settle(fixture);

    // The persisted key resumes the same PaymentIntent — never a second one.
    expect(pay).toHaveBeenCalledWith(ID, { idempotencyKey: 'persisted-key-123' });
  });

  it('clears a stale persisted attempt when the latest payment is already terminal', async () => {
    sessionStorage.setItem(
      attemptKey,
      JSON.stringify({ bookingId: ID, idempotencyKey: 'persisted-key-123' }),
    );
    const { el } = await setup(
      vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' }))),
      undefined,
      stripeMock({
        getPayments: vi.fn().mockReturnValue(of([payment({ status: 'SUCCESS' })])),
      }),
    );

    expect(el.textContent).not.toContain('unfinished payment');
    expect(sessionStorage.getItem(attemptKey)).toBeNull();
  });

  it('blocks duplicate submission and cancel while the Stripe confirmation runs', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const confirmPayment = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const { fixture, el } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, confirmPayment }),
    );

    await openReadyDialog(el, fixture);
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
    await settle(fixture);

    // Second confirm click is inert and the button is disabled.
    const confirming = buttonByText(payDialog(el), 'Confirming…')!;
    expect(confirming.disabled).toBe(true);
    confirming.click();
    buttonByText(payDialog(el), 'Not now')!.click();
    await settle(fixture);

    expect(confirmPayment).toHaveBeenCalledOnce();
    expect(el.querySelector('na-dialog[title="Pay for your booking"]')).not.toBeNull();
  });

  it('shows the still-processing note on poll timeout and keeps the attempt', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const confirmPayment = vi.fn().mockResolvedValue({ kind: 'confirmed' });
    const pollUntilSettled = vi.fn().mockReturnValue(of({ kind: 'timeout' }));
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, confirmPayment, pollUntilSettled }),
    );

    await openReadyDialog(el, fixture);
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('still being processed');
    expect(toast.success).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(attemptKey)).not.toBeNull(); // resumable later
  });

  it('shows the failure UI when polling observes a terminal FAILED payment', async () => {
    const pay = vi.fn().mockReturnValue(of(intentResult()));
    const confirmPayment = vi.fn().mockResolvedValue({ kind: 'confirmed' });
    const pollUntilSettled = vi
      .fn()
      .mockReturnValue(of({ kind: 'settled', payment: payment({ status: 'FAILED' }) }));
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMock({ pay, confirmPayment, pollUntilSettled }),
    );

    await openReadyDialog(el, fixture);
    buttonByText(payDialog(el), 'Pay €289.50')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('Payment could not be completed');
    expect(toast.success).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(attemptKey)).toBeNull();
  });
});

describe('ManageBookingPage — realtime payment updates', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  const stripeMode = (overrides: Partial<PaymentMock> = {}): Partial<PaymentMock> => ({
    providerMode: 'stripe',
    mountPaymentElement: vi.fn().mockResolvedValue(undefined),
    unmountPaymentElement: vi.fn(),
    confirmPayment: vi.fn(),
    pollUntilSettled: vi.fn(),
    pollUntilTerminal: vi.fn().mockReturnValue(EMPTY),
    ...overrides,
  });

  const stripePendingPayment = () =>
    payment({
      status: 'PENDING',
      provider: 'stripe',
      providerReference: 'pi_123',
      paidAt: null,
    });

  const watchSubject = (ws: Subject<BookingRealtimeEvent>): Partial<RealtimeMock> => ({
    watchBooking: vi.fn().mockReturnValue(ws.asObservable()),
  });

  it('settles automatically on a pushed success: success state, Pay now hidden, no second attempt', async () => {
    const ws = new Subject<BookingRealtimeEvent>();
    const getById = vi
      .fn()
      .mockReturnValueOnce(of(booking()))
      .mockReturnValue(of(booking({ status: 'CONFIRMED' })));
    const getPayments = vi
      .fn()
      .mockReturnValueOnce(of([stripePendingPayment()]))
      .mockReturnValue(of([payment({ status: 'SUCCESS' })]));
    const pay = vi.fn();
    const { fixture, el, toast, realtime } = await setup(
      getById,
      undefined,
      stripeMode({ getPayments, pay }),
      undefined,
      undefined,
      watchSubject(ws),
    );

    // Pending page: the open attempt is tracked via realtime, resume is offered.
    expect(realtime.watchBooking).toHaveBeenCalledWith(ID);
    expect(el.textContent).toContain('Payment in progress');

    ws.next({ kind: 'payment.status', bookingId: ID, paymentId: 'pay-1', status: 'SUCCESS' });
    await settle(fixture);

    // The push was reconciled with the authoritative API, then settled.
    expect(getPayments.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Payment successful — your booking is confirmed.');
    expect(pay).not.toHaveBeenCalled(); // no second payment attempt was initiated
    expect(buttonByText(el, 'Pay now')).toBeNull(); // Pay now disappears after success
    expect(el.textContent).toContain('Confirmed'); // booking details refreshed
    expect(ws.observed).toBe(false); // tracking stopped after the terminal state
  });

  it('settles via the bounded recovery poll when the push was missed', async () => {
    const poll = new Subject<CustomerPayment>();
    const getById = vi
      .fn()
      .mockReturnValueOnce(of(booking()))
      .mockReturnValue(of(booking({ status: 'CONFIRMED' })));
    const getPayments = vi.fn().mockReturnValue(of([stripePendingPayment()]));
    const pollUntilTerminal = vi.fn().mockReturnValue(poll.asObservable());
    const { fixture, el, toast } = await setup(
      getById,
      undefined,
      stripeMode({ getPayments, pollUntilTerminal }),
    );

    expect(pollUntilTerminal).toHaveBeenCalledWith(ID);
    expect(toast.success).not.toHaveBeenCalled();

    poll.next(payment({ status: 'SUCCESS' }));
    await settle(fixture);

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(buttonByText(el, 'Pay now')).toBeNull();
    // A late duplicate poll emission after settlement is ignored.
    poll.next(payment({ status: 'SUCCESS' }));
    await settle(fixture);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('fetches the authoritative success state on init when the event was missed before the page opened', async () => {
    const getById = vi.fn().mockReturnValue(of(booking({ status: 'CONFIRMED' })));
    const getPayments = vi.fn().mockReturnValue(of([payment({ status: 'SUCCESS' })]));
    const { el, paymentService, realtime } = await setup(
      getById,
      undefined,
      stripeMode({ getPayments }),
    );

    expect(el.textContent).toContain('Paid');
    expect(buttonByText(el, 'Pay now')).toBeNull();
    // Nothing pending → no realtime watch and no recovery polling at all.
    expect(realtime.watchBooking).not.toHaveBeenCalled();
    expect(paymentService.pollUntilTerminal).not.toHaveBeenCalled();
  });

  it('reconciles through the API after a reconnect (missed events while disconnected)', async () => {
    const ws = new Subject<BookingRealtimeEvent>();
    const getPayments = vi.fn().mockReturnValue(of([stripePendingPayment()]));
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMode({ getPayments }),
      undefined,
      undefined,
      watchSubject(ws),
    );
    expect(getPayments).toHaveBeenCalledTimes(1); // page init only

    ws.next({ kind: 'connected', reconnected: true });
    await settle(fixture);

    expect(getPayments).toHaveBeenCalledTimes(2); // reconciled once
    // Still pending server-side → truthful pending UI, never a fake success.
    expect(toast.success).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Payment in progress');
  });

  it('ignores duplicate success pushes — the booking settles exactly once', async () => {
    const ws = new Subject<BookingRealtimeEvent>();
    const getById = vi
      .fn()
      .mockReturnValueOnce(of(booking()))
      .mockReturnValue(of(booking({ status: 'CONFIRMED' })));
    const getPayments = vi
      .fn()
      .mockReturnValueOnce(of([stripePendingPayment()]))
      .mockReturnValue(of([payment({ status: 'SUCCESS' })]));
    const { fixture, toast } = await setup(
      getById,
      undefined,
      stripeMode({ getPayments }),
      undefined,
      undefined,
      watchSubject(ws),
    );

    ws.next({ kind: 'payment.status', bookingId: ID, paymentId: 'pay-1', status: 'SUCCESS' });
    await settle(fixture);
    ws.next({ kind: 'payment.status', bookingId: ID, paymentId: 'pay-1', status: 'SUCCESS' });
    await settle(fixture);

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledTimes(2); // init + one post-settlement reload
  });

  it('treats a pushed failure as distinct from success and offers retry only after terminal FAILED', async () => {
    const ws = new Subject<BookingRealtimeEvent>();
    const failed = payment({ status: 'FAILED', paidAt: null, failedAt: '2026-09-20T10:21:00Z' });
    const getPayments = vi
      .fn()
      .mockReturnValueOnce(of([stripePendingPayment()]))
      .mockReturnValue(of([failed]));
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMode({ getPayments }),
      undefined,
      undefined,
      watchSubject(ws),
    );

    ws.next({ kind: 'payment.status', bookingId: ID, paymentId: 'pay-1', status: 'FAILED' });
    await settle(fixture);

    expect(toast.success).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Payment could not be completed');
    expect(el.textContent).not.toContain('Payment successful');
    // The booking is still PENDING and the attempt terminally FAILED → retry is safe to offer.
    expect(buttonByText(el, 'Try again')).not.toBeNull();
  });

  it('ignores non-terminal pushes — no reconcile storm, no state change', async () => {
    const ws = new Subject<BookingRealtimeEvent>();
    const getPayments = vi.fn().mockReturnValue(of([stripePendingPayment()]));
    const { fixture, el, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMode({ getPayments }),
      undefined,
      undefined,
      watchSubject(ws),
    );
    expect(getPayments).toHaveBeenCalledTimes(1);

    ws.next({ kind: 'payment.status', bookingId: ID, paymentId: 'pay-1', status: 'PENDING' });
    await settle(fixture);

    expect(getPayments).toHaveBeenCalledTimes(1); // no extra fetch
    expect(toast.success).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Payment in progress');
  });

  it('stops watching when the component is destroyed', async () => {
    const ws = new Subject<BookingRealtimeEvent>();
    const poll = new Subject<CustomerPayment>();
    const getPayments = vi.fn().mockReturnValue(of([stripePendingPayment()]));
    const { fixture, toast } = await setup(
      vi.fn().mockReturnValue(of(booking())),
      undefined,
      stripeMode({
        getPayments,
        pollUntilTerminal: vi.fn().mockReturnValue(poll.asObservable()),
      }),
      undefined,
      undefined,
      watchSubject(ws),
    );
    expect(ws.observed).toBe(true);
    expect(poll.observed).toBe(true);

    fixture.destroy();

    expect(ws.observed).toBe(false);
    expect(poll.observed).toBe(false);
    // Late emissions after teardown have no effect.
    ws.next({ kind: 'payment.status', bookingId: ID, paymentId: 'pay-1', status: 'SUCCESS' });
    poll.next(payment({ status: 'SUCCESS' }));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
