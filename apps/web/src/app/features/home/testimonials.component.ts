import { Component } from '@angular/core';
import { TESTIMONIALS } from './home.data';
import { SectionHeader } from './section-header.component';

@Component({
  selector: 'na-testimonials',
  imports: [SectionHeader],
  template: `
    <section class="section" id="reviews" aria-labelledby="reviews-title">
      <na-section-header
        eyebrow="From our guests"
        title="Loved in every cabin"
        headingId="reviews-title"
        subtitle="Over two million reviews, averaging 4.8 out of 5."
      />

      <div class="grid">
        @for (t of testimonials; track t.name) {
          <figure class="quote">
            <div
              class="quote__stars"
              role="img"
              [attr.aria-label]="'Rated ' + t.rating + ' out of 5 stars'"
            >
              @for (star of stars; track star) {
                <svg
                  viewBox="0 0 24 24"
                  [class.star]="true"
                  [class.star--dim]="star > t.rating"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6z"
                  />
                </svg>
              }
            </div>
            <blockquote class="quote__text">&ldquo;{{ t.quote }}&rdquo;</blockquote>
            <figcaption class="quote__meta">
              <span class="quote__avatar" aria-hidden="true">{{ initials(t.name) }}</span>
              <span>
                <span class="quote__name">{{ t.name }}</span>
                <span class="quote__route">{{ t.route }}</span>
              </span>
            </figcaption>
          </figure>
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
    .grid { display: grid; gap: var(--na-space-5); grid-template-columns: repeat(3, 1fr); }
    .quote {
      margin: 0; padding: var(--na-space-6);
      background: var(--h-surface);
      border: 1px solid var(--h-line); border-radius: 18px;
      display: flex; flex-direction: column; gap: var(--na-space-4);
      transition: transform var(--na-motion-base) var(--na-ease), border-color var(--na-motion-base) var(--na-ease);
    }
    .quote:hover { transform: translateY(-4px); border-color: var(--h-line-strong); }
    .quote__stars { display: flex; gap: 3px; }
    .star { width: 16px; height: 16px; color: var(--h-cta-bg); }
    .star--dim { color: var(--h-line-soft); }
    .quote__text {
      margin: 0; color: var(--h-text-soft);
      font-family: var(--h-font-display); font-style: italic;
      font-size: var(--na-text-lg); line-height: 1.6;
    }
    .quote__meta { display: flex; align-items: center; gap: var(--na-space-3); margin-top: auto; }
    .quote__avatar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; flex: none; border-radius: 50%;
      background: var(--h-brown-700); color: var(--h-cream); border: 1px solid var(--h-line-soft);
      font-size: var(--na-text-sm); font-weight: var(--na-font-semibold);
    }
    .quote__name { display: block; color: var(--h-text); font-weight: var(--na-font-semibold); font-size: var(--na-text-sm); }
    .quote__route { display: block; color: var(--h-text-muted); font-size: var(--na-text-xs); margin-top: 2px; }
    @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
    @media (max-width: 640px) { .section { padding: var(--na-space-12) var(--na-space-4); } }
  `,
})
export class TestimonialsSection {
  protected readonly testimonials = TESTIMONIALS;
  protected readonly stars = [1, 2, 3, 4, 5];

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('');
  }
}
