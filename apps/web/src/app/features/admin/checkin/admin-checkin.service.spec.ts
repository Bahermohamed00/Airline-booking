import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminCheckinService } from './admin-checkin.service';
import { API_CONFIG } from '../../../core/config/api-config';

describe('AdminCheckinService', () => {
  let service: AdminCheckinService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: API_CONFIG,
          useValue: {
            baseUrl: 'http://api.test/api',
            useRealApi: true,
            paymentProvider: 'mock' as const,
            stripePublishableKey: '',
          },
        },
      ],
    });
    service = TestBed.inject(AdminCheckinService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the operational list via GET /admin/checkin', () => {
    let result: unknown;
    service.operationalList().subscribe((r) => (result = r));

    const req = http.expectOne('http://api.test/api/admin/checkin');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('invalidates passes via POST /admin/checkin/:bookingId/invalidate with an empty body', () => {
    service.invalidatePasses('booking-1').subscribe();

    const req = http.expectOne('http://api.test/api/admin/checkin/booking-1/invalidate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ bookingId: 'booking-1', invalidatedCount: 2, bookingStatus: 'CONFIRMED' });
  });
});
