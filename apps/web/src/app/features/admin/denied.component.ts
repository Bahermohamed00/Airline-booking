import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NaEmptyState } from '../../shared/ui/empty-state.component';

@Component({
  selector: 'app-denied',
  standalone: true,
  imports: [NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <na-empty-state
      icon="🔒"
      title="Access restricted"
      message="Your current staff role does not include permission to view this module. Contact a Super Admin to request access."
      actionLabel="Back to overview"
      (action)="goBack()"
    />
  `,
})
export class DeniedPage {
  goBack(): void {
    history.back();
  }
}
