import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AUDIT_LOGS } from '../../../core/mock/mock-data';
import type { AuditLog } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

@Component({
  selector: 'na-admin-audit',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

      <div class="filters na-card">
        <div class="na-field filters__field">
          <label class="na-label" for="audit-actor">Actor</label>
          <input
            id="audit-actor"
            class="na-input"
            type="search"
            placeholder="Filter by actor name"
            [ngModel]="actorFilter()"
            (ngModelChange)="actorFilter.set($event)"
          />
        </div>
        <div class="na-field filters__field">
          <label class="na-label" for="audit-action">Action</label>
          <input
            id="audit-action"
            class="na-input"
            type="search"
            placeholder="e.g. REFUND_PROCESSED"
            [ngModel]="actionFilter()"
            (ngModelChange)="actionFilter.set($event)"
          />
        </div>
      </div>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else if (filtered().length === 0) {
        <na-empty-state icon="≡" title="No audit records" message="No entries match the current filters." />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target type</th>
                <th>Target</th>
                <th><span class="na-visually-hidden">Details</span></th>
              </tr>
            </thead>
            <tbody>
              @for (log of filtered(); track log.id) {
                <tr
                  tabindex="0"
                  class="row"
                  (click)="toggle(log.id)"
                  (keydown.enter)="toggle(log.id)"
                  [attr.aria-expanded]="expanded() === log.id"
                >
                  <td data-label="Time">{{ fmtDate(log.createdAt) }}</td>
                  <td data-label="Actor">{{ log.actorName }}</td>
                  <td data-label="Action" class="na-text-mono">{{ log.action }}</td>
                  <td data-label="Target type">{{ log.targetType }}</td>
                  <td data-label="Target" class="na-text-mono" [title]="log.targetId ?? ''">{{ truncate(log.targetId) }}</td>
                  <td data-label="Details" class="row__chevron" aria-hidden="true">{{ expanded() === log.id ? '▾' : '▸' }}</td>
                </tr>
                @if (expanded() === log.id) {
                  <tr class="detail-row">
                    <td colspan="6">
                      <div class="detail">
                        <p class="na-text-small"><strong>Actor type:</strong> {{ log.actorType }} · <strong>Record ID:</strong> <span class="na-text-mono">{{ log.id }}</span></p>
                        <h3 class="detail__title">Metadata</h3>
                        <pre class="detail__json">{{ metadataJson(log) }}</pre>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
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
    .filters__field { margin-bottom: 0; flex: 1 1 240px; }
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
    @media (max-width: 639px) {
      .filters__field { flex: 1 1 100%; }
    }
  `,
})
export class AdminAuditPage {
  readonly crumbs = [
    { label: 'Admin', link: '/admin/dashboard' },
    { label: 'Audit Log' },
  ];

  readonly loading = signal(true);
  readonly logs = signal<AuditLog[]>([]);
  readonly actorFilter = signal('');
  readonly actionFilter = signal('');
  readonly expanded = signal<string | null>(null);

  readonly filtered = computed(() => {
    const actor = this.actorFilter().trim().toLowerCase();
    const action = this.actionFilter().trim().toLowerCase();
    return this.logs().filter(
      (log) =>
        (!actor || log.actorName.toLowerCase().includes(actor)) &&
        (!action || log.action.toLowerCase().includes(action)),
    );
  });

  constructor() {
    setTimeout(() => {
      this.logs.set([...AUDIT_LOGS].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      this.loading.set(false);
    }, 300);
  }

  fmtDate(iso: string): string {
    return DATE_TIME.format(new Date(iso));
  }

  truncate(id: string | null | undefined): string {
    if (!id) return '—';
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }

  metadataJson(log: AuditLog): string {
    return JSON.stringify(log.metadata ?? {}, null, 2);
  }

  toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }
}
