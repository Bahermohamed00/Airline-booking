import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StepItem {
  id: string;
  label: string;
}

@Component({
  selector: 'na-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="stepper" aria-label="Booking progress">
      @for (step of steps(); track step.id; let i = $index) {
        <li
          class="step"
          [class.step--done]="i < currentIndex()"
          [class.step--current]="i === currentIndex()"
          [attr.aria-current]="i === currentIndex() ? 'step' : null"
        >
          <span class="step__dot" aria-hidden="true">{{ i < currentIndex() ? '✓' : i + 1 }}</span>
          <span class="step__label">{{ step.label }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .stepper { display: flex; list-style: none; padding: 0; margin: 0 0 var(--na-space-6); gap: 0; flex-wrap: wrap; }
    .step { display: flex; align-items: center; gap: var(--na-space-2); flex: 1; min-width: 90px; color: var(--na-ink-300); font-size: var(--na-text-sm); position: relative; }
    .step:not(:last-child)::after { content: ''; flex: 1; height: 2px; background: var(--na-border); margin: 0 var(--na-space-2); min-width: 12px; }
    .step__dot {
      width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      background: var(--na-surface-sunken); border: 2px solid var(--na-border-strong); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); flex-shrink: 0;
    }
    .step--done { color: var(--na-success); }
    .step--done .step__dot { background: var(--na-success); border-color: var(--na-success); color: var(--na-on-success); }
    .step--current { color: var(--na-blue-600); font-weight: var(--na-font-semibold); }
    .step--current .step__dot { border-color: var(--na-blue-600); color: var(--na-blue-600); background: var(--na-blue-100); }
    @media (max-width: 639px) {
      .step__label { display: none; }
      .step--current .step__label { display: inline; }
      .step { flex: 0 1 auto; min-width: 0; }
    }
  `,
})
export class NaStepper {
  readonly steps = input.required<StepItem[]>();
  readonly currentIndex = input.required<number>();
}
