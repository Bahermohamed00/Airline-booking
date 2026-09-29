import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NaEmptyState } from '../../shared/ui/empty-state.component';

@Component({
  selector: 'app-denied',
  standalone: true,
  imports: [NaEmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="denied">
      <na-empty-state
        icon="🔒"
        title="Access restricted"
        message="Your current staff role does not include permission to view this module. Contact a Super Admin to request access."
      />
      <a class="denied__action" routerLink="/admin/dashboard">Back to overview</a>
    </section>
  `,
  styles: `
    .denied { display: flex; flex-direction: column; align-items: center; }
    .denied__action {
      display: inline-flex; align-items: center; justify-content: center;
      margin-top: calc(-1 * var(--na-space-8));
      padding: 0.55rem 1.1rem; min-height: 44px;
      background: var(--na-blue-600); color: var(--na-on-accent);
      border-radius: var(--na-radius-md); font-weight: var(--na-font-semibold);
      transition: background var(--na-motion-fast) var(--na-ease);
    }
    .denied__action:hover { background: var(--na-blue-500); text-decoration: none; }
    .denied__action:focus-visible { outline: none; box-shadow: var(--na-focus-ring); }
  `,
})
export class DeniedPage {}
