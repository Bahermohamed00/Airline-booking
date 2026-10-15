import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminSupportService, type AdminTicket, type SupportMessage } from './admin-support.service';
import { SUPPORT_TICKET_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDataTable, type TableColumn } from '../../../shared/ui/data-table.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface HistoryRow {
  id: string;
  ticketNumber: string;
  customer: string;
  email: string;
  subject: string;
  closedAt: string;
  lastMessageAt: string;
  assignee: string;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Support History: closed conversations only (status=CLOSED server-side),
 * with combined search (number/subject/customer name/email), closedAt date
 * range, and server-side pagination. Read-only — a closed conversation can
 * only resurface via the business reopen rule (new customer message).
 */
@Component({
  selector: 'na-admin-support-history',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDataTable, NaSkeleton],
  templateUrl: './support-history.component.html',
  styleUrl: './support-history.component.css',
})
export class AdminSupportHistoryPage {
  private readonly service = inject(AdminSupportService);

  readonly columns: TableColumn<HistoryRow>[] = [
    { key: 'ticketNumber', label: 'Ticket' },
    { key: 'customer', label: 'Customer' },
    { key: 'email', label: 'Email', priority: 'low' },
    { key: 'subject', label: 'Subject' },
    { key: 'closedAt', label: 'Closed' },
    { key: 'lastMessageAt', label: 'Last activity' },
    { key: 'assignee', label: 'Assigned to', priority: 'low' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<AdminTicket[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  filterSearch = '';
  filterFrom = '';
  filterTo = '';

  private readonly filterChanges = new Subject<void>();

  readonly selected = signal<AdminTicket | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly messages = signal<SupportMessage[]>([]);

  readonly rows = computed<HistoryRow[]>(() =>
    this.items().map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      customer: `${t.customer.firstName} ${t.customer.lastName}`,
      email: t.customer.email,
      subject: t.subject,
      closedAt: t.closedAt ? dateTimeFmt.format(new Date(t.closedAt)) : '—',
      lastMessageAt: dateTimeFmt.format(new Date(t.lastMessageAt)),
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
              this.loadError.set(toErrorMessage(err, 'Could not load support history.'));
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

  clearFilters(): void {
    this.filterSearch = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.page.set(1);
    this.filterChanges.next();
  }

  private currentQuery() {
    return {
      status: 'CLOSED' as const,
      search: this.filterSearch.trim() || undefined,
      closedFrom: this.filterFrom || undefined,
      closedTo: this.filterTo || undefined,
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
    this.detailLoading.set(true);
    this.selected.set(null);
    this.messages.set([]);
    this.service.conversation(id).subscribe({
      next: (conversation) => {
        this.detailLoading.set(false);
        this.selected.set(conversation.ticket);
        this.messages.set(conversation.messages);
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

  statusOf(t: AdminTicket) {
    return statusLabel(SUPPORT_TICKET_STATUS_MAP, t.status);
  }

  formatDate(iso: string): string {
    return dateTimeFmt.format(new Date(iso));
  }
}
