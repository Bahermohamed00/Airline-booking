import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { ReviewPage } from './review.component';
import { BookingDraftService } from './booking-draft.service';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AuthService } from '../../../core/services/auth.service';
import type { BookingDraft } from '../../../core/models/booking-flow.model';
import type {
  CreateBookingPayload,
  CustomerBooking,
  PricePreviewResponse,
} from '../../../core/models/customer-booking.model';
import type { Fare, Flight, Seat } from '../../../core/models/domain.model';
import type { ExtraCatalogItem } from '../../../core/models/extras.model';

const SEAT: Seat = {
  id: 's-e-10a',
  aircraftId: 'ac-1',
  seatNumber: '10A',
  cabinClass: 'ECONOMY',
  seatRow: 10,
  seatColumn: 'A',
  isExitRow: false,
};

const SEAT_B: Seat = {
  id: 's-e-10b',
  aircraftId: 'ac-1',
  seatNumber: '10B',
  cabinClass: 'ECONOMY',
  seatRow: 10,
  seatColumn: 'B',
  isExitRow: false,
};

const FLIGHT = {
  id: 'fl-1',
  flightNumber: 'NV100',
  departureTime: '2026-10-01T09:00:00Z',
  arrivalTime: '2026-10-01T13:00:00Z',
  status: 'SCHEDULED',
  route: {
    origin: { iataCode: 'FRA', city: 'Frankfurt' },
    destination: { iataCode: 'JFK', city: 'New York' },
  },
} as unknown as Flight;

const FARE: Fare = {
  id: 'fare-1',
  flightId: 'fl-1',
  cabinClass: 'ECONOMY',
  basePrice: 100,
  taxAmount: 20,
  feeAmount: 5,
  currency: 'EUR',
  availableCount: 9,
  rules: null,
};

const BOOKING: CustomerBooking = {
  id: 'bk-1',
  bookingReference: 'NVX7Q2',
  status: 'PENDING',
  totalAmount: 250,
  currency: 'EUR',
  contactEmail: 'aya@example.com',
  contactPhone: null,
  cabinClass: 'ECONOMY',
  perPassengerTotal: 125,
  bookedAt: '2026-09-01T10:00:00Z',
  flight: null,
  passengers: [],
  seats: [],
};

function makeDraft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return {
    criteria: {
      tripType: 'ONE_WAY',
      originCode: 'FRA',
      destinationCode: 'JFK',
      departureDate: '2026-10-01',
      passengers: { adults: 2, children: 0, infants: 0 },
      cabinClass: 'ECONOMY',
    },
    outbound: FLIGHT,
    returnFlight: null,
    fare: FARE,
    returnFare: null,
    passengers: [
      {
        passengerType: 'ADULT',
        firstName: '  Lena  ',
        lastName: ' Hoffmann',
        dateOfBirth: '1992-04-18',
        nationality: 'Germany',
        passportNumber: 'C01X00T47',
      },
      {
        passengerType: 'ADULT',
        firstName: 'Jonas',
        lastName: 'Hoffmann',
        dateOfBirth: '',
        nationality: '',
        passportNumber: '',
      },
    ],
    contactEmail: 'aya@example.com',
    contactPhone: '',
    seats: [{ passengerIndex: 0, seat: SEAT }, { passengerIndex: 1, seat: SEAT_B }],
    returnSeats: [],
    extras: [],
    baggagePieces: [0, 0],
    offerId: null,
    seatHoldExpiresAt: null,
    confirmedBooking: null,
    ...overrides,
  };
}

/** Preview matching the client breakdown of makeDraft: (100+20+5) × 2. */
function makePreview(overrides: Partial<PricePreviewResponse> = {}): PricePreviewResponse {
  return {
    currency: 'EUR',
    perPassenger: { basePrice: 100, discountAmount: 0, taxAmount: 20, feeAmount: 5, total: 125 },
    passengerCount: 2,
    totalAmount: 250,
    offer: null,
    extras: { total: 0, lines: [] },
    ...overrides,
  };
}

interface SetupOptions {
  draft?: BookingDraft;
  loggedIn?: boolean;
  create?: ReturnType<typeof vi.fn>;
  pricePreview?: ReturnType<typeof vi.fn>;
}

