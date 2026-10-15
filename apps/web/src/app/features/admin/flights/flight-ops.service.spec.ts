import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FlightOpsService } from './flight-ops.service';
import { API_CONFIG } from '../../../core/config/api-config';

const API = 'http://api.test/api';

describe('FlightOpsService', () => {
  let service: FlightOpsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: API } },
      ],
    });
    service = TestBed.inject(FlightOpsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('overview() GETs /admin/flights/overview', () => {
    let result: unknown;
    service.overview().subscribe((r) => (result = r));
    const req = http.expectOne(`${API}/admin/flights/overview`);
    expect(req.request.method).toBe('GET');
    req.flush({ totalFlights: 3 });
    expect(result).toEqual({ totalFlights: 3 });
  });

  it('completed() sends search/date filters and pagination params', () => {
    service
      .completed({ search: 'FL-1024', from: '2026-10-01', to: '2026-10-07', page: 2, limit: 10 })
      .subscribe();
    const req = http.expectOne(
      (r) => r.url === `${API}/admin/flights/completed`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('FL-1024');
    expect(req.request.params.get('from')).toBe('2026-10-01');
    expect(req.request.params.get('to')).toBe('2026-10-07');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ items: [], page: 2, limit: 10, total: 0, totalPages: 1 });
  });

  it('completed() omits empty filters but always paginates', () => {
    service.completed().subscribe();
    const req = http.expectOne((r) => r.url === `${API}/admin/flights/completed`);
    expect(req.request.params.get('search')).toBeNull();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('history() sends domain/event/actor/search/date filters', () => {
    service
      .history({
        domain: 'airports',
        event: 'AIRPORT_CREATED',
        actorType: 'Staff',
        search: 'FRA',
        from: '2026-10-01',
        to: '2026-10-07',
        page: 3,
        limit: 5,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === `${API}/admin/flights/history`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('domain')).toBe('airports');
    expect(req.request.params.get('event')).toBe('AIRPORT_CREATED');
    expect(req.request.params.get('actorType')).toBe('Staff');
    expect(req.request.params.get('search')).toBe('FRA');
    expect(req.request.params.get('from')).toBe('2026-10-01');
    expect(req.request.params.get('to')).toBe('2026-10-07');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ items: [], page: 3, limit: 5, total: 0, totalPages: 1 });
  });
});
