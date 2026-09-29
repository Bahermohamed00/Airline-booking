import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'na-quantity-stepper',
  template: `
    <span class="qs__label" [id]="labelId">{{ label() }}</span>
    <div class="qs__group" role="group" [attr.aria-labelledby]="labelId">
      <button
        type="button"
        class="qs__btn"
        [attr.aria-label]="'Decrease ' + label()"
        [disabled]="atMin()"
        (click)="bump(-1)"
      >−</button>
      <span class="qs__count" aria-live="polite">{{ value() }}</span>
      <button
        type="button"
        class="qs__btn"
        [attr.aria-label]="'Increase ' + label()"
        [disabled]="atMax()"
        (click)="bump(1)"
      >+</button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--na-space-1); }
    .qs__label { font-size: var(--na-text-sm); color: var(--na-ink-700); }
    .qs__group { display: inline-flex; align-items: center; gap: var(--na-space-2); }
    .qs__btn {
      width: 40px; height: 40px; border-radius: var(--na-radius-md);
      border: 1px solid var(--na-border-strong); background: var(--na-surface-sunken);
      color: var(--na-ink-900); font-size: var(--na-text-lg); font-weight: var(--na-font-semibold);
    }
    .qs__btn:hover:not(:disabled) { border-color: var(--na-navy-300); }
    .qs__btn:disabled { opacity: 0.55; }
    .qs__count { min-width: 2ch; text-align: center; font-weight: var(--na-font-semibold); color: var(--na-ink-900); }
  `,
})
export class NaQuantityStepper {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input(0);
  readonly max = input(9);
  readonly valueChange = output<number>();

  protected readonly labelId = `na-qs-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly atMin = computed(() => this.value() <= this.min());
  protected readonly atMax = computed(() => this.value() >= this.max());

  protected bump(delta: number): void {
    const next = Math.min(this.max(), Math.max(this.min(), this.value() + delta));
    if (next !== this.value()) this.valueChange.emit(next);
  }
}
