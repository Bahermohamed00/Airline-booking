import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegmentOption {
  value: string;
  label: string;
}

@Component({
  selector: 'na-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="group" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          class="seg__btn"
          [class.seg__btn--active]="option.value === value()"
          [attr.aria-pressed]="option.value === value()"
          (click)="valueChange.emit(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .seg { display: inline-flex; flex-wrap: wrap; background: var(--na-surface-sunken); border-radius: var(--na-radius-md); padding: 3px; gap: 2px; }
    .seg__btn {
      border: none; background: transparent; padding: 0.45rem 1rem; border-radius: var(--na-radius-sm);
      font-weight: var(--na-font-medium); color: var(--na-ink-500); min-height: 40px;
    }
    .seg__btn--active { background: var(--na-surface-raised); color: var(--na-ink-900); box-shadow: var(--na-shadow-sm); font-weight: var(--na-font-semibold); }
    @media (max-width: 400px) {
      .seg { display: flex; width: 100%; }
      .seg__btn { flex: 1 1 0; min-width: 0; padding: 0.45rem 0.4rem; white-space: nowrap; font-size: var(--na-text-sm); }
    }
  `,
})
export class NaSegmented {
  readonly options = input.required<SegmentOption[]>();
  readonly value = input.required<string>();
  readonly ariaLabel = input('Options');
  readonly valueChange = output<string>();
}
