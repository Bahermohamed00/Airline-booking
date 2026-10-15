import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NotificationService,
  NOTIFICATIONS_PAGE_SIZE,
  bookingLinkFor,
  type CustomerNotification,
  type NotificationReadFilter,
} from '../../../core/services/notification.service';
import { ToastService } from '../../../shared/ui/toast.service';

type Filter = 'all' | NotificationReadFilter;

/**
 * Full customer notification inbox (/notifications). Paginated newest-first
 * (backend ordering), mark-one/mark-all read, and allowlisted booking
 * navigation. State loads on init and refreshes after successful mutations —
 * no polling.
 */
@Component({
  selector: 'app-notification-center',
  imports: [RouterLink, DatePipe],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.css',
})
export class NotificationCenterPage {
  private readonly notifications = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<CustomerNotification[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly total = signal(0);
  readonly filter = signal<Filter>('all');
  readonly markingIds = signal<ReadonlySet<string>>(new Set());
  readonly markingAll = signal(false);

  readonly unreadCount = this.notifications.unreadCount;
  readonly linkFor = bookingLinkFor;

  /**
   * Mutation values this page originated itself — external mutations (bell
   * dropdown, another tab view) reload the list; own mutations are already
   * applied locally, so no redundant request is made for them.
   */
  private seenMutations = 0;

  constructor() {
    this.seenMutations = this.notifications.mutations();
    this.load();

    // Reconcile when another view mutates notifications while this page is open.
    effect(() => {
      const v = this.notifications.mutations();
      if (v === this.seenMutations) return;
      this.seenMutations = v;
      this.load();
    });

    // Same-route revisit (e.g. the bell's "View all" while already on
    // /notifications does not recreate the component) must still refresh.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        if (e.urlAfterRedirects.startsWith('/notifications')) this.load();
      });
  }

  setFilter(filter: Filter): void {
    if (this.filter() === filter) {
      return;
    }
    this.filter.set(filter);
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const filter = this.filter();
    const status: NotificationReadFilter | undefined = filter === 'all' ? undefined : filter;
    this.notifications
      .list({ page: this.page(), limit: NOTIFICATIONS_PAGE_SIZE, status })
      .subscribe({
        next: (res) => {
          this.items.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(Math.max(1, res.totalPages));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  markOne(item: CustomerNotification): void {
    if (item.readAt || this.markingIds().has(item.id)) {
      return;
    }
    this.markingIds.update((ids) => new Set(ids).add(item.id));
    this.notifications.markRead(item.id).subscribe({
      next: (updated) => {
        // The service's mutation counter already bumped (tap runs first) —
        // mark it as locally handled so the reconciliation effect skips a
        // redundant reload.
        this.seenMutations = this.notifications.mutations();
        this.markingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(item.id);
          return next;
        });
        // In the unread-only view the item leaves the list; reload for the
        // authoritative page contents.
        if (this.filter() === 'unread') {
          this.load();
        } else {
          this.items.update((items) =>
            items.map((i) => (i.id === updated.id ? { ...i, readAt: updated.readAt } : i)),
          );
        }
      },
      error: () => {
        this.markingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(item.id);
          return next;
        });
        this.toast.error('Could not mark the notification as read. Please try again.');
      },
    });
  }

  markAll(): void {
    if (this.markingAll() || this.unreadCount() === 0) {
      return;
    }
    this.markingAll.set(true);
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.seenMutations = this.notifications.mutations();
        this.markingAll.set(false);
        this.load();
      },
      error: () => {
        this.markingAll.set(false);
        this.toast.error('Could not mark all notifications as read. Please try again.');
      },
    });
  }
}
