import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';

export interface AuditLogItem {
  id: string;
  event: string;
  actorType: string;
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO
  metadata: Record<string, unknown>;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  event?: string;
  actorId?: string;
  targetId?: string;
  actorType?: string;
  targetType?: string;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: 'createdAt' | 'event';
  sortOrder?: 'asc' | 'desc';
}

/** Mirror of the backend catalog (apps/api/src/audit/audit-events.ts) for the filter dropdown. */
export const AUDIT_EVENTS = [
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'LOGIN_FAILED',
  'LOGOUT',
  'LOGOUT_ALL',
  'SESSION_REVOKED',
  'TOKEN_REUSE_DETECTED',
  'EMAIL_VERIFICATION_REQUESTED',
  'EMAIL_VERIFICATION_FAILED',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_FAILED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'PASSWORD_CHANGE_FAILED',
  'PROFILE_UPDATED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'AUTH_RATE_LIMITED',
  'SUPER_ADMIN_INVARIANT_BLOCKED',
] as const;

const MOCK_PAGE: AuditLogPage = {
  items: [
    {
      id: 'mock-1',
      event: 'USER_LOGGED_IN',
      actorType: 'User',
      actorId: 'demo-user',
      targetType: 'User',
      targetId: 'demo-user',
      ipAddress: '203.0.113.10',
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: 'mock-2',
      event: 'TOKEN_REUSE_DETECTED',
      actorType: 'User',
      actorId: 'demo-user',
      targetType: 'Session',
      targetId: 'demo-session',
      ipAddress: '203.0.113.11',
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      metadata: {},
    },
  ],
  page: 1,
  limit: 20,
  total: 2,
  totalPages: 1,
};

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  /** Paginated audit query. Mock branch returns development-only demo data. */
  listLogs(params: AuditQueryParams = {}): Observable<AuditLogPage> {
    if (!this.config.useRealApi) {
      return of(MOCK_PAGE).pipe(delay(300));
    }
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<AuditLogPage>(`${this.config.baseUrl}/audit`, { params: httpParams });
  }
}