async function setup(opts: SetupOptions = {}) {
  const draftSignal = signal<BookingDraft | null>(opts.draft ?? makeDraft());
  const draftService = {
    draft: draftSignal.asReadonly(),
    isHoldExpired: vi.fn(() => false),
    releaseHold: vi.fn(),
    setConfirmedBooking: vi.fn(),
    clearOffer: vi.fn(() =>
      draftSignal.update((d) =>
        d ? { ...d, offerId: null, criteria: { ...d.criteria, offerId: null } } : d,
      ),
    ),
  };
  const bookingService = {
    create: opts.create ?? vi.fn().mockReturnValue(of(BOOKING)),
    pricePreview: opts.pricePreview ?? vi.fn().mockReturnValue(of(makePreview())),
  };
  const authService = { isLoggedIn: vi.fn(() => opts.loggedIn ?? true) };

  await TestBed.configureTestingModule({
    imports: [ReviewPage],
    providers: [
      provideRouter([]),
      { provide: BookingDraftService, useValue: draftService },
      { provide: CustomerBookingService, useValue: bookingService },
      { provide: AuthService, useValue: authService },
    ],
  }).compileComponents();

  const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture: ComponentFixture<ReviewPage> = TestBed.createComponent(ReviewPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    draftService,
    bookingService,
    authService,
    navigateSpy,
  };
}

