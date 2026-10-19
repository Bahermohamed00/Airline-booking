import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminBaggageService } from './admin-baggage.service';
import { API_CONFIG } from '../../../core/config/api-config';

describe('AdminBaggageService', () => {
  let service: AdminBaggageService;
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
    service = TestBed.inject(AdminBaggageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists baggage via GET /admin/baggage', () => {
    let result: unknown;
    service.adminList().subscribe((r) => (result = r));

    const req = http.expectOne('http://api.test/api/admin/baggage');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('records an event via POST /admin/baggage/:id/events with the status event and location', () => {
    service.recordEvent('bag-1', 'DELIVERED', 'JFK Baggage Services').subscribe();

    const req = http.expectOne('http://api.test/api/admin/baggage/bag-1/events');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      eventType: 'DELIVERED',
      location: 'JFK Baggage Services',
    });
    req.flush({});
  });
});
