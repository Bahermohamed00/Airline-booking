import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaggageService } from '../../../core/services/domain-services';
import { ToastService } from '../../../shared/ui/toast.service';
import { BAGGAGE_STATUS_MAP, statusLabel, StatusTone } from '../../../core/status-maps';
import type { Baggage, BaggageStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaTimeline, TimelineEvent } from '../../../shared/ui/timeline.component';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

type RecordableEvent = 'LOST' | 'DELAYED' | 'DELIVERED';

@Component({
  selector: 'na-admin-baggage',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState, NaTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Baggage</h1>
        <p class="page__sub">Track checked baggage and record handling events.</p>
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (items().length === 0) {
        <na-empty-state icon="◫" title="No baggage records" message="No checked baggage is currently in the system." />
      } @else {
        <div class="layout">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tag number</th>
                  <th>Type</th>
                  <th>Weight</th>
                  <th>Pieces</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (bag of items(); track bag.id) {
                  <tr
                    tabindex="0"
                    [class.row--active]="selected()?.id === bag.id"
                    (click)="select(bag)"
                    (keydown.enter)="select(bag)"
                  >
                    <td data-label="Tag number" class="na-text-mono">{{ bag.tagNumber ?? '—' }}</td>
                    <td data-label="Type">{{ bag.type }}</td>
                    <td data-label="Weight">{{ bag.weightKg != null ? bag.weightKg + ' kg' : '—' }}</td>
                    <td data-label="Pieces">{{ bag.pieces }}</td>
                    <td data-label="Status">
                      <na-badge [tone]="statusLabel(BAGGAGE_STATUS_MAP, bag.status).tone">
                        {{ statusLabel(BAGGAGE_STATUS_MAP, bag.status).label }}
                      </na-badge>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (selected(); as bag) {
            <aside class="panel na-card" aria-label="Baggage details">
              <header class="panel__head">
                <h2 class="panel__title na-text-mono">{{ bag.tagNumber }}</h2>
                <button type="button" class="panel__close" aria-label="Close baggage details" (click)="selected.set(null)">×</button>
              </header>

              <h3 class="panel__section">Event history</h3>
              <na-timeline [events]="timelineOf(bag)" />

              <h3 class="panel__section">Record event</h3>
              <form (ngSubmit)="recordEvent(bag)">
                <div class="na-field">
                  <label class="na-label" for="event-type">Event type</label>
                  <select id="event-type" class="na-select" [ngModel]="eventType()" (ngModelChange)="eventType.set($event)" name="eventType">
                    @for (opt of eventOptions; track opt) {
                      <option [value]="opt">{{ statusLabel(BAGGAGE_STATUS_MAP, opt).label }}</option>
                    }
                  </select>
                </div>
                <div class="na-field">
                  <label class="na-label" for="event-location">Location</label>
                  <input
                    id="event-location"
                    class="na-input"
                    placeholder="e.g. JFK Baggage Services"
                    required
                    [ngModel]="eventLocation()"
                    (ngModelChange)="eventLocation.set($event)"
                    name="eventLocation"
                  />
                </div>
                <na-button variant="primary" type="submit" size="sm">Record event</na-button>
              </form>
            </aside>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .layout { display: grid; grid-template-columns: 1fr 360px; gap: var(--na-space-5); align-items: start; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    tbody tr { cursor: pointer; transition: background var(--na-motion-fast); }
    tbody tr:hover { background: var(--na-blue-100); }
    tbody tr:focus-visible { outline: 2px solid var(--na-blue-600); outline-offset: -2px; }
    .row--active { background: var(--na-blue-100); }
    .panel { padding: var(--na-space-5); position: sticky; top: var(--na-space-4); }
    .panel__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-2); }
    .panel__title { font-size: var(--na-text-lg); }
    .panel__close { background: none; border: none; font-size: 1.4rem; color: var(--na-ink-500); min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md); }
    .panel__close:hover { background: var(--na-surface-sunken); color: var(--na-ink-900); }
    .panel__section { font-size: var(--na-text-base); margin: var(--na-space-5) 0 var(--na-space-3); }
    @media (max-width: 1023px) {
      .layout { grid-template-columns: 1fr; }
      .panel { position: static; }
    }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminBaggagePage {
  private readonly baggageService = inject(BaggageService);
  private readonly toast = inject(ToastService);

  readonly BAGGAGE_STATUS_MAP = BAGGAGE_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Admin', link: '/admin/dashboard' },
    { label: 'Baggage' },
  ];

  readonly eventOptions: RecordableEvent[] = ['LOST', 'DELAYED', 'DELIVERED'];

  readonly loading = signal(true);
  readonly items = signal<Baggage[]>([]);
  readonly selected = signal<Baggage | null>(null);
  readonly eventType = signal<RecordableEvent>('DELIVERED');
  readonly eventLocation = signal('');

  constructor() {
    this.baggageService.adminList().subscribe((list) => {
      this.items.set(list.map((b) => ({ ...b, events: [...b.events] })));
      this.loading.set(false);
    });
  }

  select(bag: Baggage): void {
    this.selected.set(this.selected()?.id === bag.id ? null : bag);
  }

  timelineOf(bag: Baggage): TimelineEvent[] {
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

  recordEvent(bag: Baggage): void {
    const location = this.eventLocation().trim();
    if (!location) {
      this.toast.error('A location is required to record an event.');
      return;
    }
    const type = this.eventType();
    const updated: Baggage = {
      ...bag,
      status: type as BaggageStatus,
      events: [
        ...bag.events,
        {
          id: crypto.randomUUID(),
          baggageId: bag.id,
          eventType: type,
          location,
          occurredAt: new Date().toISOString(),
        },
      ],
    };
    this.items.update((list) => list.map((b) => (b.id === bag.id ? updated : b)));
    this.selected.set(updated);
    this.eventLocation.set('');
    this.toast.success(
      `${statusLabel(BAGGAGE_STATUS_MAP, type).label} recorded for ${bag.tagNumber} at ${location}.`,
    );
  }
}
