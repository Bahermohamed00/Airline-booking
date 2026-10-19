import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  NotificationService,
  NOTIFICATIONS_RECENT_SIZE,
  bookingLinkFor,
  type CustomerNotification,
} from '../../../core/services/notification.service';
import { ToastService } from '../../../shared/ui/toast.service';

/**
 * Topbar notification bell: unread badge (capped at 99+) and a bounded
 * dropdown of recent notifications. Loads on open and after user actions —
 * deliberately no polling or real-time infrastructure.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="bell" (keydown.escape)="close()">
      <button
        type="button"
        class="bell__btn"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="true"
        [attr.aria-label]="
          unreadError()
            ? 'Notifications failed to load — open to retry'
            : unreadCount() > 0
              ? 'Notifications, ' + unreadCount() + ' unread'
              : 'Notifications'
        "
      >
        <span class="bell__icon" aria-hidden="true">🔔</span>
        @if (unreadError()) {
          <span class="bell__badge bell__badge--error" aria-hidden="true">!</span>
        } @else if (unreadCount() > 0) {
          <span class="bell__badge" aria-hidden="true">{{ badge() }}</span>
        }
      </button>

      @if (open()) {
        <div class="bell__panel" role="region" aria-label="Recent notifications">
          <div class="bell__header">
            <span class="bell__title">Notifications</span>
            <a routerLink="/notifications" class="bell__all" (click)="close()">View all</a>
          </div>

          @if (loading()) {
            <p class="bell__state" role="status">Loading…</p>
          } @else if (loadError()) {
            <div class="bell__state" role="alert">
              <p>Could not load notifications.</p>
              <button type="button" class="bell__retry" (click)="loadRecent()">Retry</button>
            </div>
          } @else if (recent().length === 0) {
            <p class="bell__state" role="status">You're all caught up.</p>
          } @else {
            <ul class="bell__list">
              @for (item of recent(); track item.id) {
                <li>
                  <button
                    type="button"
                    class="bell__item"
                    [class.bell__item--unread]="!item.readAt"
                    (click)="activate(item)"
                  >
                    <span class="bell__item-head">
                      <span class="bell__item-title">{{ item.title }}</span>
                      @if (!item.readAt) {
                        <span class="bell__dot" aria-label="Unread"></span>
                      }
                    </span>
                    <span class="bell__item-content">{{ item.content }}</span>
                    <span class="bell__item-date">{{ item.createdAt | date: 'd MMM y, HH:mm' }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .bell { position: relative; }
    .bell__btn {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border: none; border-radius: var(--na-radius-md);
      background: var(--na-navy-600); cursor: pointer; font-size: 1rem;
    }
    .bell__btn:hover { background: var(--na-navy-500, var(--na-navy-600)); }
    .bell__badge {
      position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px;
      padding: 0 4px; border-radius: 999px; background: var(--na-cta); color: var(--na-cta-contrast);
      font-size: 0.6875rem; font-weight: var(--na-font-bold); line-height: 18px; text-align: center;
    }
    .bell__badge--error { background: var(--na-danger, #c0392b); color: #fff; }
    .bell__panel {
      position: absolute; right: 0; top: calc(100% + 6px); width: 340px; max-width: calc(100vw - 32px);
      background: var(--na-surface-raised); border: 1px solid var(--na-border);
      border-radius: var(--na-radius-md); box-shadow: var(--na-shadow-md); z-index: 70;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .bell__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border);
    }
    .bell__title { font-weight: var(--na-font-semibold); font-size: var(--na-text-sm); }
    .bell__all { font-size: var(--na-text-sm); }
    .bell__state { padding: var(--na-space-6) var(--na-space-4); text-align: center; color: var(--na-ink-300); font-size: var(--na-text-sm); }
    .bell__retry { margin-top: var(--na-space-2); min-height: 40px; padding: 0 var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-md); background: none; cursor: pointer; }
    .bell__list { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; }
    .bell__item {
      display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left;
      padding: var(--na-space-3) var(--na-space-4); border: none; border-bottom: 1px solid var(--na-border);
      background: none; cursor: pointer; min-height: 40px;
    }
    .bell__item:hover { background: var(--na-blue-100); }
    .bell__item--unread { background: var(--na-blue-50, var(--na-blue-100)); }
    .bell__item-head { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-2); }
    .bell__item-title { font-weight: var(--na-font-medium); font-size: var(--na-text-sm); }
    .bell__item--unread .bell__item-title { font-weight: var(--na-font-bold); }
    .bell__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--na-cta); flex: none; }
    .bell__item-content { font-size: var(--na-text-sm); color: var(--na-ink-300); }
    .bell__item-date { font-size: var(--na-text-xs); color: var(--na-ink-300); }
  `,
})
export class NotificationBellComponent {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly unreadCount = this.notifications.unreadCount;
  readonly unreadError = this.notifications.unreadError;
  readonly badge = this.notifications.unreadBadge;

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly recent = signal<CustomerNotification[]>([]);

  /** Mutations this bell originated (its own mark-as-read applies locally). */
  private seenMutations = 0;

  constructor() {
    this.seenMutations = this.notifications.mutations();
    // Another view (the open center page, another tab) marked something read
    // while this dropdown is open — resync the visible list.
    effect(() => {
      const v = this.notifications.mutations();
      if (v === this.seenMutations) return;
      this.seenMutations = v;
      if (this.open()) this.loadRecent();
    });
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      this.loadRecent();
    }
  }

  close(): void {
    this.open.set(false);
  }

  loadRecent(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.notifications.list({ page: 1, limit: NOTIFICATIONS_RECENT_SIZE }).subscribe({
      next: (page) => {
        this.recent.set(page.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
    this.notifications.refreshUnreadCount();
  }

  /** Click marks an unread item read (best-effort) and navigates only via the
   *  allowlisted booking link, when one exists. */
  activate(item: CustomerNotification): void {
    if (!item.readAt) {
      this.notifications.markRead(item.id).subscribe({
        next: (updated) => {
          // Locally originated mutation — apply it here and don't reload.
          this.seenMutations = this.notifications.mutations();
          this.recent.update((items) => items.map((i) => (i.id === updated.id ? updated : i)));
        },
        error: () => this.toast.error('Could not mark the notification as read.'),
      });
    }
    const link = bookingLinkFor(item);
    if (link) {
      this.close();
      void this.router.navigate(link);
    }
  }
}
