import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { OffersService, type OfferInput } from './offers.service';
import { API_CONFIG } from '../config/api-config';

const INPUT: OfferInput = {
  title: 'Winter Sun Escapes',
  description: 'Warm-weather getaways from Frankfurt this winter.',
  badge: 'Winter sun',
  destination: 'Frankfurt → Dubai',
  offerValue: 'from €349',
  imageUrl: 'assets/img/dest-dubai.jpg',
  status: 'ACTIVE',
  validFrom: '2026-11-01',
  validUntil: '2027-02-28',
};

describe('OffersService', () => {
  let service: OffersService;
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
    service = TestBed.inject(OffersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listPublic GETs /offers', () => {
    let result: unknown;
    service.listPublic().subscribe((r) => (result = r));

    const req = http.expectOne('http://api.test/api/offers');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('getPublic GETs /offers/:id', () => {
    service.getPublic('offer-1').subscribe();

    const req = http.expectOne('http://api.test/api/offers/offer-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('listAdmin GETs /admin/offers without params when no status is given', () => {
    service.listAdmin().subscribe();

    const req = http.expectOne('http://api.test/api/admin/offers');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([]);
  });

  it('listAdmin passes the status filter as a query param', () => {
    service.listAdmin('ACTIVE').subscribe();

    const req = http.expectOne('http://api.test/api/admin/offers?status=ACTIVE');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    req.flush([]);
  });

  it('createAdmin POSTs the payload to /admin/offers', () => {
    service.createAdmin(INPUT).subscribe();

    const req = http.expectOne('http://api.test/api/admin/offers');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(INPUT);
    req.flush({});
  });

  it('updateAdmin PATCHes /admin/offers/:id', () => {
    service.updateAdmin('offer-1', { status: 'INACTIVE' }).subscribe();

    const req = http.expectOne('http://api.test/api/admin/offers/offer-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush({});
  });

  it('deleteAdmin DELETEs /admin/offers/:id', () => {
    service.deleteAdmin('offer-1').subscribe();

    const req = http.expectOne('http://api.test/api/admin/offers/offer-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
