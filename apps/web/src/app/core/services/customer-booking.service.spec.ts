import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CustomerBookingService } from './customer-booking.service';
import type { CreateBookingPayload } from '../models/customer-booking.model';
import { API_CONFIG } from '../config/api-config';

const PAYLOAD: CreateBookingPayload = {
  idempotencyKey: 'b1c2d3e4-1111-4222-8333-944455556666',
  flightId: 'f1',
  cabinClass: 'ECONOMY',
  seatIds: ['s1', 's2'],
  passengers: [
    {
      passengerType: 'ADULT',
      firstName: 'Lena',
      lastName: 'Hoffmann',
      dateOfBirth: '1990-05-12',
      nationality: 'DE',
      passportNumber: 'C01X00T47',
    },
    { passengerType: 'CHILD', firstName: 'Jonas', lastName: 'Hoffmann' },
  ],
  contactEmail: 'lena@example.com',
  contactPhone: '+49 170 1234567',
};

describe('CustomerBookingService', () => {
  let service: CustomerBookingService;
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
    service = TestBed.inject(CustomerBookingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create POSTs exactly the DTO payload to /bookings', () => {
    let response: unknown;
    service.create(PAYLOAD).subscribe((r) => (response = r));

    const req = http.expectOne('http://api.test/api/bookings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(PAYLOAD);
    // Server-owned fields must never be client-supplied.
    for (const key of [
      'userId',
      'status',
      'totalAmount',
      'bookingReference',
      'payments',
      'paymentReference',
      'flightSegmentId',
    ]) {
      expect(req.request.body).not.toHaveProperty(key);
    }
    req.flush({ id: 'b1', bookingReference: 'NVABC1', status: 'PENDING' });
    expect((response as { bookingReference: string }).bookingReference).toBe('NVABC1');
  });

  it('myBookings GETs /bookings (owner-scoped server-side)', () => {
    service.myBookings().subscribe();
    const req = http.expectOne('http://api.test/api/bookings');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getById GETs /bookings/:id', () => {
    service.getById('b1').subscribe();
    const req = http.expectOne('http://api.test/api/bookings/b1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('cancel POSTs to /bookings/:id/cancel with an empty body', () => {
    service.cancel('b1').subscribe();
    const req = http.expectOne('http://api.test/api/bookings/b1/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('requestCancellation POSTs to /bookings/:id/cancellation-request with an empty body when no reason', () => {
    let response: { id?: string; status?: string } | undefined;
    service.requestCancellation('b1').subscribe((r) => (response = r));
    const req = http.expectOne('http://api.test/api/bookings/b1/cancellation-request');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      id: 'cr-1',
      bookingId: 'b1',
      status: 'PENDING',
      reason: null,
      requestedAt: '2026-10-01T09:00:00Z',
    });
    expect(response?.status).toBe('PENDING');
  });

  it('requestCancellation sends the reason when provided', () => {
    service.requestCancellation('b1', 'Plans changed').subscribe();
    const req = http.expectOne('http://api.test/api/bookings/b1/cancellation-request');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Plans changed' });
    req.flush({});
  });

  it('listAdmin GETs /admin/bookings with no params when the query is empty', () => {
    service.listAdmin().subscribe();
    const req = http.expectOne('http://api.test/api/admin/bookings');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('listAdmin omits undefined query params', () => {
    service.listAdmin({ reference: 'NVABC1', status: undefined, email: undefined }).subscribe();
    const req = http.expectOne('http://api.test/api/admin/bookings?reference=NVABC1');
    expect(req.request.params.get('reference')).toBe('NVABC1');
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('email')).toBe(false);
    req.flush([]);
  });

  it('listAdmin sends reference, status and email when provided', () => {
    service
      .listAdmin({ reference: 'NVABC1', status: 'PENDING', email: 'lena@example.com' })
      .subscribe();
    const req = http.expectOne((r) => r.url === 'http://api.test/api/admin/bookings');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('reference')).toBe('NVABC1');
    expect(req.request.params.get('status')).toBe('PENDING');
    expect(req.request.params.get('email')).toBe('lena@example.com');
    req.flush([]);
  });

  it('getAdmin GETs /admin/bookings/:id', () => {
    service.getAdmin('b1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/bookings/b1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('pricePreview POSTs the request to /bookings/price-preview', () => {
    let response: unknown;
    service
      .pricePreview({ flightId: 'f1', cabinClass: 'ECONOMY', passengerCount: 2, offerId: 'offer-9' })
      .subscribe((r) => (response = r));

    const req = http.expectOne('http://api.test/api/bookings/price-preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      flightId: 'f1',
      cabinClass: 'ECONOMY',
      passengerCount: 2,
      offerId: 'offer-9',
    });
    req.flush({
      currency: 'EUR',
      perPassenger: { basePrice: 100, discountAmount: 10, taxAmount: 20, feeAmount: 5, total: 115 },
      passengerCount: 2,
      totalAmount: 230,
      offer: null,
    });
    expect((response as { totalAmount: number }).totalAmount).toBe(230);
  });

  it('pricePreview omits offerId when not provided', () => {
    service.pricePreview({ flightId: 'f1', cabinClass: 'BUSINESS', passengerCount: 1 }).subscribe();

    const req = http.expectOne('http://api.test/api/bookings/price-preview');
    expect(req.request.body).not.toHaveProperty('offerId');
    req.flush({});
  });

  it('adminCancel POSTs to /admin/bookings/:id/cancel, omitting reason when undefined', () => {
    service.adminCancel('b1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/bookings/b1/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('adminCancel sends the reason when provided', () => {
    service.adminCancel('b1', 'Schedule change').subscribe();
    const req = http.expectOne('http://api.test/api/admin/bookings/b1/cancel');
    expect(req.request.body).toEqual({ reason: 'Schedule change' });
    req.flush({});
  });

  it('adminConfirmException POSTs the reason to /admin/bookings/:id/confirm-exception', () => {
    service.adminConfirmException('b1', 'Payment provider outage').subscribe();
    const req = http.expectOne('http://api.test/api/admin/bookings/b1/confirm-exception');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Payment provider outage' });
    req.flush({});
  });
});
