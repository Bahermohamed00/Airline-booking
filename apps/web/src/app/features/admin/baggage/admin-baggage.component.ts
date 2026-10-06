import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminBaggageService, type AdminBaggage } from './admin-baggage.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { BAGGAGE_STATUS_MAP, statusLabel, StatusTone } from '../../../core/status-maps';
import type { BaggageStatus } from '../../../core/models/domain.model';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaTimeline, TimelineEvent } from '../../../shared/ui/timeline.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

type RecordableEvent = 'LOST' | 'DELAYED' | 'DELIVERED';

@Component({
  selector: 'na-admin-baggage',
  standalone: true,
  imports: [
    FormsModule,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaSkeleton,
    NaEmptyState,
    NaAlert,
    NaTimeline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-baggage.component.html',
  styleUrl: './admin-baggage.component.css',
})
export class AdminBaggagePage {
  private readonly baggageService = inject(AdminBaggageService);
  private readonly toast = inject(ToastService);

  readonly BAGGAGE_STATUS_MAP = BAGGAGE_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Baggage' }];

  readonly eventOptions: RecordableEvent[] = ['LOST', 'DELAYED', 'DELIVERED'];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<AdminBaggage[]>([]);
  readonly selected = signal<AdminBaggage | null>(null);
  readonly eventType = signal<RecordableEvent>('DELIVERED');
  readonly eventLocation = signal('');

  constructor() {
    this.loadBags();
  }

  loadBags(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.baggageService.adminList().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(toErrorMessage(err, 'Could not load baggage records.'));
        this.loading.set(false);
      },
    });
  }

  select(bag: AdminBaggage): void {
    this.selected.set(this.selected()?.id === bag.id ? null : bag);
  }

  timelineOf(bag: AdminBaggage): TimelineEvent[] {
    return [...bag.events]
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .map((e) => {
        const presentation = statusLabel(BAGGAGE_STATUS_MAP, e.eventType);
        return {
          label: presentation.label,
          detail: e.location ?? undefined,
          timestamp: DATE_TIME.format(new Date(e.occurredAt)),
          tone: presentation.tone as StatusTone,
        };
      });
  }

  recordEvent(bag: AdminBaggage): void {
    const location = this.eventLocation().trim();
    if (!location) {
      this.toast.error('A location is required to record an event.');
      return;
    }
    const type = this.eventType();
    this.baggageService.recordEvent(bag.id, type, location).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
        this.selected.set(updated);
        this.eventLocation.set('');
        this.toast.success(
          `${statusLabel(BAGGAGE_STATUS_MAP, type).label} recorded for ${bag.tagNumber} at ${location}.`,
        );
      },
      error: (err) => {
        this.toast.error(toErrorMessage(err, 'Could not record the event.'));
      },
    });
  }
}
