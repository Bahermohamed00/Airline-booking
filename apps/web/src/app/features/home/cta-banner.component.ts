import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { scrollToSection } from '../../shared/utils/scroll-to-section';

@Component({
  selector: 'na-cta-banner',
  imports: [RouterLink],
  template: `
    <section class="cta" aria-labelledby="cta-title">
      <div class="cta__glow" aria-hidden="true"></div>
      <div class="cta__inner">
        <h2 id="cta-title">Your next journey begins<br /><em>above the clouds.</em></h2>
        <p class="cta__sub">
          Fares are live and seats are waiting. Book in minutes — manage everything from one place.
        </p>
        <div class="cta__actions">
          <a href="#book" class="btn btn--primary" (click)="go('book', $event)">
            Book your flight
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
          <a routerLink="/register" class="btn btn--ghost">Create a free account</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .cta {
      position: relative; overflow: hidden;
      padding: var(--na-space-16) var(--na-space-6);
      text-align: center;
      border-top: 1px solid var(--h-line);
    }
    .cta__glow {
      position: absolute; left: 50%; top: 50%;
      width: 70vw; height: 70vw; max-width: 900px; max-height: 900px;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, color-mix(in srgb, var(--h-brown-700) 55%, transparent) 0%, color-mix(in srgb, var(--h-brown-900) 25%, transparent) 45%, transparent 70%);
      pointer-events: none;
    }
    .cta__inner { position: relative; max-width: 44rem; margin: 0 auto; }
    h2 {
      font-family: var(--h-font-display);
      font-size: clamp(2.25rem, 5.5vw, 3.75rem); line-height: 1.1;
      color: var(--h-text); margin-bottom: var(--na-space-5);
    }
    h2 em { font-style: italic; color: var(--h-text-soft); }
    .cta__sub { color: var(--h-text-soft); font-size: var(--na-text-lg); line-height: 1.65; margin-bottom: var(--na-space-8); }
    .cta__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--na-space-4); }
    .btn {
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      padding: 0.95rem 1.9rem; border-radius: var(--na-radius-full);
      font-weight: var(--na-font-semibold); border: 1px solid transparent;
      transition: transform var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease);
    }
    .btn svg { width: 18px; height: 18px; }
    .btn--primary { background: var(--h-cta-bg); color: var(--h-cta-text); }
    .btn--primary:hover { filter: brightness(1.08); text-decoration: none; transform: translateY(-2px); }
    .btn--ghost { border-color: var(--h-line-strong); color: var(--h-text); }
    .btn--ghost:hover { border-color: var(--h-text); background: var(--h-hover-light); text-decoration: none; transform: translateY(-2px); }
    @media (max-width: 640px) { .cta { padding: var(--na-space-12) var(--na-space-4); } }
  `,
})
export class CtaBanner {
  protected go(target: string, event: Event): void {
    scrollToSection(target, event);
  }
}
