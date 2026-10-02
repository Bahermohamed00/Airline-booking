import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PaymentService } from './payment.service';
import { API_CONFIG } from '../config/api-config';

describe('PaymentService', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/api', useRealApi: true } },
      ],
    });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pay POSTs the token and idempotency key to /bookings/:id/payment', () => {
    let response: unknown;
    service.pay('b1', { token: 'tok_abc', idempotencyKey: 'key-1' }).subscribe((r) => (response = r));

    const req = http.expectOne('http://api.test/api/bookings/b1/payment');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok_abc', idempotencyKey: 'key-1' });
    // Raw card data must never be sent.
    expect(req.request.body).not.toHaveProperty('cardNumber');
    expect(req.request.body).not.toHaveProperty('cvv');
    req.flush({ payment: { id: 'p1' }, booking: { id: 'b1', status: 'CONFIRMED' } });
    expect((response as { booking: { status: string } }).booking.status).toBe('CONFIRMED');
  });

  it('getPayments GETs /bookings/:id/payments', () => {
    service.getPayments('b1').subscribe();
    const req = http.expectOne('http://api.test/api/bookings/b1/payments');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('tokenize returns a provider token synchronously without any HTTP call', () => {
    let token = '';
    service.tokenize().subscribe((t) => (token = t));

    expect(token).toMatch(/^tok_[0-9a-f]{32}$/);
    http.expectNone(() => true);
  });
});
