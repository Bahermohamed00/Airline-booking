import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminPaymentsService } from './admin-payments.service';
import { API_CONFIG } from '../../../core/config/api-config';

describe('AdminPaymentsService', () => {
  let service: AdminPaymentsService;
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
    service = TestBed.inject(AdminPaymentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listPayments GETs /admin/payments with no params when the query is empty', () => {
    service.listPayments().subscribe();
    const req = http.expectOne('http://api.test/api/admin/payments');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('listPayments omits undefined filters and sends the provided ones', () => {
    service
      .listPayments({
        status: 'SUCCESS',
        reference: 'NVABC1',
        bookingId: undefined,
        from: '2026-01-01',
        to: undefined,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === 'http://api.test/api/admin/payments');
    expect(req.request.params.get('status')).toBe('SUCCESS');
    expect(req.request.params.get('reference')).toBe('NVABC1');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.has('bookingId')).toBe(false);
    expect(req.request.params.has('to')).toBe(false);
    req.flush([]);
  });

  it('getPayment GETs /admin/payments/:id', () => {
    service.getPayment('p1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/payments/p1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('refund POSTs the payload to /admin/payments/:id/refund', () => {
    service.refund('p1', { amount: 50, reason: 'Goodwill' }).subscribe();
    const req = http.expectOne('http://api.test/api/admin/payments/p1/refund');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 50, reason: 'Goodwill' });
    req.flush({});
  });

  it('listRefunds GETs /admin/refunds with optional filters', () => {
    service.listRefunds({ status: 'PROCESSED', bookingId: 'b1' }).subscribe();
    const req = http.expectOne((r) => r.url === 'http://api.test/api/admin/refunds');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PROCESSED');
    expect(req.request.params.get('bookingId')).toBe('b1');
    req.flush([]);
  });
});
