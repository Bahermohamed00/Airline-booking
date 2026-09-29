import { ChangeDetectionStrategy, Component, input, output, booleanAttribute } from '@angular/core';
import type { StatusTone } from '../utils/status-maps';

@Component({
  selector: 'na-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert alert--{{ tone() }}" [attr.role]="tone() === 'danger' ? 'alert' : 'status'">
      <span class="alert__icon" aria-hidden="true">{{ icon() }}</span>
      <div class="alert__body">
        @if (title()) { <p class="alert__title">{{ title() }}</p> }
        <div class="alert__content"><ng-content /></div>
        @if (retryable()) {
          <button type="button" class="alert__retry" (click)="retry.emit()">Try again</button>
        }
      </div>
      @if (dismissible()) {
        <button type="button" class="alert__close" aria-label="Dismiss" (click)="dismissed.emit()">×</button>
      }
    </div>
  `,
  styles: `
    .alert {
      display: flex; gap: var(--na-space-3); align-items: flex-start;
      padding: var(--na-space-3) var(--na-space-4); border-radius: var(--na-radius-md);
      border: 1px solid; font-size: var(--na-text-sm);
    }
    .alert--success { background: var(--na-success-bg); border-color: var(--na-success); color: var(--na-success); }
    .alert--warning { background: var(--na-warning-bg); border-color: var(--na-warning); color: var(--na-warning); }
    .alert--danger { background: var(--na-danger-bg); border-color: var(--na-danger); color: var(--na-danger); }
    .alert--info { background: var(--na-info-bg); border-color: var(--na-info); color: var(--na-info); }
    .alert--neutral { background: var(--na-surface-sunken); border-color: var(--na-border-strong); color: var(--na-ink-700); }
    .alert__title { font-weight: var(--na-font-semibold); margin-bottom: var(--na-space-1); }
    .alert__content { color: var(--na-ink-700); }
    .alert__close { margin-left: auto; background: none; border: none; font-size: 1.2rem; color: inherit; }
    .alert__retry { margin-top: var(--na-space-2); background: none; border: 1px solid currentColor; border-radius: var(--na-radius-sm); padding: 0.25rem 0.6rem; color: inherit; font-weight: var(--na-font-semibold); }
  `,
})
export class NaAlert {
  readonly tone = input<StatusTone>('info');
  readonly title = input<string | null>(null);
  readonly icon = input('ℹ');
  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly retryable = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();
  readonly retry = output<void>();
}
