import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PaymentService } from './payment.service';
import { API_CONFIG } from '../../../core/config/api-config';
import type { CustomerPayment } from '../../../core/models/payment.model';

const fakePaymentElement = {
  mount: vi.fn(),
  unmount: vi.fn(),
  destroy: vi.fn(),
  // Stripe element lifecycle: 'ready' fires when the element is ready for input.
  on: vi.fn((event: string, cb: () => void) => {
    if (event === 'ready') cb();
  }),
};
const fakeElements = {
  create: vi.fn().mockReturnValue(fakePaymentElement),
};
const fakeStripe = {
  elements: vi.fn().mockReturnValue(fakeElements),
  confirmPayment: vi.fn(),
};

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(),
}));

import { loadStripe } from '@stripe/stripe-js';

const loadStripeMock = vi.mocked(loadStripe);

const stripeConfig = {
  baseUrl: 'http://api.test/api',
  useRealApi: true,
  paymentProvider: 'stripe' as const,
  stripePublishableKey: 'pk_test_123',
};

const payment = (overrides: Partial<CustomerPayment> = {}): CustomerPayment => ({
  id: 'pay-1',
  bookingId: 'b1',
  amount: 289.5,
  currency: 'EUR',
  status: 'PENDING',
  provider: 'stripe',
  providerReference: 'pi_123',
  providerStatus: 'requires_payment_method',
  paidAt: null,
  failedAt: null,
  createdAt: '2026-09-20T10:19:55Z',
  refunds: [],
  ...overrides,
});

