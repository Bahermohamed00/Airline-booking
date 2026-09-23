import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { StatusTone } from '../../core/status-maps';

@Component({
  selector: 'na-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge badge--{{ tone() }}"><ng-content /></span>`,
  styles: `
    .badge {
      display: inline-flex; align-items: center; gap: var(--na-space-1);
      padding: 0.15rem 0.55rem; border-radius: var(--na-radius-full);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); white-space: nowrap;
    }
    .badge--success { background: var(--na-success-bg); color: var(--na-success); }
    .badge--warning { background: var(--na-warning-bg); color: var(--na-warning); }
    .badge--danger { background: var(--na-danger-bg); color: var(--na-danger); }
    .badge--info { background: var(--na-info-bg); color: var(--na-info); }
    .badge--neutral { background: var(--na-surface-sunken); color: var(--na-ink-500); }
  `,
})
export class NaBadge {
  readonly tone = input<StatusTone>('neutral');
}
