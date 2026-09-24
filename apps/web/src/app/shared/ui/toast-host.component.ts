import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'na-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.tone }}">
          <span>{{ toast.message }}</span>
          <button type="button" aria-label="Dismiss notification" (click)="toastService.dismiss(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .host { position: fixed; bottom: var(--na-space-4); right: var(--na-space-4); display: flex; flex-direction: column; gap: var(--na-space-2); z-index: 200; max-width: min(360px, calc(100vw - 2rem)); }
    .toast {
      display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3);
      padding: var(--na-space-3) var(--na-space-4); border-radius: var(--na-radius-md);
      background: var(--na-navy-700); color: var(--na-ink-900); box-shadow: var(--na-shadow-md); font-size: var(--na-text-sm);
      border: 1px solid var(--na-border); border-left: 4px solid var(--na-blue-500);
    }
    .toast--success { border-left-color: var(--na-success); }
    .toast--warning { border-left-color: var(--na-warning); }
    .toast--danger { border-left-color: var(--na-danger); }
    .toast button { background: none; border: none; color: inherit; font-size: 1.1rem; }
  `,
})
export class NaToastHost {
  readonly toastService = inject(ToastService);
}
