import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/ui/toast.service';
import { NOTIFICATION_STATUS_MAP, statusLabel, StatusTone } from '../../../core/status-maps';
import { NOTIFICATIONS } from '../../../core/mock/mock-data';
import type { NotificationChannel, NotificationItem } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const CHANNEL_TONES: Record<NotificationChannel, StatusTone> = {
  EMAIL: 'info',
  SMS: 'success',
  PUSH: 'warning',
  IN_APP: 'neutral',
};

@Component({
  selector: 'na-admin-notifications',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <div>
          <h1>Notifications</h1>
          <p class="page__sub">Outbound customer communications across all channels.</p>
        </div>
        <na-button variant="cta" (clicked)="drawerOpen.set(true)">Send notification</na-button>
      </header>

      <na-alert tone="info" icon="✉">
        Delivery status reflects the provider callback: queued notifications start as
        <strong>Pending</strong>, then move to <strong>Sent</strong> and <strong>Delivered</strong> — or
        <strong>Failed</strong> with automatic retries.
      </na-alert>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (items().length === 0) {
        <na-empty-state icon="✉" title="No notifications" message="Nothing has been sent yet." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Sent at</th>
              </tr>
            </thead>
            <tbody>
              @for (n of items(); track n.id) {
                <tr>
                  <td data-label="Subject">{{ n.subject ?? '—' }}</td>
                  <td data-label="Channel"><na-badge [tone]="channelTone(n.channel)">{{ n.channel }}</na-badge></td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(NOTIFICATION_STATUS_MAP, n.status).tone">
                      {{ statusLabel(NOTIFICATION_STATUS_MAP, n.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="Sent at">{{ n.sentAt ? fmtDate(n.sentAt) : 'Queued' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (drawerOpen()) {
        <div class="backdrop" (click)="drawerOpen.set(false)" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Send notification"
          tabindex="-1"
          (keydown.escape)="drawerOpen.set(false)"
        >
          <header class="drawer__head">
            <h2>Send notification</h2>
            <button type="button" class="drawer__close" aria-label="Close" (click)="drawerOpen.set(false)">×</button>
          </header>
          <form (ngSubmit)="send()">
            <div class="na-field">
              <label class="na-label" for="notif-target">Audience</label>
              <select id="notif-target" class="na-select" [ngModel]="target()" (ngModelChange)="target.set($event)" name="target">
                <option value="ALL">All customers</option>
                <option value="BOOKING">Specific booking</option>
              </select>
            </div>
            @if (target() === 'BOOKING') {
              <div class="na-field">
                <label class="na-label" for="notif-reference">Booking reference</label>
                <input
                  id="notif-reference"
                  class="na-input na-text-mono"
                  placeholder="e.g. NVA7K2"
                  [ngModel]="bookingReference()"
                  (ngModelChange)="bookingReference.set($event)"
                  name="bookingReference"
                />
              </div>
            }
            <div class="na-field">
              <label class="na-label" for="notif-channel">Channel</label>
              <select id="notif-channel" class="na-select" [ngModel]="channel()" (ngModelChange)="channel.set($event)" name="channel">
                @for (c of channels; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="notif-subject">Subject</label>
              <input id="notif-subject" class="na-input" required [ngModel]="subject()" (ngModelChange)="subject.set($event)" name="subject" />
            </div>
            <div class="na-field">
              <label class="na-label" for="notif-body">Message</label>
              <textarea id="notif-body" class="na-input" rows="5" required [ngModel]="body()" (ngModelChange)="body.set($event)" name="body"></textarea>
            </div>
            @if (formError()) {
              <p class="na-error" role="alert">{{ formError() }}</p>
            }
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="drawerOpen.set(false)">Cancel</na-button>
              <na-button variant="primary" type="submit">Queue notification</na-button>
            </div>
          </form>
        </aside>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 99; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 100;
      width: min(480px, 100vw); background: var(--na-surface-raised);
      border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg); padding: var(--na-space-6); overflow-y: auto;
    }
    .drawer__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--na-space-5); }
    .drawer__close { background: none; border: none; font-size: 1.5rem; color: var(--na-ink-500); min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md); }
    .drawer__close:hover { background: var(--na-surface-sunken); color: var(--na-ink-900); }
    .drawer__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); margin-top: var(--na-space-5); }
    @media (max-width: 639px) {
      .drawer { width: 100vw; padding: var(--na-space-4); }
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminNotificationsPage {
  private readonly toast = inject(ToastService);

  readonly NOTIFICATION_STATUS_MAP = NOTIFICATION_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Notifications' },
  ];

  readonly channels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];

  readonly loading = signal(true);
  readonly items = signal<NotificationItem[]>([]);

  readonly drawerOpen = signal(false);
  readonly target = signal<'ALL' | 'BOOKING'>('ALL');
  readonly bookingReference = signal('');
  readonly channel = signal<NotificationChannel>('EMAIL');
  readonly subject = signal('');
  readonly body = signal('');
  readonly formError = signal<string | null>(null);

  constructor() {
    setTimeout(() => {
      this.items.set([...NOTIFICATIONS].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      this.loading.set(false);
    }, 300);
  }

  channelTone(channel: NotificationChannel): StatusTone {
    return CHANNEL_TONES[channel] ?? 'neutral';
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  send(): void {
    if (!this.subject().trim() || !this.body().trim()) {
      this.formError.set('Subject and message are required.');
      return;
    }
    if (this.target() === 'BOOKING' && !this.bookingReference().trim()) {
      this.formError.set('Enter a booking reference for a targeted notification.');
      return;
    }
    const queued: NotificationItem = {
      id: crypto.randomUUID(),
      channel: this.channel(),
      status: 'PENDING',
      subject: this.subject().trim(),
      content: this.body().trim(),
      sentAt: null,
      createdAt: new Date().toISOString(),
    };
    this.items.update((list) => [queued, ...list]);
    this.toast.success(
      this.target() === 'ALL'
        ? `Notification queued for all customers via ${this.channel()}.`
        : `Notification queued for booking ${this.bookingReference().trim().toUpperCase()} via ${this.channel()}.`,
    );
    this.drawerOpen.set(false);
    this.subject.set('');
    this.body.set('');
    this.bookingReference.set('');
    this.formError.set(null);
  }
}
