import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, filter, tap } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { AuthService } from './auth.service';

/**
 * Real customer notification API (Patch 1 backend). The server owns recipient
 * identity (JWT) — the client never sends user ids. Contracts:
 *   GET    /notifications              → NotificationPage (page, limit, status?)
 *   GET    /notifications/unread-count → { count }
 *   PATCH  /notifications/:id/read     → CustomerNotification (idempotent)
 *   PATCH  /notifications/read-all     → { updated }
 */

export type NotificationReadFilter = 'unread' | 'read';

export interface CustomerNotification {
  id: string;
  /** NotificationType from the backend; null for legacy/delivery rows. New
   *  types may appear over time — navigation is gated on an explicit allowlist. */
  type: string | null;
  title: string;
  content: string;
  bookingId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  status?: NotificationReadFilter;
}

export interface NotificationPage {
  data: CustomerNotification[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const NOTIFICATIONS_PAGE_SIZE = 20;
export const NOTIFICATIONS_MAX_LIMIT = 100;
export const NOTIFICATIONS_RECENT_SIZE = 5;
export const UNREAD_BADGE_CAP = 99;

/** Notification types that may navigate to the associated booking. Anything
 *  not listed renders without a navigation action — never build routes from
 *  arbitrary notification content. REFUND_REVIEW_REQUIRED is deliberately
 *  excluded: it is staff-only and carries no bookingId. */
const BOOKING_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  'BOOKING_CONFIRMED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'CANCELLATION_APPROVED',
  'CANCELLATION_REJECTED',
  'REFUND_PROCESSED',
]);

/** Allowlisted client-side navigation to the verified `/bookings/:id` route. */
export function bookingLinkFor(notification: CustomerNotification): string[] | null {
  if (
    notification.type !== null &&
    BOOKING_NOTIFICATION_TYPES.has(notification.type) &&
    notification.bookingId
  ) {
    return ['/bookings', notification.bookingId];
  }
  return null;
}

@Service()
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Poll cadence for the unread count while signed in (visible tab only). */
  static readonly POLL_INTERVAL_MS = 60_000;

  private readonly unreadCountSignal = signal(0);
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  /** True when the last unread-count load failed — the badge must signal an
   *  error instead of silently presenting a failed request as "no unread". */
  readonly unreadError = signal(false);
  readonly unreadBadge = computed(() => {
    const count = this.unreadCountSignal();
    return count > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : `${count}`;
  });

  /**
   * Mutation counter: bumped after every successful markRead/markAllRead so
   * OTHER open views (bell dropdown vs. center page) can reconcile their local
   * copies. Views track the values they originated themselves to avoid
   * redundant reloads.
   */
  private readonly mutationsSignal = signal(0);
  readonly mutations = this.mutationsSignal.asReadonly();

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;

  constructor() {
    // Session isolation: any user change (sign-in, sign-out, account switch)
    // drops the previous user's count before the new one loads, and a late
    // response from a previous session is discarded by the user-id guard.
    effect(() => {
      const user = this.auth.user();
      this.unreadCountSignal.set(0);
      this.unreadError.set(false);
      this.stopPolling();
      if (user) {
        this.refreshUnreadCount();
        this.startPolling();
      }
    });
    // Lightweight freshness without websockets: notifications created during
    // this session (e.g. a just-paid booking) surface on the next in-app
    // navigation. Root-service subscription lives for the app lifetime.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.refreshUnreadCount());
  }

  list(query: NotificationListQuery = {}): Observable<NotificationPage> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('limit', Math.min(query.limit ?? NOTIFICATIONS_PAGE_SIZE, NOTIFICATIONS_MAX_LIMIT));
    if (query.status) {
      params = params.set('status', query.status);
    }
    return this.http.get<NotificationPage>(`${this.config.baseUrl}/notifications`, { params });
  }

  refreshUnreadCount(): void {
    const forUserId = this.auth.user()?.id;
    if (!forUserId) {
      return;
    }
    this.http
      .get<{ count: number }>(`${this.config.baseUrl}/notifications/unread-count`)
      .subscribe({
        next: (res) => {
          if (this.auth.user()?.id === forUserId) {
            this.unreadCountSignal.set(res.count);
            this.unreadError.set(false);
          }
        },
        // Surface the failure (badge shows an error state) — a failed count
        // request must never masquerade as "no unread notifications".
        error: () => this.unreadError.set(true),
      });
  }

  /**
   * Marks one notification as read. Call only for items that are currently
   * unread (the UI contract — the action is only offered on unread items), so
   * the local count stays exact without an extra round-trip.
   */
  markRead(id: string): Observable<CustomerNotification> {
    return this.http
      .patch<CustomerNotification>(`${this.config.baseUrl}/notifications/${id}/read`, {})
      .pipe(
        tap(() => {
          this.unreadCountSignal.update((c) => Math.max(0, c - 1));
          this.mutationsSignal.update((v) => v + 1);
        }),
      );
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.http
      .patch<{ updated: number }>(`${this.config.baseUrl}/notifications/read-all`, {})
      .pipe(
        tap(() => {
          this.unreadCountSignal.set(0);
          this.mutationsSignal.update((v) => v + 1);
        }),
      );
  }

  // ---------- Polling (single interval, visible tab, single-flight) ----------

  private startPolling(): void {
    this.pollTimer = setInterval(() => this.pollTick(), NotificationService.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.pollInFlight = false;
  }

  /**
   * Poll tick: skips hidden tabs and never overlaps itself. Poll failures only
   * flag the badge error state — they never clear a previously good count.
   */
  private pollTick(): void {
    if (this.pollInFlight) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const forUserId = this.auth.user()?.id;
    if (!forUserId) return;
    this.pollInFlight = true;
    this.http
      .get<{ count: number }>(`${this.config.baseUrl}/notifications/unread-count`)
      .subscribe({
        next: (res) => {
          this.pollInFlight = false;
          if (this.auth.user()?.id === forUserId) {
            this.unreadCountSignal.set(res.count);
            this.unreadError.set(false);
          }
        },
        error: () => {
          this.pollInFlight = false;
          this.unreadError.set(true);
        },
      });
  }
}