describe('PaymentService', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    fakePaymentElement.on.mockImplementation((event: string, cb: () => void) => {
      if (event === 'ready') cb();
    });
    fakeElements.create.mockReturnValue(fakePaymentElement);
    fakeStripe.elements.mockReturnValue(fakeElements);
    loadStripeMock.mockResolvedValue(fakeStripe as never);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: stripeConfig },
      ],
    });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('backend HTTP', () => {
    it('pay POSTs only the idempotency key in Stripe mode — no token, no amount', () => {
      let response: unknown;
      service.pay('b1', { idempotencyKey: 'key-1' }).subscribe((r) => (response = r));

      const req = http.expectOne('http://api.test/api/bookings/b1/payment');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ idempotencyKey: 'key-1' });
      expect(req.request.body).not.toHaveProperty('token');
      // Raw card data and client-computed amounts must never be sent.
      expect(req.request.body).not.toHaveProperty('cardNumber');
      expect(req.request.body).not.toHaveProperty('amount');
      req.flush({
        payment: payment(),
        paymentIntent: {
          clientSecret: 'pi_123_secret_x',
          status: 'requires_payment_method',
          requiresAction: false,
        },
        booking: { id: 'b1', status: 'PENDING' },
      });
      expect(
        (response as { paymentIntent: { clientSecret: string } }).paymentIntent.clientSecret,
      ).toBe('pi_123_secret_x');
    });

    it('pay still accepts the optional token for mock mode', () => {
      service.pay('b1', { idempotencyKey: 'key-1', token: 'tok_abc' }).subscribe();
      const req = http.expectOne('http://api.test/api/bookings/b1/payment');
      expect(req.request.body).toEqual({ idempotencyKey: 'key-1', token: 'tok_abc' });
      req.flush({ payment: payment(), paymentIntent: null, booking: {} });
    });

    it('getPayments GETs /bookings/:id/payments', () => {
      service.getPayments('b1').subscribe();
      const req = http.expectOne('http://api.test/api/bookings/b1/payments');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('tokenize is retained for mock mode only and makes no HTTP call', () => {
      let token = '';
      service.tokenize().subscribe((t) => (token = t));
      expect(token).toMatch(/^tok_[0-9a-f]{32}$/);
      http.expectNone(() => true);
    });
  });

  describe('Stripe.js wrapper', () => {
    it('loads Stripe.js lazily once and mounts a Payment Element with the clientSecret', async () => {
      const container = document.createElement('div');
      await service.mountPaymentElement(container, 'secret-1');
      await service.mountPaymentElement(container, 'secret-2');

      expect(loadStripeMock).toHaveBeenCalledTimes(1);
      expect(loadStripeMock).toHaveBeenCalledWith('pk_test_123');
      expect(fakeStripe.elements).toHaveBeenCalledWith({ clientSecret: 'secret-2' });
      expect(fakeElements.create).toHaveBeenCalledWith('payment', {
        layout: { type: 'accordion', defaultCollapsed: false },
      });
      expect(fakePaymentElement.mount).toHaveBeenCalledWith(container);
      // The second mount released the first element.
      expect(fakePaymentElement.unmount).toHaveBeenCalled();
    });

    it('fails clearly with a configuration error when the publishable key is missing', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: API_CONFIG, useValue: { ...stripeConfig, stripePublishableKey: '' } },
        ],
      });
      const noKey = TestBed.inject(PaymentService);
      const { PaymentConfigurationError } = await import('./payment.service');
      await expect(
        noKey.mountPaymentElement(document.createElement('div'), 's'),
      ).rejects.toBeInstanceOf(PaymentConfigurationError);
    });

    it('resolves only after the Payment Element reports ready — never on bare mount', async () => {
      let readyCallback: (() => void) | null = null;
      fakePaymentElement.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'ready') readyCallback = cb;
      });

      let resolved = false;
      const pending = service
        .mountPaymentElement(document.createElement('div'), 'secret-1')
        .then(() => {
          resolved = true;
        });

      await vi.waitFor(() => expect(fakePaymentElement.mount).toHaveBeenCalled());
      expect(resolved).toBe(false); // mounted but not yet ready — Pay must stay disabled

      readyCallback!();
      await pending;
      expect(resolved).toBe(true);
    });

    it('confirmPayment maps a succeeded confirmation', async () => {
      await service.mountPaymentElement(document.createElement('div'), 'secret-1');
      fakeStripe.confirmPayment.mockResolvedValue({
        paymentIntent: { status: 'succeeded' },
      });
      const outcome = await service.confirmPayment();
      expect(outcome).toEqual({ kind: 'confirmed' });
      expect(fakeStripe.confirmPayment).toHaveBeenCalledWith({
        elements: fakeElements,
        redirect: 'if_required',
      });
    });

    it('confirmPayment maps processing and Stripe card errors', async () => {
      await service.mountPaymentElement(document.createElement('div'), 'secret-1');
      fakeStripe.confirmPayment.mockResolvedValueOnce({
        paymentIntent: { status: 'processing' },
      });
      expect(await service.confirmPayment()).toEqual({ kind: 'processing' });

      fakeStripe.confirmPayment.mockResolvedValueOnce({
        error: { message: 'Your card was declined.' },
      });
      expect(await service.confirmPayment()).toEqual({
        kind: 'failed',
        message: 'Your card was declined.',
      });
    });

    it('confirmPayment without a mounted element returns a friendly failure', async () => {
      const outcome = await service.confirmPayment();
      expect(outcome.kind).toBe('failed');
      expect(fakeStripe.confirmPayment).not.toHaveBeenCalled();
    });

    it('unmountPaymentElement releases the element and is idempotent', async () => {
      await service.mountPaymentElement(document.createElement('div'), 'secret-1');
      service.unmountPaymentElement();
      service.unmountPaymentElement();
      expect(fakePaymentElement.unmount).toHaveBeenCalled();
      expect(fakePaymentElement.destroy).toHaveBeenCalled();
    });
  });

  describe('pollUntilSettled', () => {
    const url = 'http://api.test/api/bookings/b1/payments';

    it('stops polling on SUCCESS', async () => {
      vi.useFakeTimers();
      let outcome: unknown;
      service.pollUntilSettled('b1').subscribe((o) => (outcome = o));

      await vi.advanceTimersByTimeAsync(1000);
      http.expectOne(url).flush([payment()]);
      await vi.advanceTimersByTimeAsync(2000);
      http.expectOne(url).flush([payment({ status: 'SUCCESS' })]);

      expect(outcome).toMatchObject({
        kind: 'settled',
        payment: { status: 'SUCCESS' },
      });
      vi.useRealTimers();
    });

    it('stops polling on FAILED', async () => {
      vi.useFakeTimers();
      let outcome: unknown;
      service.pollUntilSettled('b1').subscribe((o) => (outcome = o));

      await vi.advanceTimersByTimeAsync(1000);
      http.expectOne(url).flush([payment({ status: 'FAILED' })]);

      expect(outcome).toMatchObject({ kind: 'settled', payment: { status: 'FAILED' } });
      vi.useRealTimers();
    });

    it('skips a failed poll and times out gracefully — never a fake failure', async () => {
      vi.useFakeTimers();
      let outcome: unknown;
      service.pollUntilSettled('b1').subscribe((o) => (outcome = o));

      for (const ms of [1000, 2000, 2000, 3000, 3000, 5000]) {
        await vi.advanceTimersByTimeAsync(ms);
        http.expectOne(url).error(new ProgressEvent('error'));
      }
      expect(outcome).toEqual({ kind: 'timeout' });
      vi.useRealTimers();
    });
  });

  describe('pollUntilTerminal', () => {
    const url = 'http://api.test/api/bookings/b1/payments';
    const reconcileUrl = 'http://api.test/api/bookings/b1/payment/reconcile';

    it('reconciles server-side each tick, emits the terminal payment once, then completes', async () => {
      vi.useFakeTimers();
      const emissions: CustomerPayment[] = [];
      let completed = false;
      service.pollUntilTerminal('b1').subscribe({
        next: (p) => emissions.push(p),
        complete: () => (completed = true),
      });

      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).flush([payment()]);
      expect(emissions).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).flush([payment({ status: 'SUCCESS' })]);

      expect(emissions).toHaveLength(1);
      expect(emissions[0].status).toBe('SUCCESS');
      expect(completed).toBe(true);

      // A terminal observation stops the poll: no further requests are made.
      await vi.advanceTimersByTimeAsync(60_000);
      http.expectNone(reconcileUrl);
      http.expectNone(url);
      vi.useRealTimers();
    });

    it('falls back to the read-only endpoint when reconcile fails, then keeps watching', async () => {
      vi.useFakeTimers();
      const emissions: CustomerPayment[] = [];
      service.pollUntilTerminal('b1').subscribe((p) => emissions.push(p));

      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).error(new ProgressEvent('error')); // provider timeout
      http.expectOne(url).flush([payment()]); // plain read fallback — still pending

      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).flush([payment({ status: 'FAILED' })]);

      expect(emissions).toHaveLength(1);
      expect(emissions[0].status).toBe('FAILED');
      vi.useRealTimers();
    });

    it('never emits a fake failure when both reconcile and read fail', async () => {
      vi.useFakeTimers();
      const emissions: CustomerPayment[] = [];
      service.pollUntilTerminal('b1').subscribe((p) => emissions.push(p));

      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).error(new ProgressEvent('error'));
      http.expectOne(url).error(new ProgressEvent('error'));
      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).flush([payment({ status: 'SUCCESS' })]);

      expect(emissions).toHaveLength(1);
      expect(emissions[0].status).toBe('SUCCESS');
      vi.useRealTimers();
    });

    it('is bounded: completes silently after the attempt budget is exhausted', async () => {
      vi.useFakeTimers();
      let completed = false;
      const emissions: CustomerPayment[] = [];
      service.pollUntilTerminal('b1').subscribe({
        next: (p) => emissions.push(p),
        complete: () => (completed = true),
      });

      for (let i = 0; i < 40; i++) {
        await vi.advanceTimersByTimeAsync(15_000);
        http.expectOne(reconcileUrl).flush([payment()]);
      }
      expect(emissions).toHaveLength(0);
      expect(completed).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      http.expectNone(reconcileUrl);
      http.expectNone(url);
      vi.useRealTimers();
    });

    it('stops immediately when unsubscribed', async () => {
      vi.useFakeTimers();
      const sub = service.pollUntilTerminal('b1').subscribe();
      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne(reconcileUrl).flush([payment()]);
      sub.unsubscribe();
      await vi.advanceTimersByTimeAsync(60_000);
      http.expectNone(reconcileUrl);
      http.expectNone(url);
      vi.useRealTimers();
    });
  });
});
