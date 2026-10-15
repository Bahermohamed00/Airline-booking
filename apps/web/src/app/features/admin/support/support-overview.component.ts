import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminSupportService, type SupportOverview } from './admin-support.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

interface OverviewCard {
  key: string;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}

/**
 * Support Staff overview — support-specific statistics only (tickets and
 * unread customer messages). Deliberately NOT the general Admin Overview:
 * no users, revenue, flights, or payments.
 */
@Component({
  selector: 'na-admin-support-overview',
  imports: [RouterLink, NaBreadcrumbs, NaButton, NaSkeleton],
  templateUrl: './support-overview.component.html',
  styleUrl: './support-overview.component.css',
})
export class AdminSupportOverviewPage {
  private readonly service = inject(AdminSupportService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly stats = signal<SupportOverview | null>(null);

  readonly cards = signal<OverviewCard[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.overview().subscribe({
      next: (o) => {
        this.stats.set(o);
        this.cards.set([
          { key: 'total', label: 'Total tickets', value: o.total, hint: 'All support requests' },
          { key: 'open', label: 'Open tickets', value: o.open, hint: 'Waiting to be claimed' },
          {
            key: 'unread',
            label: 'Unread messages',
            value: o.unreadMessages,
            hint: 'Customer messages awaiting review',
            accent: o.unreadMessages > 0,
          },
          { key: 'inProgress', label: 'In progress', value: o.inProgress, hint: 'Being handled' },
          { key: 'resolved', label: 'Resolved', value: o.resolved, hint: 'Awaiting closure or reopen' },
          { key: 'closed', label: 'Closed', value: o.closed, hint: 'Completed tickets' },
        ]);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load the support overview.'));
        this.loading.set(false);
      },
    });
  }
}
