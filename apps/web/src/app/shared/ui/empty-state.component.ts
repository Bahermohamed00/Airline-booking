import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { NaButton } from './button.component';

@Component({
  selector: 'na-empty-state',
  standalone: true,
  imports: [NaButton, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      @if (image(); as img) {
        <span class="empty__media">
          <img [ngSrc]="img" width="560" height="240" alt="" />
        </span>
      } @else {
        <span class="empty__icon" aria-hidden="true">{{ icon() }}</span>
      }
      <h3 class="empty__title">{{ title() }}</h3>
      @if (message()) { <p class="empty__msg">{{ message() }}</p> }
      @if (actionLabel()) {
        <na-button variant="primary" (clicked)="action.emit()">{{ actionLabel() }}</na-button>
      }
    </div>
  `,
  styles: `
    .empty { text-align: center; padding: var(--na-space-12) var(--na-space-4); color: var(--na-ink-500); }
    .empty__media {
      display: block; max-width: 280px; margin: 0 auto var(--na-space-5);
      border-radius: var(--na-radius-lg); overflow: hidden;
      border: 1px solid var(--na-border); box-shadow: var(--na-shadow-md);
    }
    .empty__media img {
      width: 100%; height: auto; display: block; object-fit: cover;
      filter: saturate(0.72) brightness(0.92);
    }
    .empty__icon { font-size: 2.5rem; display: block; margin-bottom: var(--na-space-3); }
    .empty__title { margin-bottom: var(--na-space-2); }
    .empty__msg { max-width: 40ch; margin: 0 auto var(--na-space-4); }
  `,
})
export class NaEmptyState {
  readonly icon = input('✈');
  readonly image = input<string | null>(null);
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();
}
