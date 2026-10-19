import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  CancellationRequestsService,
  type AdminCancellationRequest,
} from './cancellation-requests.service';
import { API_CONFIG } from '../config/api-config';

const BASE = 'http://api.test/api/admin/cancellation-requests';

function request(partial: Partial<AdminCancellationRequest> = {}): AdminCancellationRequest {
  return {
    id: 'cr-1',
    status: 'PENDING',
    reason: 'Plans changed',
    requestedAt: '2026-10-01T09:00:00Z',
    reviewedAt: null,
    rejectionReason: null,
    booking: {
      id: 'b1',
      bookingReference: 'NVA7K2',
      status: 'CONFIRMED',
      totalAmount: 289.5,
      currency: 'EUR',
      bookedAt: '2026-09-20T10:15:00Z',
    },
    customer: { firstName: 'Aya', lastName: 'Mansour', email: 'aya@example.com' },
    flight: {
      flightNumber: 'LH101',
      originIata: 'FRA',
      destinationIata: 'LHR',
      departureTime: '2027-01-10T09:30:00Z',
    },
    payment: { amount: 289.5, currency: 'EUR', status: 'SUCCESS' },
    policy: { refundPercentage: 80, refundableAmount: 231.6, currency: 'EUR' },
    refund: null,
    ...partial,
  };
}

describe('CancellationRequestsService', () => {
  let service: CancellationRequestsService;
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
    service = TestBed.inject(CancellationRequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list GETs /admin/cancellation-requests with no params when no status filter', () => {
    service.list().subscribe();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('list sends the status filter when provided', () => {
    let response: AdminCancellationRequest[] | undefined;
    service.list('PENDING').subscribe((r) => (response = r));
    const req = http.expectOne(`${BASE}?status=PENDING`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PENDING');
    req.flush([request()]);
    expect(response?.[0]?.booking.bookingReference).toBe('NVA7K2');
  });

  it('approve POSTs an empty body to /admin/cancellation-requests/:id/approve', () => {
    let response: AdminCancellationRequest | undefined;
    service.approve('cr-1').subscribe((r) => (response = r));
    const req = http.expectOne(`${BASE}/cr-1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(request({ status: 'APPROVED', reviewedAt: '2026-10-02T08:00:00Z' }));
    expect(response?.status).toBe('APPROVED');
  });

  it('reject omits rejectionReason when not provided', () => {
    service.reject('cr-1').subscribe();
    const req = http.expectOne(`${BASE}/cr-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(request({ status: 'REJECTED' }));
  });

  it('reject sends rejectionReason when provided', () => {
    service.reject('cr-1', 'Fare rules do not allow a refund after check-in.').subscribe();
    const req = http.expectOne(`${BASE}/cr-1/reject`);
    expect(req.request.body).toEqual({
      rejectionReason: 'Fare rules do not allow a refund after check-in.',
    });
    req.flush(request({ status: 'REJECTED', rejectionReason: 'Fare rules do not allow a refund after check-in.' }));
  });
});
