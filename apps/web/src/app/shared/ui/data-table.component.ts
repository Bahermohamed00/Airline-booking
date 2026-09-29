import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { StatusTone } from '../utils/status-maps';
import { NaSkeleton } from './skeleton.component';
import { NaEmptyState } from './empty-state.component';
import { NaBadge } from './badge.component';

export interface BadgeCell {
  text: string;
  tone: StatusTone;
}

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  /** hide on mobile when 'low' priority */
  priority?: 'high' | 'low';
  /** render the cell as a status badge instead of plain text */
  badge?: (row: T) => BadgeCell | null;
}

@Component({
  selector: 'na-data-table',
  standalone: true,
  imports: [NaSkeleton, NaEmptyState, NaBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="table-loading"><na-skeleton [rows]="[1, 2, 3, 4, 5]" height="2.5rem" /></div>
    } @else if (rows().length === 0) {
      <na-empty-state [title]="emptyTitle()" [message]="emptyMessage()" [actionLabel]="emptyActionLabel()" (action)="emptyAction.emit()" />
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              @for (col of columns(); track col.key) {
                <th [class.col--low]="col.priority === 'low'">{{ col.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track trackBy()(row)) {
              <tr tabindex="0" (click)="rowClick.emit(row)" (keydown.enter)="rowClick.emit(row)">
                @for (col of columns(); track col.key) {
                  <td [class.col--low]="col.priority === 'low'" [attr.data-label]="col.label">
                    @if (col.badge) {
                      @if (col.badge(row); as cell) {
                        <na-badge [tone]="cell.tone">{{ cell.text }}</na-badge>
                      } @else {
                        —
                      }
                    } @else {
                      {{ cellText(row, col.key) }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    tbody tr { cursor: pointer; transition: background var(--na-motion-fast); }
    tbody tr:hover { background: var(--na-blue-100); }
    tbody tr:focus-visible { outline: 2px solid var(--na-blue-600); outline-offset: -2px; }
    tbody tr:last-child td { border-bottom: none; }
    .table-loading { padding: var(--na-space-4); }
    @media (max-width: 639px) {
      .col--low { display: none; }
    }
  `,
})
export class NaDataTable<T = Record<string, unknown>> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly loading = input(false);
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyMessage = input<string | null>(null);
  readonly emptyActionLabel = input<string | null>(null);
  readonly trackBy = input<(row: T) => unknown>((row) => (row as Record<string, unknown>)['id']);
  readonly rowClick = output<T>();
  readonly emptyAction = output<void>();

  cellText(row: T, key: string): string {
    const value = (row as Record<string, unknown>)[key];
    if (value == null) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
