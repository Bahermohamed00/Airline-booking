import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ScheduleRulesService } from './schedule-rules.service';
import { API_CONFIG } from '../../../core/config/api-config';
import type {
  ApiScheduleRule,
  CreateScheduleRulePayload,
  GenerationSummary,
  ScheduleRule,
} from './schedule-rule-api.model';

const BASE = 'http://api.test/api';

function apiRule(partial: Partial<ApiScheduleRule> = {}): ApiScheduleRule {
  return {
    id: '9b1d4c2e-0000-4000-8000-0000000000aa',
    flightNumber: 'NV720',
    routeId: '9b1d4c2e-0000-4000-8000-000000000001',
    aircraftId: '9b1d4c2e-0000-4000-8000-000000000002',
    departureTimeLocal: '08:45',
    operatingDays: ['MON', 'WED', 'FRI'],
    effectiveFrom: '2026-03-01',
    effectiveTo: '2026-10-31',
    status: 'ACTIVE',
    route: {
      id: '9b1d4c2e-0000-4000-8000-000000000001',
      originAirportId: 'a1',
      destinationAirportId: 'a2',
      distanceKm: 950,
      durationMinutes: 120,
      status: 'ACTIVE',
      originAirport: {
        id: 'a1',
        iataCode: 'FRA',
        icaoCode: 'EDDF',
        name: 'Frankfurt',
        city: 'Frankfurt',
        country: 'DE',
        timezone: 'Europe/Berlin',
        latitude: 50.03,
        longitude: 8.56,
        status: 'ACTIVE',
      },
      destinationAirport: {
        id: 'a2',
        iataCode: 'LHR',
        icaoCode: 'EGLL',
        name: 'Heathrow',
        city: 'London',
        country: 'GB',
        timezone: 'Europe/London',
        latitude: 51.47,
        longitude: -0.45,
        status: 'ACTIVE',
      },
    },
    aircraft: {
      id: '9b1d4c2e-0000-4000-8000-000000000002',
      registration: 'NV-738Z',
      model: 'Boeing 737-800',
      capacity: 180,
      status: 'ACTIVE',
    },
    ...partial,
  };
}

describe('ScheduleRulesService', () => {
  let service: ScheduleRulesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: BASE, useRealApi: true } },
      ],
    });
    service = TestBed.inject(ScheduleRulesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listRules GETs /schedule-rules and flattens the nested route and aircraft', () => {
    let result: ScheduleRule[] | undefined;
    service.listRules().subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE}/schedule-rules`);
    expect(req.request.method).toBe('GET');
    req.flush([apiRule()]);

    expect(result).toHaveLength(1);
    const rule = result![0]!;
    expect(rule.id).toBe('9b1d4c2e-0000-4000-8000-0000000000aa');
    expect(rule.flightNumber).toBe('NV720');
    expect(rule.originIata).toBe('FRA');
    expect(rule.destinationIata).toBe('LHR');
    expect(rule.aircraftRegistration).toBe('NV-738Z');
    expect(rule.departureTimeLocal).toBe('08:45');
    expect(rule.operatingDays).toEqual(['MON', 'WED', 'FRI']);
    expect(rule.status).toBe('ACTIVE');
  });

  it('getRule GETs /schedule-rules/:id and maps it', () => {
    let result: ScheduleRule | undefined;
    service.getRule('rule-1').subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE}/schedule-rules/rule-1`);
    expect(req.request.method).toBe('GET');
    req.flush(apiRule({ id: 'rule-1', flightNumber: 'NV101' }));

    expect(result?.id).toBe('rule-1');
    expect(result?.flightNumber).toBe('NV101');
    expect(result?.originIata).toBe('FRA');
  });

  it('createRule POSTs the exact DTO to /schedule-rules and maps the response', () => {
    const payload: CreateScheduleRulePayload = {
      routeId: '9b1d4c2e-0000-4000-8000-000000000001',
      aircraftId: '9b1d4c2e-0000-4000-8000-000000000002',
      flightNumber: 'NV720',
      departureTimeLocal: '08:45',
      operatingDays: ['MON', 'WED', 'FRI'],
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-10-31',
    };
    let result: ScheduleRule | undefined;
    service.createRule(payload).subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE}/schedule-rules`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(apiRule());

    expect(result?.flightNumber).toBe('NV720');
    expect(result?.destinationIata).toBe('LHR');
  });

  it('updateRule PATCHes only the given fields to /schedule-rules/:id', () => {
    let result: ScheduleRule | undefined;
    service.updateRule('rule-1', { status: 'INACTIVE' }).subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE}/schedule-rules/rule-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush(apiRule({ id: 'rule-1', status: 'INACTIVE' }));

    expect(result?.status).toBe('INACTIVE');
  });

  it('generateFlights POSTs {from, to} to /flights/generate and returns the summary verbatim', () => {
    const summary: GenerationSummary = {
      rulesEvaluated: 3,
      operatingDates: 40,
      flightsCreated: 38,
      flightsUpdated: 2,
      segmentsCreated: 38,
      segmentsUpdated: 2,
      faresCreated: 76,
      faresUpdated: 4,
      skippedRules: [{ flightNumber: 'NV999', reason: 'route has no durationMinutes' }],
    };
    let result: GenerationSummary | undefined;
    service.generateFlights('2026-03-01', '2026-04-30').subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE}/flights/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ from: '2026-03-01', to: '2026-04-30' });
    req.flush(summary);

    expect(result).toEqual(summary);
  });
});
