import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'cta' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'na-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="'btn btn--' + variant() + ' btn--' + size()"
      [attr.aria-busy]="loading() || null"
      (click)="clicked.emit($event)"
    >
      @if (loading()) {
        <span class="btn__spinner" aria-hidden="true"></span>
        <span class="na-visually-hidden">Loading</span>
      }
      <ng-content />
    </button>
  `,
  styles: `
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--na-space-2);
      border: 1px solid transparent; border-radius: var(--na-radius-md);
      font-weight: var(--na-font-semibold); min-height: 44px;
      transition: background var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease), color var(--na-motion-fast) var(--na-ease);
    }
    .btn--sm { padding: 0.35rem 0.8rem; font-size: var(--na-text-sm); min-height: 36px; }
    .btn--md { padding: 0.55rem 1.1rem; font-size: var(--na-text-base); }
    .btn--lg { padding: 0.8rem 1.6rem; font-size: var(--na-text-lg); }
    .btn--cta { background: var(--na-cta); color: var(--na-cta-contrast); }
    .btn--cta:hover:not(:disabled) { background: var(--na-cta-hover); }
    .btn--primary { background: var(--na-blue-600); color: var(--na-on-accent); }
    .btn--primary:hover:not(:disabled) { background: var(--na-blue-500); }
    .btn--secondary { background: transparent; color: var(--na-ink-900); border-color: var(--na-border-strong); }
    .btn--secondary:hover:not(:disabled) { border-color: var(--na-navy-300); background: var(--na-surface-sunken); }
    .btn--ghost { background: transparent; color: var(--na-blue-600); }
    .btn--ghost:hover:not(:disabled) { background: var(--na-blue-100); }
    .btn--danger { background: var(--na-danger-solid); color: #fff; }
    .btn--danger:hover:not(:disabled) { filter: brightness(0.92); }
    .btn:disabled { opacity: 0.55; }
    .btn__spinner {
      width: 1em; height: 1em; border-radius: 50%;
      border: 2px solid currentColor; border-top-color: transparent;
      animation: na-spin 0.7s linear infinite;
    }
    @keyframes na-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .btn__spinner { animation: none; } }
  `,
})
export class NaButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly clicked = output<MouseEvent>();
}
