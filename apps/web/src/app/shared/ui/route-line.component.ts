import { Component, input } from '@angular/core';

/**
 * Aviation route visualization: IATA codes joined by a route line with a
 * plane marker. Use wherever a journey origin/destination is displayed so
 * every page shares the same visual language. Token-driven (both themes).
 */
@Component({
  selector: 'na-route-line',
  template: `
    <span class="rl" [class.rl--lg]="size() === 'lg'">
      <span class="rl__point">
        <span class="rl__code">{{ origin() }}</span>
        @if (originCity()) {
          <span class="rl__city">{{ originCity() }}</span>
        }
      </span>
      <span class="rl__path" aria-hidden="true">
        <span class="rl__dot"></span>
        <span class="rl__line"></span>
        <svg viewBox="0 0 24 24" fill="currentColor" class="rl__plane">
          <path
            d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5.5l8 2.5z"
          />
        </svg>
        <span class="rl__line"></span>
        <span class="rl__dot"></span>
      </span>
      <span class="rl__point rl__point--to">
        <span class="rl__code">{{ destination() }}</span>
        @if (destinationCity()) {
          <span class="rl__city">{{ destinationCity() }}</span>
        }
      </span>
      <span class="na-visually-hidden">{{ origin() }} to {{ destination() }}</span>
    </span>
  `,
  styles: `
    .rl { display: inline-flex; align-items: center; gap: var(--na-space-4); min-width: 0; }
    .rl__point { display: flex; flex-direction: column; min-width: 0; }
    .rl__point--to { text-align: right; }
    .rl__code {
      font-family: var(--na-font-display); font-weight: var(--na-font-bold);
      font-size: var(--na-text-xl); line-height: 1.1; color: var(--na-ink-900);
      letter-spacing: 0.02em;
    }
    .rl--lg .rl__code { font-size: clamp(var(--na-text-2xl), 1rem + 2vw, var(--na-text-3xl)); }
    .rl__city { color: var(--na-ink-500); font-size: var(--na-text-sm); margin-top: 2px; }
    .rl__path {
      flex: 1 1 72px; min-width: 56px; max-width: 180px;
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      color: var(--na-ink-500);
    }
    .rl__dot {
      width: 6px; height: 6px; border-radius: 50%; flex: none;
      background: var(--na-ink-500);
    }
    .rl__line { flex: 1; height: 1px; background: var(--na-border-strong); }
    .rl__plane { width: 16px; height: 16px; flex: none; transform: rotate(45deg); color: var(--na-blue-600); }
    @media (max-width: 640px) {
      .rl { gap: var(--na-space-3); }
      .rl__city { font-size: var(--na-text-xs); }
    }
  `,
})
export class NaRouteLine {
  readonly origin = input.required<string>();
  readonly destination = input.required<string>();
  readonly originCity = input<string | null>(null);
  readonly destinationCity = input<string | null>(null);
  readonly size = input<'md' | 'lg'>('md');
}
