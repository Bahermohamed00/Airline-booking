import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NOTIFICATION_STATUS_MAP, statusLabel, StatusTone } from '../../../core/status-maps';
import type { NotificationChannel, NotificationStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaButton } from '../../../shared/ui/button.component';
import {
  AdminNotificationsService,
  type AdminNotificationItem,
  type AdminNotificationReadFilter,
} from './admin-notifications.service';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const PAGE_SIZE = 20;

const CHANNEL_TONES: Record<NotificationChannel, StatusTone> = {
  EMAIL: 'info',
  SMS: 'success',
  PUSH: 'warning',
  IN_APP: 'neutral',
};

type ChannelFilter = '' | NotificationChannel;
type StatusFilter = '' | NotificationStatus;
type ReadFilter = '' | AdminNotificationReadFilter;

@Component({
  selector: 'na-admin-notifications',
  standalone: true,
  imports: [NaBreadcrumbs, NaBadge, NaAlert, NaSkeleton, NaEmptyState, NaButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <div>
          <h1>Notifications</h1>
          <p class="page__sub">Outbound customer communications across all channels.</p>
        </div>
      </header>

      <div class="filters" role="group" aria-label="Filter notifications">
        <select class="na-select" [value]="channel()" (change)="setChannel($event)" aria-label="Channel">
          <option value="">All channels</option>
          @for (c of channels; track c) {
            <option [value]="c" [selected]="channel() === c">{{ c }}</option>
          }
        </select>
        <select class="na-select" [value]="status()" (change)="setStatus($event)" aria-label="Delivery status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s" [selected]="status() === s">{{ s }}</option>
          }
        </select>
        <select class="na-select" [value]="read()" (change)="setRead($event)" aria-label="Read state">
          <option value="">Read + unread</option>
          <option value="unread" [selected]="read() === 'unread'">Unread</option>
          <option value="read" [selected]="read() === 'read'">Read</option>
        </select>
      </div>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (loadError(); as error) {
        <na-alert tone="danger" icon="!" role="alert">
          {{ error }}
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </na-alert>
      } @else if (items().length === 0) {
        <na-empty-state icon="✉" title="No notifications" message="No notification records match the current filters." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Read at</th>
                <th>Sent at</th>
              </tr>
            </thead>
            <tbody>
              @for (n of items(); track n.id) {
                <tr>
                  <td data-label="Title">
                    <div>{{ n.title }}</div>
                    @if (n.error) {
                      <div class="row-error" [title]="n.error">{{ n.error }}</div>
                    }
                  </td>
                  <td data-label="Channel"><na-badge [tone]="channelTone(n.channel)">{{ n.channel }}</na-badge></td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(NOTIFICATION_STATUS_MAP, n.status).tone">
                      {{ statusLabel(NOTIFICATION_STATUS_MAP, n.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Attempts">{{ n.attempts }}</td>
                  <td data-label="Read at">{{ n.readAt ? fmtDate(n.readAt) : '—' }}</td>
                  <td data-label="Sent at">{{ n.sentAt ? fmtDate(n.sentAt) : 'Queued' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <nav class="pagination" aria-label="Notification pages">
            <na-button variant="secondary" [disabled]="page() <= 1" (clicked)="goToPage(page() - 1)">Previous</na-button>
            <span class="pagination__info">Page {{ page() }} of {{ totalPages() }} · {{ total() }} notifications</span>
            <na-button variant="secondary" [disabled]="page() >= totalPages()" (clicked)="goToPage(page() + 1)">Next</na-button>
          </nav>
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .filters { display: flex; gap: var(--na-space-3); flex-wrap: wrap; margin-bottom: var(--na-space-4); }
    .filters .na-select { min-height: 40px; }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    na-alert na-button { margin-left: var(--na-space-3); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    .row-error { color: var(--na-danger); font-size: var(--na-text-xs); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pagination { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3); margin-top: var(--na-space-4); }
    .pagination__info { font-size: var(--na-text-sm); color: var(--na-ink-500); }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminNotificationsPage {
  private readonly api = inject(AdminNotificationsService);

  readonly NOTIFICATION_STATUS_MAP = NOTIFICATION_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Notifications' },
  ];

  readonly channels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];
  readonly statuses: NotificationStatus[] = ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING'];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<AdminNotificationItem[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly total = signal(0);
  readonly channel = signal<ChannelFilter>('');
  readonly status = signal<StatusFilter>('');
  readonly read = signal<ReadFilter>('');

  /** Incremented per request; a late response from a superseded request
   *  (filter/page changed meanwhile) is discarded instead of racing the UI. */
  private requestGeneration = 0;

  constructor() {
    this.load();
  }

  channelTone(channel: NotificationChannel): StatusTone {
    return CHANNEL_TONES[channel] ?? 'neutral';
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  setChannel(event: Event): void {
    this.channel.set((event.target as HTMLSelectElement).value as ChannelFilter);
    this.page.set(1);
    this.load();
  }

  setStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
    this.page.set(1);
    this.load();
  }

  setRead(event: Event): void {
    this.read.set((event.target as HTMLSelectElement).value as ReadFilter);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  load(): void {
    const generation = ++this.requestGeneration;
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .list({
        page: this.page(),
        limit: PAGE_SIZE,
        channel: this.channel() || undefined,
        status: this.status() || undefined,
        read: this.read() || undefined,
      })
      .subscribe({
        next: (res) => {
          if (generation !== this.requestGeneration) return;
          this.items.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(Math.max(1, res.totalPages));
          this.loading.set(false);
        },
        error: (err: { status?: number }) => {
          if (generation !== this.requestGeneration) return;
          this.loading.set(false);
          if (err?.status === 403) {
            this.loadError.set('You do not have permission to view notification records.');
          } else if (err?.status === 401) {
            this.loadError.set('Your session has expired — please sign in again.');
          } else {
            this.loadError.set('Could not load notifications. Please try again.');
          }
        },
      });
  }
}
