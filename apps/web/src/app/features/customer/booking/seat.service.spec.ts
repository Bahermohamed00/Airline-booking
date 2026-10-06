import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SeatService } from './seat.service';
import { API_CONFIG } from '../../../core/config/api-config';

describe('SeatService', () => {
  let service: SeatService;
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
    service = TestBed.inject(SeatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('seatCatalog GETs /aircraft/:id/seats', () => {
    service.seatCatalog('ac1').subscribe();
    const req = http.expectOne('http://api.test/api/aircraft/ac1/seats');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('seatAvailability GETs /flights/:id/seat-availability and returns occupied/held ids', () => {
    let result: unknown;
    service.seatAvailability('f1').subscribe((r) => (result = r));

    const req = http.expectOne('http://api.test/api/flights/f1/seat-availability');
    expect(req.request.method).toBe('GET');
    req.flush({ flightId: 'f1', occupiedSeatIds: ['s1'], heldSeatIds: ['s2'] });
    expect(result).toEqual({ flightId: 'f1', occupiedSeatIds: ['s1'], heldSeatIds: ['s2'] });
  });
});
