import { Component } from '@angular/core';
import { BENEFITS } from './home.data';
import { SectionHeader } from './section-header.component';

@Component({
  selector: 'na-benefits',
  imports: [SectionHeader],
  template: `
    <section class="section" id="why-us" aria-labelledby="why-title">
      <na-section-header
        eyebrow="Why NovaAir"
        title="Travel, without the trade-offs"
        headingId="why-title"
        subtitle="The details other airlines charge extra for are simply how we fly."
      />

      <div class="grid">
        @for (b of benefits; track b.title) {
          <article class="benefit">
            <span class="benefit__icon" aria-hidden="true">
              @switch (b.icon) {
                @case ('shield') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" stroke-linejoin="round" />
                    <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
                @case ('crown') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M3 8l4 4 5-6 5 6 4-4v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke-linejoin="round" />
                  </svg>
                }
                @case ('clock') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
                @case ('support') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 13a8 8 0 0 1 16 0" stroke-linecap="round" />
                    <rect x="3" y="13" width="4" height="6" rx="1.5" />
                    <rect x="17" y="13" width="4" height="6" rx="1.5" />
                    <path d="M19 19a3 3 0 0 1-3 3h-3" stroke-linecap="round" />
                  </svg>
                }
              }
            </span>
            <h3 class="benefit__title">{{ b.title }}</h3>
            <p class="benefit__desc">{{ b.description }}</p>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .section {
      max-width: 1200px; margin: 0 auto;
      padding: var(--na-space-16) var(--na-space-6);
      scroll-margin-top: 84px;
    }
    .grid { display: grid; gap: var(--na-space-5); grid-template-columns: repeat(4, 1fr); }
    .benefit {
      padding: var(--na-space-6);
      background: var(--h-surface);
      border: 1px solid var(--h-line); border-radius: 18px;
      transition: transform var(--na-motion-base) var(--na-ease), border-color var(--na-motion-base) var(--na-ease), background var(--na-motion-base) var(--na-ease);
    }
    .benefit:hover {
      transform: translateY(-4px);
      border-color: var(--h-line-strong);
      background: var(--h-surface-raised);
    }
    .benefit__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; margin-bottom: var(--na-space-5);
      color: var(--h-text); background: var(--h-surface-raised);
      border: 1px solid var(--h-line-soft); border-radius: 14px;
    }
    .benefit__icon svg { width: 26px; height: 26px; }
    .benefit__title { color: var(--h-text); font-size: var(--na-text-lg); margin-bottom: var(--na-space-2); }
    .benefit__desc { color: var(--h-text-muted); font-size: var(--na-text-sm); line-height: 1.65; }
    @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) {
      .section { padding: var(--na-space-12) var(--na-space-4); }
      .grid { grid-template-columns: 1fr; }
    }
  `,
})
export class BenefitsSection {
  protected readonly benefits = BENEFITS;
}
