import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'na-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (i of rows(); track i) {
      <div class="sk" [style.height]="height()" [style.width]="width()" aria-hidden="true"></div>
    }
    <span class="na-visually-hidden">Loading…</span>
  `,
  styles: `
    .sk {
      border-radius: var(--na-radius-md);
      background: linear-gradient(90deg, var(--na-surface-sunken) 25%, var(--na-border) 50%, var(--na-surface-sunken) 75%);
      background-size: 200% 100%;
      animation: na-shimmer 1.4s infinite;
      margin-bottom: var(--na-space-3);
    }
    @keyframes na-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
  `,
})
export class NaSkeleton {
  readonly rows = input<number[]>([1]);
  readonly height = input('1rem');
  readonly width = input('100%');
}
