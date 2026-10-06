import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AUDIT_EVENTS, AuditService, type AuditLogItem } from './audit.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaButton } from '../../../shared/ui/button.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const ACTOR_TYPES = ['User', 'Staff', 'Guest', 'System'];

@Component({
  selector: 'na-admin-audit',
  imports: [FormsModule, NaBreadcrumbs, NaAlert, NaSkeleton, NaEmptyState, NaButton],
  templateUrl: './admin-audit.component.html',
  styleUrl: './admin-audit.component.css',
})
export class AdminAuditPage implements OnInit {
  private readonly audit = inject(AuditService);

  readonly crumbs = [{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Audit Log' }];

  readonly events = AUDIT_EVENTS;
  readonly actorTypes = ACTOR_TYPES;
  readonly limit = 20;

  readonly logs = signal<AuditLogItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly expanded = signal<string | null>(null);

  readonly eventFilter = signal('');
  readonly actorTypeFilter = signal('');
  readonly actorIdFilter = signal('');
  readonly targetIdFilter = signal('');
  readonly fromFilter = signal('');
  readonly toFilter = signal('');
  readonly searchFilter = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.audit
      .listLogs({
        page: this.page(),
        limit: this.limit,
        event: this.eventFilter() || undefined,
        actorType: this.actorTypeFilter() || undefined,
        actorId: this.actorIdFilter() || undefined,
        targetId: this.targetIdFilter() || undefined,
        from: this.fromFilter() || undefined,
        to: this.toFilter() || undefined,
        search: this.searchFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.logs.set(res.items);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    for (const s of [
      this.eventFilter,
      this.actorTypeFilter,
      this.actorIdFilter,
      this.targetIdFilter,
      this.fromFilter,
      this.toFilter,
      this.searchFilter,
    ]) {
      s.set('');
    }
    this.page.set(1);
    this.load();
  }

  prev(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  next(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  truncate(id: string | null | undefined): string {
    if (!id) return '—';
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }

  hasMetadata(log: AuditLogItem): boolean {
    return Object.keys(log.metadata).length > 0;
  }

  metadataJson(log: AuditLogItem): string {
    return JSON.stringify(log.metadata, null, 2);
  }

  toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }
}
