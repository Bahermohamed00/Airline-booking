import { Component, input } from '@angular/core';

@Component({
  selector: 'na-section-header',
  template: `
    <p class="eyebrow">{{ eyebrow() }}</p>
    <h2 [id]="headingId()" class="title">{{ title() }}</h2>
    @if (subtitle()) {
      <p class="subtitle">{{ subtitle() }}</p>
    }
  `,
  styles: `
    :host { display: block; max-width: 36rem; margin-bottom: var(--na-space-10); }
    .eyebrow {
      color: var(--h-text-muted);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.22em; text-transform: uppercase;
      margin-bottom: var(--na-space-3);
    }
    .title {
      font-family: var(--h-font-display);
      font-size: clamp(1.9rem, 4vw, 2.75rem);
      color: var(--h-text);
      margin-bottom: var(--na-space-3);
    }
    .subtitle { color: var(--h-text-soft); line-height: 1.65; }
  `,
})
export class SectionHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly headingId = input.required<string>();
  readonly subtitle = input<string>();
}
