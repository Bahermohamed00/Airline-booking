import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { NotificationChannel, NotificationStatus } from '../../../core/models/domain.model';

/**
 * Staff operations API for notification records (GET /api/admin/notifications,
 * notifications:read). Contract owned by Developer A — do not deviate from
 * the documented query parameters, response shape, or field set.
 */

export type AdminNotificationReadFilter = 'unread' | 'read';

export interface AdminNotificationItem {
  id: string;
  type: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  content: string;
  userId: string | null;
  bookingId: string | null;
  readAt: string | null;
  attempts: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface AdminNotificationQuery {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  read?: AdminNotificationReadFilter;
  /** Exact booking FK scope (server filters; never inferred from content). */
  bookingId?: string;
}

export interface AdminNotificationPage {
  data: AdminNotificationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  list(query: AdminNotificationQuery = {}): Observable<AdminNotificationPage> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('limit', query.limit ?? 20);
    if (query.channel) params = params.set('channel', query.channel);
    if (query.status) params = params.set('status', query.status);
    if (query.read) params = params.set('read', query.read);
    if (query.bookingId) params = params.set('bookingId', query.bookingId);
    return this.http.get<AdminNotificationPage>(`${this.config.baseUrl}/admin/notifications`, {
      params,
    });
  }
}
