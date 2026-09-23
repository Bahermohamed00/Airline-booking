import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  count?: number | null;
  disabled?: boolean;
}

@Component({
  selector: 'na-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.tab--active]="tab.id === active()"
          [disabled]="tab.disabled"
          [attr.aria-selected]="tab.id === active()"
          (click)="tabChange.emit(tab.id)"
        >
          {{ tab.label }}
          @if (tab.count != null) { <span class="tab__count">{{ tab.count }}</span> }
        </button>
      }
    </div>
  `,
  styles: `
    .tabs { display: flex; gap: var(--na-space-1); border-bottom: 2px solid var(--na-border); overflow-x: auto; }
    .tab {
      background: none; border: none; padding: var(--na-space-3) var(--na-space-4);
      font-weight: var(--na-font-medium); color: var(--na-ink-500); white-space: nowrap;
      border-bottom: 2px solid transparent; margin-bottom: -2px; min-height: 44px;
    }
    .tab:hover:not(:disabled) { color: var(--na-ink-900); }
    .tab--active { color: var(--na-blue-600); border-bottom-color: var(--na-blue-600); font-weight: var(--na-font-semibold); }
    .tab__count { margin-left: var(--na-space-1); background: var(--na-surface-sunken); border-radius: var(--na-radius-full); padding: 0 0.4rem; font-size: var(--na-text-xs); }
  `,
})
export class NaTabs {
  readonly tabs = input.required<TabItem[]>();
  readonly active = input.required<string>();
  readonly ariaLabel = input('Tabs');
  readonly tabChange = output<string>();
}