async function settle(fixture: ComponentFixture<ReviewPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function confirmButton(el: HTMLElement): HTMLButtonElement {
  // The only na-button inside the confirmation block; its label switches to
  // "Creating your booking…" while submitting, so select it structurally.
  const btn = el.querySelector<HTMLButtonElement>('.confirm na-button button');
  if (!btn) throw new Error('confirm button not rendered');
  return btn;
}

async function consentAndSubmit(
  fixture: ComponentFixture<ReviewPage>,
  el: HTMLElement,
): Promise<void> {
  (el.querySelector('#consent') as HTMLInputElement).click();
  await settle(fixture);
  confirmButton(el).click();
  await settle(fixture);
}

describe('ReviewPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows a server-consistent breakdown (fare components × passengers) with no seat/extras/promo lines', async () => {
    const { el } = await setup();
    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('€200.00'); // base 100 × 2
    expect(table).toContain('€40.00'); // taxes 20 × 2
    expect(table).toContain('€10.00'); // fees 5 × 2
    expect(table).toContain('€250.00'); // total (100+20+5) × 2
    expect(table).not.toContain('Seat selection');
    expect(table).not.toContain('Add-ons');
    expect(table).not.toContain('Promo');
    expect(el.textContent).toContain('Seats are included at no charge');
    expect(el.textContent).toContain('pending');
  });

  it('sends exactly the CreateBookingPayload contract — no client-computed or server-owned fields', async () => {
    const { fixture, el, bookingService } = await setup();
    await consentAndSubmit(fixture, el);

    expect(bookingService.create).toHaveBeenCalledOnce();
    const payload = bookingService.create.mock.calls[0][0] as CreateBookingPayload;
    expect(payload).toEqual({
      idempotencyKey: expect.any(String),
      flightId: 'fl-1',
      cabinClass: 'ECONOMY',
      seatIds: ['s-e-10a', 's-e-10b'],
      passengers: [
        {
          passengerType: 'ADULT',
          firstName: 'Lena',
          lastName: 'Hoffmann',
          dateOfBirth: '1992-04-18',
          nationality: 'Germany',
          passportNumber: 'C01X00T47',
        },
        { passengerType: 'ADULT', firstName: 'Jonas', lastName: 'Hoffmann' },
      ],
      contactEmail: 'aya@example.com',
    });
    // UUID v4 — the server validates the format strictly.
    expect(payload.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Object.keys(payload).sort()).toEqual(['cabinClass', 'contactEmail', 'flightId', 'idempotencyKey', 'passengers', 'seatIds']);
    for (const forbidden of ['userId', 'status', 'totalAmount', 'bookingReference', 'payments', 'extras', 'promo', 'flightSegmentId', 'passengerId']) {
      expect(payload).not.toHaveProperty(forbidden);
    }
  });

  it('sends the user back to seat selection instead of calling the API when seats are missing', async () => {
    const cases: BookingDraft['seats'][] = [[], [{ passengerIndex: 0, seat: SEAT }]];
    for (const seats of cases) {
      TestBed.resetTestingModule();
      const { fixture, el, bookingService, navigateSpy } = await setup({ draft: makeDraft({ seats }) });
      await consentAndSubmit(fixture, el);

      expect(bookingService.create).not.toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/booking/seats']);
    }
  });

  it('includes contactPhone only when present', async () => {
    const { fixture, el, bookingService } = await setup({
      draft: makeDraft({ contactPhone: '+49 170 1234567' }),
    });
    await consentAndSubmit(fixture, el);
    const payload = bookingService.create.mock.calls[0][0] as CreateBookingPayload;
    expect(payload.contactPhone).toBe('+49 170 1234567');
  });

  it('prevents double submits while the create call is in flight', async () => {
    const pending = new Subject<CustomerBooking>();
    const create = vi.fn().mockReturnValue(pending.asObservable());
    const { fixture, el } = await setup({ create });

    (el.querySelector('#consent') as HTMLInputElement).click();
    await settle(fixture);
    confirmButton(el).click();
    await settle(fixture);
    confirmButton(el).click();
    await settle(fixture);

    expect(create).toHaveBeenCalledOnce();
    expect(confirmButton(el).disabled).toBe(true);
  });

  it('stores the confirmed booking and navigates to confirmation with ?id=', async () => {
    const { fixture, el, draftService, navigateSpy } = await setup();
    await consentAndSubmit(fixture, el);

    expect(draftService.setConfirmedBooking).toHaveBeenCalledWith(BOOKING);
    expect(navigateSpy).toHaveBeenCalledWith(['/booking/confirmation'], {
      queryParams: { id: 'bk-1' },
    });
  });

  it('redirects guests to login with a returnUrl instead of calling the API', async () => {
    const { fixture, el, bookingService, navigateSpy } = await setup({ loggedIn: false });
    await consentAndSubmit(fixture, el);

    expect(bookingService.create).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/review' },
    });
  });

  it('redirects to login with returnUrl on 401', async () => {
    const create = vi.fn().mockReturnValue(throwError(() => ({ status: 401 })));
    const { fixture, el, draftService, navigateSpy } = await setup({ create });
    await consentAndSubmit(fixture, el);

    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/review' },
    });
    expect(draftService.releaseHold).not.toHaveBeenCalled();
  });

  it('shows server validation messages on 400 without retrying blindly', async () => {
    const create = vi
      .fn()
      .mockReturnValue(
        throwError(() => ({
          status: 400,
          error: { message: ['contactEmail must be an email', 'seatIds is too short'] },
        })),
      );
    const { fixture, el, draftService, navigateSpy } = await setup({ create });
    await consentAndSubmit(fixture, el);

    expect(el.textContent).toContain('contactEmail must be an email');
    expect(el.textContent).toContain('seatIds is too short');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(draftService.releaseHold).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
  });

  it('releases the hold and returns to seat selection on 409 seat conflict', async () => {
    const create = vi
      .fn()
      .mockReturnValue(
        throwError(() => ({ status: 409, error: { message: 'Seats no longer available' } })),
      );
    const { fixture, el, draftService, navigateSpy } = await setup({ create });
    await consentAndSubmit(fixture, el);

    expect(draftService.releaseHold).toHaveBeenCalledOnce();
    expect(navigateSpy).toHaveBeenCalledWith(['/booking/seats'], { state: { seatConflict: true } });
  });

  it('shows a flight-unavailable message on 404', async () => {
    const create = vi.fn().mockReturnValue(throwError(() => ({ status: 404 })));
    const { fixture, el } = await setup({ create });
    await consentAndSubmit(fixture, el);

    expect(el.textContent).toContain('no longer available');
  });

  it('shows a retryable generic error on unexpected failures', async () => {
    const create = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { fixture, el } = await setup({ create });
    await consentAndSubmit(fixture, el);

    expect(el.textContent).toContain('could not be created');
    expect(el.querySelector('.confirm .alert__retry')).not.toBeNull();
  });

  it('reuses the same idempotency key when a retryable failure is retried', async () => {
    const create = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValueOnce(of(BOOKING));
    const { fixture, el, navigateSpy } = await setup({ create });
    await consentAndSubmit(fixture, el);

    (el.querySelector('.confirm .alert__retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0] as CreateBookingPayload;
    const second = create.mock.calls[1][0] as CreateBookingPayload;
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(navigateSpy).toHaveBeenCalledWith(['/booking/confirmation'], { queryParams: { id: 'bk-1' } });
  });

  it('generates a fresh idempotency key after a non-retryable rejection', async () => {
    const create = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'bad request' } })))
      .mockReturnValueOnce(of(BOOKING));
    const { fixture, el } = await setup({ create });
    await consentAndSubmit(fixture, el);

    // The user can correct and resubmit — that is a new logical request.
    confirmButton(el).click();
    await settle(fixture);

    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0] as CreateBookingPayload;
    const second = create.mock.calls[1][0] as CreateBookingPayload;
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('requires the terms acknowledgement before submitting', async () => {
    const { fixture, el, bookingService } = await setup();
    confirmButton(el).click();
    await settle(fixture);

    expect(bookingService.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Please accept the terms to continue');
  });

  it('previews the price server-side with flight, cabin, passenger count and offerId', async () => {
    const { bookingService } = await setup({ draft: makeDraft({ offerId: 'offer-9' }) });

    expect(bookingService.pricePreview).toHaveBeenCalledWith({
      flightId: 'fl-1',
      cabinClass: 'ECONOMY',
      passengerCount: 2,
      offerId: 'offer-9',
    });
  });

  it('renders the server preview including the offer discount line and server total', async () => {
    const { el } = await setup({
      draft: makeDraft({ offerId: 'offer-9' }),
      pricePreview: vi.fn().mockReturnValue(
        of(
          makePreview({
            perPassenger: { basePrice: 100, discountAmount: 10, taxAmount: 20, feeAmount: 5, total: 115 },
            totalAmount: 230,
            offer: {
              id: 'offer-9',
              title: 'Winter Sun',
              discountType: 'PERCENT',
              discountValue: 10,
              discountAmountPerPassenger: 10,
              currency: 'EUR',
            },
          }),
        ),
      ),
    });

    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('Offer discount × 2');
    expect(table).toContain('−€20.00'); // 10 × 2, shown as negative
    expect(table).toContain('€230.00'); // server totalAmount
    expect(el.textContent).toContain('Winter Sun');
  });

  it('shows the client-computed breakdown only as fallback while the preview is pending', async () => {
    const pending = new Subject<PricePreviewResponse>();
    const { el } = await setup({ pricePreview: vi.fn().mockReturnValue(pending.asObservable()) });

    const table = el.querySelector('.side__table')!.textContent!;
    expect(table).toContain('€250.00');
    expect(table).not.toContain('Offer discount');
  });

  it('surfaces a generic preview error and keeps the indicative breakdown', async () => {
    const { el } = await setup({
      pricePreview: vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))),
    });

    expect(el.textContent).toContain('Price could not be confirmed');
    expect(el.querySelector('.side__table')!.textContent).toContain('€250.00');
    expect(el.textContent).not.toContain('no longer available');
  });

  it('includes offerId in the create payload — and still never any totals', async () => {
    const { fixture, el, bookingService } = await setup({ draft: makeDraft({ offerId: 'offer-9' }) });
    await consentAndSubmit(fixture, el);

    const payload = bookingService.create.mock.calls[0][0] as CreateBookingPayload;
    expect(payload.offerId).toBe('offer-9');
    expect(payload).not.toHaveProperty('totalAmount');
    expect(payload).not.toHaveProperty('total');
    expect(payload).not.toHaveProperty('discountAmount');
  });

  it('409 OFFER_NOT_AVAILABLE on preview shows an explicit continue-without-offer recovery that re-previews', async () => {
    const pricePreview = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 409, error: { code: 'OFFER_NOT_AVAILABLE' } })))
      .mockReturnValue(of(makePreview()));
    const { fixture, el, draftService } = await setup({
      draft: makeDraft({ offerId: 'offer-9' }),
      pricePreview,
    });

    expect(el.textContent).toContain('no longer available');
    expect(el.textContent).toContain('Continue without this offer');

    el.querySelector<HTMLElement>('.offer-blocked__action button')!.click();
    await settle(fixture);

    expect(draftService.clearOffer).toHaveBeenCalledOnce();
    expect(pricePreview).toHaveBeenCalledTimes(2);
    expect(pricePreview.mock.calls[1][0]).toEqual({
      flightId: 'fl-1',
      cabinClass: 'ECONOMY',
      passengerCount: 2,
    });
    expect(el.textContent).not.toContain('Continue without this offer');
  });

  it('404 OFFER_NOT_FOUND on preview triggers the same recovery', async () => {
    const { el } = await setup({
      draft: makeDraft({ offerId: 'offer-9' }),
      pricePreview: vi
        .fn()
        .mockReturnValue(throwError(() => ({ status: 404, error: { code: 'OFFER_NOT_FOUND' } }))),
    });

    expect(el.textContent).toContain('no longer available');
    expect(el.textContent).toContain('Continue without this offer');
  });

  it('409 OFFER_NOT_AVAILABLE on create shows the recovery; continuing without the offer lets the customer resubmit', async () => {
    const create = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => ({ status: 409, error: { code: 'OFFER_NOT_AVAILABLE' } })),
      )
      .mockReturnValue(of(BOOKING));
    const { fixture, el, draftService, navigateSpy } = await setup({
      draft: makeDraft({ offerId: 'offer-9' }),
      create,
    });
    await consentAndSubmit(fixture, el);

    expect(el.textContent).toContain('no longer available');
    expect(draftService.releaseHold).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalledWith(['/booking/seats'], expect.anything());

    el.querySelector<HTMLElement>('.offer-blocked__action button')!.click();
    await settle(fixture);
    expect(draftService.clearOffer).toHaveBeenCalledOnce();

    // Consent is still checked; resubmit directly.
    confirmButton(el).click();
    await settle(fixture);

    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0] as CreateBookingPayload;
    const second = create.mock.calls[1][0] as CreateBookingPayload;
    expect(first.offerId).toBe('offer-9');
    expect(second).not.toHaveProperty('offerId');
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(navigateSpy).toHaveBeenCalledWith(['/booking/confirmation'], { queryParams: { id: 'bk-1' } });
  });

  describe('extras integration', () => {
    const BAG: ExtraCatalogItem = {
      id: 'svc-bag',
      code: 'BAG_23KG',
      name: 'Extra checked bag (23 kg)',
      description: null,
      category: 'BAGGAGE',
      pricingUnit: 'PER_ITEM',
      price: 65,
      currency: 'EUR',
      maxQuantity: 3,
      requiresPassenger: true,
      validFrom: null,
      validTo: null,
      bagWeightKg: 23,
      dietaryTags: [],
      demonstration: false,
    };

    const draftWithBag = () =>
      makeDraft({ extras: [{ service: { ...BAG }, quantity: 1, passengerIndex: 0 }] });

    it('sends extras to the price preview and renders the priced line and total', async () => {
      const pricePreview = vi.fn().mockReturnValue(
        of(
          makePreview({
            totalAmount: 315,
            extras: {
              total: 65,
              lines: [
                {
                  serviceId: 'svc-bag',
                  code: 'BAG_23KG',
                  name: 'Extra checked bag (23 kg)',
                  category: 'BAGGAGE',
                  pricingUnit: 'PER_ITEM',
                  quantity: 1,
                  passengerIndex: 0,
                  unitPrice: 65,
                  totalPrice: 65,
                },
              ],
            },
          }),
        ),
      );
      const { el } = await setup({ draft: draftWithBag(), pricePreview });

      expect(pricePreview).toHaveBeenCalledWith({
        flightId: 'fl-1',
        cabinClass: 'ECONOMY',
        passengerCount: 2,
        extras: [{ serviceId: 'svc-bag', quantity: 1, passengerIndex: 0 }],
      });
      const table = el.querySelector('.side__table')!.textContent!;
      expect(table).toContain('Extra checked bag (23 kg)');
      expect(table).toContain('Lena');
      expect(table).toContain('€315.00');
      // The extras panel lists the selection instead of the old placeholder.
      expect(el.textContent).toContain('Baggage & extras');
      expect(el.textContent).not.toContain('No add-on services were available');
    });

    it('includes extras in the create payload (ids and quantities only)', async () => {
      const { fixture, el, bookingService } = await setup({ draft: draftWithBag() });
      await consentAndSubmit(fixture, el);

      const payload = bookingService.create.mock.calls[0][0] as CreateBookingPayload;
      expect(payload.extras).toEqual([{ serviceId: 'svc-bag', quantity: 1, passengerIndex: 0 }]);
      expect(JSON.stringify(payload)).not.toContain('"price"');
    });

    it('shows the extras-review alert when creation rejects the selection (EXTRAS_INVALID)', async () => {
      const create = vi
        .fn()
        .mockReturnValueOnce(
          throwError(() => ({
            status: 400,
            error: { code: 'EXTRAS_INVALID', message: 'One or more selected extras are not available for this booking' },
          })),
        )
        .mockReturnValue(of(BOOKING));
      const { fixture, el } = await setup({ draft: draftWithBag(), create });
      await consentAndSubmit(fixture, el);

      expect(el.textContent).toContain('Some extras need your review');
      expect(el.textContent).toContain('extras page');
      // Not a generic submit error, and nothing was charged.
      expect(el.textContent).not.toContain('Booking could not be created');
    });

    it('shows the extras-review alert when the preview rejects the selection', async () => {
      const pricePreview = vi.fn().mockReturnValue(
        throwError(() => ({ status: 400, error: { code: 'EXTRAS_INVALID', message: 'nope' } })),
      );
      const { el } = await setup({ draft: draftWithBag(), pricePreview });
      expect(el.textContent).toContain('Some extras need your review');
      expect(el.textContent).not.toContain('Price could not be confirmed');
    });
  });
});
