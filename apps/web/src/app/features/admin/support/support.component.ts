import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminSupportService, type AdminTicket, type SupportMessage } from './admin-support.service';
import { SUPPORT_TICKET_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { SupportTicketStatus } from '../../../core/models/domain.model';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface TicketRow {
  id: string;
  ticketNumber: string;
  customer: string;
  email: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unreadCount: number;
  assignee: string;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_OPTIONS: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/**
 * Support Staff inbox. Each row shows the customer, ticket, status, last
 * activity and an unread-message badge that clears when the agent opens the
 * conversation. The ticket detail is a conversation (incoming customer
 * messages, outgoing staff replies) plus an email reply composer. Agent
 * communication is strictly attached to the ticket — no public chat.
 */
@Component({
  selector: 'na-admin-support',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDataTable, NaSkeleton, HasPermissionDirective],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class AdminSupportPage {
  private readonly service = inject(AdminSupportService);
  private readonly toast = inject(ToastService);

  readonly statusOptions = STATUS_OPTIONS;

  readonly columns: TableColumn<TicketRow>[] = [
    { key: 'ticketNumber', label: 'Ticket' },
    { key: 'customer', label: 'Customer' },
    { key: 'email', label: 'Email', priority: 'low' },
    { key: 'subject', label: 'Subject' },
    {
      key: 'status',
      label: 'Status',
      badge: (r) => ({
        text: r.status,
        tone: Object.values(SUPPORT_TICKET_STATUS_MAP).find((v) => v.label === r.status)?.tone ?? 'neutral',
      }),
    },
    { key: 'lastMessageAt', label: 'Last update' },
    {
      key: 'unreadCount',
      label: 'Unread',
      badge: (r) => (r.unreadCount > 0 ? { text: `● ${r.unreadCount}`, tone: 'info' } : null),
    },
    { key: 'assignee', label: 'Assigned to', priority: 'low' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<AdminTicket[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  filterStatus = signal<'ALL' | SupportTicketStatus>('ALL');
  filterTicketNumber = '';
  filterEmail = '';
  /** Unread filter: only tickets with at least one unread customer message (server-side). */
  readonly unreadOnly = signal(false);

  private readonly filterChanges = new Subject<void>();

  readonly selected = signal<AdminTicket | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly messages = signal<SupportMessage[]>([]);
  replyBody = '';
  readonly sending = signal(false);
  readonly replyError = signal<string | null>(null);

  readonly rows = computed<TicketRow[]>(() =>
    this.items().map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      customer: `${t.customer.firstName} ${t.customer.lastName}`,
      email: t.customer.email,
      subject: t.subject,
      status: statusLabel(SUPPORT_TICKET_STATUS_MAP, t.status).label,
      lastMessageAt: dateTimeFmt.format(new Date(t.lastMessageAt)),
      unreadCount: t.unreadCount,
      assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '—',
    })),
  );

  constructor() {
    this.filterChanges
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.loadError.set(null);
          return this.service.list(this.currentQuery()).pipe(
            // Handle errors per emission so the outer stream — and the Retry
            // button that feeds it — survives a failed request.
            catchError((err: unknown) => {
              this.loadError.set(toErrorMessage(err, 'Could not load support tickets.'));
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result === null) {
          return;
        }
        this.items.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      });
    this.load();
  }

  load(): void {
    this.filterChanges.next();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.filterChanges.next();
  }

  setUnreadOnly(value: boolean): void {
    if (this.unreadOnly() === value) return;
    this.unreadOnly.set(value);
    this.onFilterChange();
  }

  clearFilters(): void {
    this.filterStatus.set('ALL');
    this.filterTicketNumber = '';
    this.filterEmail = '';
    this.unreadOnly.set(false);
    this.page.set(1);
    this.filterChanges.next();
  }

  private currentQuery() {
    const status = this.filterStatus();
    return {
      status: status === 'ALL' ? undefined : status,
      ticketNumber: this.filterTicketNumber.trim() || undefined,
      email: this.filterEmail.trim() || undefined,
      unreadOnly: this.unreadOnly() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.filterChanges.next();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.filterChanges.next();
    }
  }

  openDetail(id: string): void {
    this.detailError.set(null);
    this.actionError.set(null);
    this.replyError.set(null);
    this.replyBody = '';
    this.detailLoading.set(true);
    this.selected.set(null);
    this.messages.set([]);
    this.service.conversation(id).subscribe({
      next: (conversation) => {
        this.detailLoading.set(false);
        this.selected.set(conversation.ticket);
        this.messages.set(conversation.messages);
        // Opening the conversation marks customer messages read — the inbox
        // badge clears, so refresh the list silently.
        this.service.markRead(id).subscribe(() => this.filterChanges.next());
      },
      error: (err: unknown) => {
        this.detailLoading.set(false);
        this.detailError.set(toErrorMessage(err, 'Could not load the ticket.'));
      },
    });
  }

  closeDetail(): void {
    this.selected.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
    this.messages.set([]);
  }

  submitReply(t: AdminTicket): void {
    const body = this.replyBody.trim();
    if (this.sending() || !body) return;
    this.replyError.set(null);
    this.sending.set(true);
    this.service.reply(t.id, body).subscribe({
      next: (message) => {
        this.sending.set(false);
        this.replyBody = '';
        this.messages.update((list) => [...list, message]);
        this.toast.success(`Reply emailed to ${t.customer.email}.`);
        this.filterChanges.next(); // refresh last-activity/unread in the inbox
      },
      error: (err: unknown) => {
        this.sending.set(false);
        this.replyError.set(
          toErrorMessage(err, 'The reply was recorded but the email could not be sent. Please try again.'),
        );
      },
    });
  }

  /** Explicit lifecycle actions only — the API rejects anything else. */
  availableActions(t: AdminTicket): { action: 'claim' | 'resolve' | 'close' | 'reopen'; label: string }[] {
    switch (t.status) {
      case 'OPEN':
        return t.assignee ? [] : [{ action: 'claim', label: 'Claim ticket' }];
      case 'IN_PROGRESS':
        return [{ action: 'resolve', label: 'Mark as resolved' }];
      case 'RESOLVED':
        return [
          { action: 'close', label: 'Close ticket' },
          { action: 'reopen', label: 'Reopen' },
        ];
      default:
        return [];
    }
  }

  runAction(t: AdminTicket, action: 'claim' | 'resolve' | 'close' | 'reopen'): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.service[action](t.id).subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.selected.set(updated);
        this.toast.success(`Ticket ${updated.ticketNumber}: ${statusLabel(SUPPORT_TICKET_STATUS_MAP, updated.status).label}.`);
        this.load();
      },
      error: (err: unknown) => {
        this.acting.set(false);
        this.actionError.set(toErrorMessage(err, 'Could not update the ticket.'));
      },
    });
  }

  statusOf(t: AdminTicket) {
    return statusLabel(SUPPORT_TICKET_STATUS_MAP, t.status);
  }

  formatDate(iso: string): string {
    return dateTimeFmt.format(new Date(iso));
  }
}
