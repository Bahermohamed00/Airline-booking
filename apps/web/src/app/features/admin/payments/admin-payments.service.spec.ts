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
    req.flush({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('listRefunds sends operational filters and pagination (3.4D)', () => {
    service
      .listRefunds({
        bookingReference: 'NVAB12',
        providerReference: 're_123',
        from: '2026-01-01T00:00:00.000Z',
        pendingMinAgeMinutes: 15,
        pendingMaxAgeMinutes: 60,
        page: 2,
        limit: 50,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === 'http://api.test/api/admin/refunds');
    const p = req.request.params;
    expect(p.get('bookingReference')).toBe('NVAB12');
    expect(p.get('providerReference')).toBe('re_123');
    expect(p.get('from')).toBe('2026-01-01T00:00:00.000Z');
    expect(p.get('pendingMinAgeMinutes')).toBe('15');
    expect(p.get('pendingMaxAgeMinutes')).toBe('60');
    expect(p.get('page')).toBe('2');
    expect(p.get('limit')).toBe('50');
    req.flush({ items: [], page: 2, limit: 50, total: 0, totalPages: 1 });
  });

  it('getRefundOperations GETs /admin/refunds/operations', () => {
    service.getRefundOperations().subscribe();
    const req = http.expectOne('http://api.test/api/admin/refunds/operations');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('resumeRefund POSTs to the existing recovery endpoint (never a new refund)', () => {
    service.resumeRefund('r1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/refunds/r1/resume');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('listOrphanRefunds GETs /admin/refunds/orphans with optional filters', () => {
    service.listOrphanRefunds({ status: 'UNMATCHED', limit: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === 'http://api.test/api/admin/refunds/orphans');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('UNMATCHED');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('resolveOrphanRefund POSTs the optional note', () => {
    service.resolveOrphanRefund('o1', 'Verified in Stripe').subscribe();
    const req = http.expectOne('http://api.test/api/admin/refunds/orphans/o1/resolve');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ note: 'Verified in Stripe' });
    req.flush({});
  });

  it('resolveOrphanRefund sends an empty body without a note', () => {
    service.resolveOrphanRefund('o1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/refunds/orphans/o1/resolve');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
