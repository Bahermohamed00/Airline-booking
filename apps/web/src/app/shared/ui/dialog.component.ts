import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NaButton } from './button.component';

@Component({
  selector: 'na-dialog',
  standalone: true,
  imports: [NaButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="onBackdrop()" role="presentation"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <h3 class="dialog__title">{{ title() }}</h3>
        <div class="dialog__body"><ng-content /></div>
        <div class="dialog__actions">
          <na-button variant="secondary" (clicked)="cancelled.emit()">{{ cancelLabel() }}</na-button>
          <na-button [variant]="confirmDanger() ? 'danger' : 'primary'" (clicked)="confirmed.emit()">{{ confirmLabel() }}</na-button>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(8, 17, 32, 0.5); z-index: 100; }
    .dialog {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--na-surface-raised); border-radius: var(--na-radius-lg);
      box-shadow: var(--na-shadow-lg); padding: var(--na-space-6); z-index: 101;
      width: min(480px, calc(100vw - 2rem));
    }
    .dialog__title { margin-bottom: var(--na-space-3); }
    .dialog__body { color: var(--na-ink-700); margin-bottom: var(--na-space-6); }
    .dialog__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); }
  `,
})
export class NaDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly confirmDanger = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  onBackdrop(): void {
    this.cancelled.emit();
  }
}
