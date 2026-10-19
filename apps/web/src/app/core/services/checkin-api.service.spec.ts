import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CheckInApiService } from './checkin-api.service';
import { API_CONFIG } from '../config/api-config';

describe('CheckInApiService', () => {
  let service: CheckInApiService;
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
    service = TestBed.inject(CheckInApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lookupByReference GETs /checkin/bookings with an uppercased reference param only', () => {
    service.lookupByReference('  ab12cd ').subscribe();
    const req = http.expectOne('http://api.test/api/checkin/bookings?reference=AB12CD');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('email')).toBe(false);
    req.flush([]);
  });

  it('lookupByEmail GETs /checkin/bookings with a trimmed email param only', () => {
    service.lookupByEmail('  aya@example.com ').subscribe();
    const req = http.expectOne('http://api.test/api/checkin/bookings?email=aya@example.com');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('reference')).toBe(false);
    req.flush([]);
  });

  it('checkIn POSTs bookingId and bookingPassengerId to /checkin', () => {
    let result: unknown;
    service.checkIn('bk-1', 'bp-1').subscribe((r) => (result = r));
    const req = http.expectOne('http://api.test/api/checkin');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ bookingId: 'bk-1', bookingPassengerId: 'bp-1' });
    const payload = {
      checkIns: [
        {
          id: 'ci-1',
          bookingPassengerId: 'bp-1',
          flightSegmentId: 'seg-1',
          checkInTime: '2026-09-30T10:00:00Z',
          status: 'COMPLETED',
          boardingPass: {
            id: 'pass-1',
            boardingGroup: 'B',
            seatNumber: '12A',
            gate: null,
            issuedAt: '2026-09-30T10:00:00Z',
          },
        },
      ],
      bookingStatus: 'CHECKED_IN',
    };
    req.flush(payload);
    expect(result).toEqual(payload);
  });

  it('boardingPass GETs /checkin/boarding-pass with the bookingId param', () => {
    service.boardingPass('bk-1').subscribe();
    const req = http.expectOne('http://api.test/api/checkin/boarding-pass?bookingId=bk-1');
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('propagates Nest error bodies untouched (err.error.code)', () => {
    let failure: unknown;
    service.checkIn('bk-1', 'bp-1').subscribe({ error: (e) => (failure = e) });
    http
      .expectOne('http://api.test/api/checkin')
      .flush(
        { code: 'CHECKIN_NOT_OPEN', message: 'Not open' },
        { status: 409, statusText: 'Conflict' },
      );
    expect((failure as { error: { code: string } }).error.code).toBe('CHECKIN_NOT_OPEN');
  });
});
