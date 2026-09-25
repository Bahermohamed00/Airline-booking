import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AUDIT_EVENTS, AuditService, type AuditLogItem } from '../../../core/services/audit.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaButton } from '../../../shared/ui/button.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const ACTOR_TYPES = ['User', 'Staff', 'Guest'];

@Component({
  selector: 'na-admin-audit',
  imports: [FormsModule, NaBreadcrumbs, NaAlert, NaSkeleton, NaEmptyState, NaButton],
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Audit Log</h1>
        <p class="page__sub">Every consequential staff and system action, in order.</p>
      </header>

      <na-alert tone="neutral" icon="≡">
        Audit records are immutable and cannot be edited or deleted — they form the compliance trail for
        exception workflows such as payment overrides (BR-14).
      </na-alert>

      <form class="filters na-card" (ngSubmit)="applyFilters()">
        <div class="na-field filters__field">
          <label class="na-label" for="f-event">Event</label>
          <select id="f-event" class="na-input" [ngModel]="eventFilter()" (ngModelChange)="eventFilter.set($event)" name="event">
            <option value="">All events</option>
            @for (e of events; track e) {
              <option [value]="e">{{ e }}</option>
            }
          </select>
        </div>
        <div class="na-field filters__field">
          <label class="na-label" for="f-actor-type">Actor type</label>
          <select id="f-actor-type" class="na-input" [ngModel]="actorTypeFilter()" (ngModelChange)="actorTypeFilter.set($event)" name="actorType">
            <option value="">All types</option>
            @for (t of actorTypes; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </div>
        <div class="na-field filters__field">
          <label class="na-label" for="f-actor">Actor ID</label>
          <input id="f-actor" class="na-input" type="search" placeholder="User UUID" [ngModel]="actorIdFilter()" (ngModelChange)="actorIdFilter.set($event)" name="actorId" />
        </div>
        <div class="na-field filters__field">
          <label class="na-label" for="f-target">Target</label>
          <input id="f-target" class="na-input" type="search" placeholder="Target identifier" [ngModel]="targetIdFilter()" (ngModelChange)="targetIdFilter.set($event)" name="targetId" />
        </div>
        <div class="na-field filters__field filters__field--date">
          <label class="na-label" for="f-from">From</label>
          <input id="f-from" class="na-input" type="date" [ngModel]="fromFilter()" (ngModelChange)="fromFilter.set($event)" name="from" />
        </div>
        <div class="na-field filters__field filters__field--date">
          <label class="na-label" for="f-to">To</label>
          <input id="f-to" class="na-input" type="date" [ngModel]="toFilter()" (ngModelChange)="toFilter.set($event)" name="to" />
        </div>
        <div class="na-field filters__field">
          <label class="na-label" for="f-search">Search</label>
          <input id="f-search" class="na-input" type="search" placeholder="Event, target, type, or IP" [ngModel]="searchFilter()" (ngModelChange)="searchFilter.set($event)" name="search" />
        </div>
        <div class="filters__actions">
          <na-button variant="primary" type="submit" [loading]="loading()">Apply</na-button>
          <na-button variant="secondary" type="button" (clicked)="resetFilters()">Reset</na-button>
        </div>
      </form>

      @if (error()) {
        <na-alert tone="danger" title="Could not load audit logs" retryable (retry)="load()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else if (logs().length === 0) {
        <na-empty-state icon="≡" title="No audit records" message="No entries match the current filters." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Actor type</th>
                <th>Actor</th>
                <th>Target</th>
                <th>IP</th>
                <th><span class="na-visually-hidden">Details</span></th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs(); track log.id) {
                <tr
                  tabindex="0"
                  class="row"
                  (click)="toggle(log.id)"
                  (keydown.enter)="toggle(log.id)"
                  [attr.aria-expanded]="expanded() === log.id"
                >
                  <td data-label="Time">{{ fmtDate(log.createdAt) }}</td>
                  <td data-label="Event" class="na-text-mono">{{ log.event }}</td>
                  <td data-label="Actor type">{{ log.actorType }}</td>
                  <td data-label="Actor" class="na-text-mono" [title]="log.actorId ?? ''">{{ truncate(log.actorId) }}</td>
                  <td data-label="Target" class="na-text-mono" [title]="log.targetType + ' ' + (log.targetId ?? '')">{{ log.targetType }}·{{ truncate(log.targetId) }}</td>
                  <td data-label="IP" class="na-text-mono">{{ log.ipAddress ?? '—' }}</td>
                  <td data-label="Details" class="row__chevron" aria-hidden="true">{{ expanded() === log.id ? '▾' : '▸' }}</td>
                </tr>
                @if (expanded() === log.id) {
                  <tr class="detail-row">
                    <td colspan="7">
                      <div class="detail">
                        <p class="na-text-small"><strong>Record ID:</strong> <span class="na-text-mono">{{ log.id }}</span></p>
                        <h3 class="detail__title">Metadata (sanitized)</h3>
                        @if (hasMetadata(log)) {
                          <pre class="detail__json">{{ metadataJson(log) }}</pre>
                        } @else {
                          <p class="na-text-muted na-text-small">No additional metadata recorded for this event.</p>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <nav class="pagination" aria-label="Audit pages">
          <na-button variant="secondary" size="sm" [disabled]="page() <= 1" (clicked)="prev()">← Previous</na-button>
          <span class="pagination__info">Page {{ page() }} of {{ totalPages() }} · {{ total() }} records</span>
          <na-button variant="secondary" size="sm" [disabled]="page() >= totalPages()" (clicked)="next()">Next →</na-button>
        </nav>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .filters { display: flex; gap: var(--na-space-4); padding: var(--na-space-4); margin-bottom: var(--na-space-5); flex-wrap: wrap; }
    .filters__field { margin-bottom: 0; flex: 1 1 180px; }
    .filters__actions { display: flex; gap: var(--na-space-2); align-items: flex-end; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    .row { cursor: pointer; transition: background var(--na-motion-fast); }
    .row:hover { background: var(--na-blue-100); }
    .row:focus-visible { outline: 2px solid var(--na-blue-600); outline-offset: -2px; }
    .row__chevron { color: var(--na-ink-500); }
    .detail-row td { background: var(--na-surface-sunken); }
    .detail { padding: var(--na-space-2) 0; }
    .detail__title { font-size: var(--na-text-sm); margin: var(--na-space-3) 0 var(--na-space-2); }
    .detail__json {
      margin: 0; padding: var(--na-space-3); background: var(--na-navy-800); color: var(--na-ink-100);
      border-radius: var(--na-radius-md); font-family: var(--na-font-mono); font-size: var(--na-text-xs);
      overflow-x: auto; white-space: pre-wrap; word-break: break-all;
    }
    .pagination { display: flex; align-items: center; gap: var(--na-space-4); justify-content: center; margin-top: var(--na-space-5); }
    .pagination__info { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    @media (max-width: 639px) {
      .filters__field { flex: 1 1 100%; }
    }
  `,
})
export class AdminAuditPage implements OnInit {
  private readonly audit = inject(AuditService);

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Audit Log' },
  ];

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
    for (const s of [this.eventFilter, this.actorTypeFilter, this.actorIdFilter, this.targetIdFilter, this.fromFilter, this.toFilter, this.searchFilter]) {
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
