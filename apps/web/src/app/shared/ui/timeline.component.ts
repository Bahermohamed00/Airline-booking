import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { StatusTone } from '../../core/status-maps';

export interface TimelineEvent {
  label: string;
  detail?: string;
  timestamp?: string;
  tone?: StatusTone;
}

@Component({
  selector: 'na-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline">
      @for (event of events(); track event.label + (event.timestamp ?? '')) {
        <li class="timeline__item">
          <span class="timeline__dot timeline__dot--{{ event.tone ?? 'info' }}" aria-hidden="true"></span>
          <div>
            <p class="timeline__label">{{ event.label }}</p>
            @if (event.detail) { <p class="timeline__detail">{{ event.detail }}</p> }
            @if (event.timestamp) { <time class="timeline__time">{{ event.timestamp }}</time> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline { list-style: none; margin: 0; padding: 0; }
    .timeline__item { display: flex; gap: var(--na-space-3); padding-bottom: var(--na-space-4); position: relative; }
    .timeline__item:not(:last-child)::before {
      content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: var(--na-border);
    }
    .timeline__dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; background: var(--na-blue-500); }
    .timeline__dot--success { background: var(--na-success); }
    .timeline__dot--warning { background: var(--na-warning); }
    .timeline__dot--danger { background: var(--na-danger); }
    .timeline__dot--neutral { background: var(--na-ink-300); }
    .timeline__label { font-weight: var(--na-font-medium); }
    .timeline__detail { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .timeline__time { color: var(--na-ink-300); font-size: var(--na-text-xs); }
  `,
})
export class NaTimeline {
  readonly events = input.required<TimelineEvent[]>();
}
