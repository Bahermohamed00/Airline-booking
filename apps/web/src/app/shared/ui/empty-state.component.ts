import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'na-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="empty__icon" aria-hidden="true">{{ icon() }}</span>
      <h3 class="empty__title">{{ title() }}</h3>
      @if (message()) { <p class="empty__msg">{{ message() }}</p> }
      @if (actionLabel()) {
        <button type="button" class="empty__action" (click)="action.emit()">{{ actionLabel() }}</button>
      }
    </div>
  `,
  styles: `
    .empty { text-align: center; padding: var(--na-space-12) var(--na-space-4); color: var(--na-ink-500); }
    .empty__icon { font-size: 2.5rem; display: block; margin-bottom: var(--na-space-3); }
    .empty__title { margin-bottom: var(--na-space-2); }
    .empty__msg { max-width: 40ch; margin: 0 auto var(--na-space-4); }
    .empty__action {
      background: var(--na-blue-600); color: #fff; border: none; border-radius: var(--na-radius-md);
      padding: 0.55rem 1.1rem; font-weight: var(--na-font-semibold); min-height: 44px;
    }
  `,
})
export class NaEmptyState {
  readonly icon = input('✈');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();
}
