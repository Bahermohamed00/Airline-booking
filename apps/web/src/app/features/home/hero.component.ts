import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { scrollToSection } from '../../shared/utils/scroll-to-section';

@Component({
  selector: 'na-hero',
  imports: [NgOptimizedImage],
  template: `
    <section class="hero" id="top" aria-labelledby="hero-title">
      <div class="hero__bg" aria-hidden="true">
        <img
          ngSrc="assets/img/hero-wing.jpg"
          fill
          priority
          sizes="100vw"
          alt=""
          class="hero__img"
        />
        <div class="hero__scrim"></div>
      </div>

      <div class="hero__content">
        <p class="hero__eyebrow">Premium air travel, reimagined</p>
        <h1 id="hero-title" class="hero__title">
          The world,<br /><em>above</em> the ordinary.
        </h1>
        <p class="hero__sub">
          Fly NovaAir to 120+ destinations across five continents. Considered cabins, honest fares,
          and service that remembers your name.
        </p>
        <div class="hero__cta">
          <a href="#book" class="btn btn--primary" (click)="go('book', $event)">
            Book your flight
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
          <a href="#destinations" class="btn btn--ghost" (click)="go('destinations', $event)">
            Explore destinations
          </a>
        </div>

        <dl class="hero__stats">
          <div class="hero__stat">
            <dt>Destinations</dt>
            <dd>120+</dd>
          </div>
          <div class="hero__stat">
            <dt>Average rating</dt>
            <dd>4.8 / 5</dd>
          </div>
          <div class="hero__stat">
            <dt>Guests each year</dt>
            <dd>25M</dd>
          </div>
        </dl>
      </div>
    </section>
  `,
  styles: `
    .hero {
      position: relative; overflow: hidden;
      min-height: 100svh; display: flex; align-items: center;
      padding: 140px var(--na-space-6) 160px;
      background: var(--h-bg);
    }
    .hero__bg { position: absolute; inset: 0; pointer-events: none; }
    .hero__img {
      object-fit: cover; object-position: center 35%;
      animation: hero-drift 14s var(--na-ease) infinite alternate;
    }
    @keyframes hero-drift {
      from { transform: scale(1); }
      to { transform: scale(1.06); }
    }
    .hero__scrim {
      position: absolute; inset: 0;
      background:
        linear-gradient(90deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.62) 42%, rgba(0, 0, 0, 0.25) 75%, rgba(0, 0, 0, 0.45) 100%),
        linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, transparent 30%, transparent 62%, var(--h-bg) 100%);
    }
    .hero__content {
      position: relative; z-index: 1;
      max-width: 1200px; margin: 0 auto; width: 100%;
      animation: hero-rise 700ms var(--na-ease) both;
    }
    @keyframes hero-rise {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .hero__eyebrow {
      color: var(--h-cream-muted);
      font-size: var(--na-text-sm); font-weight: var(--na-font-semibold);
      letter-spacing: 0.22em; text-transform: uppercase;
      margin-bottom: var(--na-space-5);
    }
    .hero__title {
      font-family: var(--h-font-display);
      font-size: clamp(2.75rem, 7vw, 5.5rem);
      line-height: 1.04; font-weight: 700; color: var(--h-cream);
      letter-spacing: -0.01em; margin-bottom: var(--na-space-6);
    }
    .hero__title em { font-style: italic; color: var(--h-cream-soft); }
    .hero__sub {
      max-width: 34rem; color: var(--h-cream-soft);
      font-size: var(--na-text-lg); line-height: 1.65;
      margin-bottom: var(--na-space-8);
    }
    .hero__cta { display: flex; flex-wrap: wrap; gap: var(--na-space-4); margin-bottom: var(--na-space-12); }
    .btn {
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      padding: 0.95rem 1.9rem; border-radius: var(--na-radius-full);
      font-weight: var(--na-font-semibold); font-size: var(--na-text-base);
      border: 1px solid transparent;
      transition: transform var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease);
    }
    .btn svg { width: 18px; height: 18px; transition: transform var(--na-motion-fast) var(--na-ease); }
    .btn--primary { background: var(--h-cream); color: var(--h-brown-900); }
    .btn--primary:hover { background: #ffffff; text-decoration: none; transform: translateY(-2px); }
    .btn--primary:hover svg { transform: translateX(3px); }
    .btn--ghost { border-color: var(--h-onphoto-line-strong); color: var(--h-cream); }
    .btn--ghost:hover { border-color: var(--h-cream); background: var(--h-hover-light); text-decoration: none; transform: translateY(-2px); }
    .hero__stats {
      display: flex; flex-wrap: wrap; gap: var(--na-space-10);
      margin: 0; padding-top: var(--na-space-8);
      border-top: 1px solid var(--h-onphoto-line);
    }
    .hero__stat dt {
      color: var(--h-cream-muted); font-size: var(--na-text-xs);
      letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: var(--na-space-1);
    }
    .hero__stat dd {
      margin: 0; font-family: var(--h-font-display);
      font-size: var(--na-text-2xl); font-weight: 700; color: var(--h-cream);
    }
    @media (max-width: 900px) {
      .hero { padding: 120px var(--na-space-4) 120px; min-height: auto; }
      .hero__stats { gap: var(--na-space-6); }
    }
    @media (prefers-reduced-motion: reduce) {
      .hero__img, .hero__content { animation: none; }
    }
  `,
})
export class HeroSection {
  protected go(target: string, event: Event): void {
    scrollToSection(target, event);
  }
}
