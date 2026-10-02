import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import {
  mapApiScheduleRule,
  type ApiScheduleRule,
  type CreateScheduleRulePayload,
  type GenerationSummary,
  type ScheduleRule,
  type UpdateScheduleRulePayload,
} from '../models/schedule-rule-api.model';

/**
 * Thin typed wrapper over the schedule-rules REST API plus the flights
 * generation endpoint. No UI state — the backend stays authoritative.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleRulesService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  listRules(): Observable<ScheduleRule[]> {
    return this.http
      .get<ApiScheduleRule[]>(`${this.config.baseUrl}/schedule-rules`)
      .pipe(map((list) => list.map(mapApiScheduleRule)));
  }

  getRule(id: string): Observable<ScheduleRule> {
    return this.http
      .get<ApiScheduleRule>(`${this.config.baseUrl}/schedule-rules/${id}`)
      .pipe(map(mapApiScheduleRule));
  }

  createRule(payload: CreateScheduleRulePayload): Observable<ScheduleRule> {
    return this.http
      .post<ApiScheduleRule>(`${this.config.baseUrl}/schedule-rules`, payload)
      .pipe(map(mapApiScheduleRule));
  }

  updateRule(id: string, payload: UpdateScheduleRulePayload): Observable<ScheduleRule> {
    return this.http
      .patch<ApiScheduleRule>(`${this.config.baseUrl}/schedule-rules/${id}`, payload)
      .pipe(map(mapApiScheduleRule));
  }

  /** Idempotent generation of flights from ACTIVE schedule rules over a date range. */
  generateFlights(from: string, to: string): Observable<GenerationSummary> {
    return this.http.post<GenerationSummary>(`${this.config.baseUrl}/flights/generate`, {
      from,
      to,
    });
  }
}
