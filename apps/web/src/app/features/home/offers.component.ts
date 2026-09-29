import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OFFERS } from './home.data';
import type { Offer } from './home.models';
import { SectionHeader } from './section-header.component';
import { daysFromNow } from './date-input';

@Component({
  selector: 'na-offers',
  imports: [RouterLink, SectionHeader, NgOptimizedImage],
  template: `
    <section class="section" id="offers" aria-labelledby="offers-title">
      <na-section-header
        eyebrow="Limited-time fares"
        title="Featured offers"
        headingId="offers-title"
        subtitle="Premium cabins and city breaks at fares that will not wait around."
      />

      <div class="grid">
        @if (featured; as f) {
          <article class="offer offer--featured">
            <div class="offer__media" aria-hidden="true">
              @if (f.image; as img) {
                <img
                  [ngSrc]="img"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1000px) 100vw, 62vw"
                  [alt]="f.title"
                  class="offer__img"
                />
              }
              <span class="offer__scrim"></span>
            </div>

            <span class="offer__badge">
              <strong>{{ discountOf(f) }}</strong>
              <small>{{ cabinOf(f) }}</small>
            </span>

            <div class="offer__body">
              <p class="offer__route">
                <span class="offer__ep">
                  <span class="offer__code">{{ f.origin }}</span>
                  <span class="offer__city">{{ cityOf(f, 0) }}</span>
                </span>
                <span class="offer__path" aria-hidden="true">
                  <span class="offer__path-line"></span>
                  <svg viewBox="0 0 24 24" fill="currentColor" class="offer__plane">
                    <path
                      d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5.5l8 2.5z"
                    />
                  </svg>
                  <span class="offer__path-line"></span>
                </span>
                <span class="offer__ep offer__ep--to">
                  <span class="offer__code">{{ f.destination }}</span>
                  <span class="offer__city">{{ cityOf(f, 1) }}</span>
                </span>
              </p>

              <h3 class="offer__title">{{ f.title }}</h3>
              <p class="offer__desc">{{ f.description }}</p>

              <div class="offer__foot">
                <p class="offer__pricing">
                  <span class="offer__from">From</span>
                  <span class="offer__price">€{{ f.price }}</span>
                  <s class="offer__old">€{{ f.oldPrice }}</s>
                  <span class="offer__cabin">{{ cabinLabel(f.cabin) }}</span>
                </p>
                <a
                  routerLink="/results"
                  [queryParams]="paramsFor(f)"
                  class="offer__cta"
                  [attr.aria-label]="'Explore offer: ' + f.routeLabel + ', ' + cabinLabel(f.cabin) + ', from €' + f.price"
                >
                  Explore offer
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
          </article>
        }

        <div class="side">
          @for (o of secondary; track o.title) {
            <article class="offer offer--secondary">
              <div class="offer__band" aria-hidden="true">
                @if (o.image; as img) {
                  <img
                    [ngSrc]="img"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 30vw"
                    [alt]="o.title"
                    class="offer__band-img"
                  />
                }
                <span class="offer__band-scrim"></span>
                <span class="offer__tag">{{ o.badge }}</span>
              </div>
              <div class="offer__content">
                <p class="offer__route--secondary">{{ o.origin }} → {{ o.destination }} · {{ cityOf(o, 1) }}</p>
                <h3 class="offer__title--secondary">{{ o.title }}</h3>
                <div class="offer__pricing--secondary">
                  <span class="offer__price--secondary">€{{ o.price }}</span>
                  <s class="offer__old--secondary">€{{ o.oldPrice }}</s>
                </div>
                <a
                  routerLink="/results"
                  [queryParams]="paramsFor(o)"
                  class="offer__cta--secondary"
                  [attr.aria-label]="'Explore offer: ' + o.routeLabel + ', from €' + o.price"
                >
                  Explore offer
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .section {
      max-width: 1200px; margin: 0 auto;
      padding: var(--na-space-16) var(--na-space-6);
      scroll-margin-top: 84px;
    }
    .grid { display: grid; gap: var(--na-space-6); grid-template-columns: 1.6fr 1fr; align-items: stretch; }
    .side { display: grid; gap: var(--na-space-6); grid-template-rows: 1fr 1fr; min-width: 0; }

    .offer {
      position: relative; overflow: hidden;
      display: flex; flex-direction: column;
      border-radius: 20px;
      transition: transform var(--na-motion-base) var(--na-ease), box-shadow var(--na-motion-base) var(--na-ease), border-color var(--na-motion-base) var(--na-ease);
    }

    /* ---------- Featured — cinematic editorial photo card ---------- */
    .offer--featured {
      // On-photo text uses the home constant cream family in both themes.
      --of-text: var(--h-cream);
      --of-text-soft: var(--h-cream-soft);
      --of-text-muted: var(--h-cream-muted);
      --of-line: var(--h-onphoto-line-strong);
      min-height: 540px;
      border: 1px solid var(--h-onphoto-line);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      background: var(--h-brown-900);
    }
    .offer--featured:hover { transform: translateY(-4px); box-shadow: 0 32px 80px rgba(0, 0, 0, 0.55); }
    .offer__media { position: absolute; inset: 0; z-index: 0; }
    .offer__img {
      object-fit: cover; object-position: center 32%;
      transition: transform 900ms var(--na-ease);
    }
    .offer--featured:hover .offer__img { transform: scale(1.03); }
    .offer__scrim {
      position: absolute; inset: 0;
      background:
        linear-gradient(90deg, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.42) 42%, rgba(0, 0, 0, 0.08) 68%, transparent 85%),
        linear-gradient(0deg, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.35) 40%, transparent 62%);
    }
    .offer__badge {
      position: absolute; top: var(--na-space-6); left: var(--na-space-6); z-index: 2;
      display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
      background: var(--h-cream); color: var(--h-brown-900);
      padding: var(--na-space-2) var(--na-space-4);
      border-radius: var(--na-radius-md);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }
    .offer__badge strong {
      font-family: var(--h-font-display); font-size: var(--na-text-xl);
      font-weight: 700; line-height: 1.1;
    }
    .offer__badge small {
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.18em; text-transform: uppercase;
    }
    .offer__body {
      position: relative; z-index: 1; margin-top: auto;
      display: flex; flex-direction: column; align-items: flex-start;
      padding: var(--na-space-8);
      max-width: 560px;
    }
    .offer__route {
      display: flex; align-items: center; gap: var(--na-space-4);
      margin: 0 0 var(--na-space-5);
    }
    .offer__ep { display: flex; flex-direction: column; }
    .offer__ep--to { text-align: right; }
    .offer__code {
      font-family: var(--h-font-display); font-weight: 700;
      font-size: clamp(1.75rem, 1rem + 2vw, 2.6rem); line-height: 1;
      color: var(--of-text); letter-spacing: 0.02em;
    }
    .offer__city {
      color: var(--of-text-muted); font-size: var(--na-text-xs);
      letter-spacing: 0.14em; text-transform: uppercase; margin-top: var(--na-space-1);
    }
    .offer__path {
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      min-width: 90px; color: var(--of-text-muted);
    }
    .offer__path-line { flex: 1; width: 34px; height: 1px; background: var(--of-line); }
    .offer__plane { width: 15px; height: 15px; flex: none; transform: rotate(45deg); color: var(--of-text); }
    .offer__title {
      font-family: var(--h-font-display); font-weight: 700;
      font-size: clamp(1.6rem, 1rem + 1.6vw, var(--na-text-3xl));
      color: var(--of-text); margin-bottom: var(--na-space-3);
    }
    .offer__desc {
      color: var(--of-text-soft); font-size: var(--na-text-base); line-height: 1.7;
      max-width: 46ch; margin-bottom: var(--na-space-6);
    }
    .offer__foot {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: var(--na-space-5); width: 100%; flex-wrap: wrap;
    }
    .offer__pricing { display: flex; align-items: baseline; gap: var(--na-space-3); margin: 0; flex-wrap: wrap; }
    .offer__from {
      color: var(--of-text-muted); font-size: var(--na-text-xs);
      letter-spacing: 0.14em; text-transform: uppercase;
    }
    .offer__price { font-family: var(--h-font-display); font-size: var(--na-text-3xl); font-weight: 700; color: var(--of-text); }
    .offer__old { color: var(--of-text-muted); }
    .offer__cabin { color: var(--of-text-muted); font-size: var(--na-text-xs); letter-spacing: 0.1em; text-transform: uppercase; }
    .offer__cta {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--na-space-2);
      min-height: 48px; padding: 0.7rem 1.6rem;
      background: var(--h-btn-bg); color: var(--h-btn-text);
      border-radius: var(--na-radius-full); font-weight: var(--na-font-semibold);
      transition: filter var(--na-motion-fast) var(--na-ease), transform var(--na-motion-fast) var(--na-ease);
    }
    .offer__cta svg { width: 16px; height: 16px; transition: transform var(--na-motion-fast) var(--na-ease); }
    .offer__cta:hover { text-decoration: none; filter: brightness(1.07); transform: translateY(-1px); }
    .offer__cta:hover svg { transform: translateX(3px); }

    /* ---------- Secondary — image band over adaptive content ---------- */
    .offer--secondary {
      background: var(--h-surface); border: 1px solid var(--h-line);
    }
    .offer--secondary:hover { transform: translateY(-4px); border-color: var(--h-line-strong); box-shadow: var(--na-shadow-md); }
    .offer__band { position: relative; height: 150px; flex-shrink: 0; overflow: hidden; }
    .offer__band-img { object-fit: cover; object-position: center 40%; transition: transform 600ms var(--na-ease); }
    .offer--secondary:hover .offer__band-img { transform: scale(1.04); }
    .offer__band-scrim {
      position: absolute; inset: 0;
      background: linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0%, transparent 55%);
    }
    .offer__tag {
      position: absolute; top: var(--na-space-3); left: var(--na-space-3);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--h-brown-900); background: var(--h-cream);
      padding: 0.3rem 0.75rem; border-radius: var(--na-radius-full);
    }
    .offer__content {
      display: flex; flex-direction: column; align-items: flex-start; flex: 1;
      padding: var(--na-space-5);
    }
    .offer__route--secondary {
      color: var(--h-text-muted); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: var(--na-space-2);
    }
    .offer__title--secondary {
      font-family: var(--h-font-display); color: var(--h-text);
      font-size: var(--na-text-xl); margin-bottom: var(--na-space-4);
    }
    .offer__pricing--secondary {
      display: flex; align-items: baseline; gap: var(--na-space-3);
      margin-top: auto; margin-bottom: var(--na-space-4);
    }
    .offer__price--secondary { font-family: var(--h-font-display); color: var(--h-text); font-size: var(--na-text-2xl); font-weight: 700; }
    .offer__old--secondary { color: var(--h-text-muted); }
    .offer__cta--secondary {
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      min-height: 44px; padding: 0.55rem 1.25rem;
      border: 1px solid var(--h-line-strong); border-radius: var(--na-radius-full);
      color: var(--h-text); font-weight: var(--na-font-semibold); font-size: var(--na-text-sm);
      transition: background var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease);
    }
    .offer__cta--secondary svg { width: 15px; height: 15px; transition: transform var(--na-motion-fast) var(--na-ease); }
    .offer__cta--secondary:hover { background: var(--h-surface-raised); text-decoration: none; }
    .offer__cta--secondary:hover svg { transform: translateX(3px); }

    /* ---------- Responsive ---------- */
    @media (max-width: 1000px) {
      .grid { grid-template-columns: 1fr; }
      .side { grid-template-rows: none; grid-template-columns: 1fr 1fr; }
      .offer--featured { min-height: 480px; }
    }
    @media (max-width: 640px) {
      .section { padding: var(--na-space-12) var(--na-space-4); }
      .side { grid-template-columns: 1fr; }
      // Intentional mobile composition: image band on top, content on the page surface.
      .offer--featured {
        --of-text: var(--h-text);
        --of-text-soft: var(--h-text-soft);
        --of-text-muted: var(--h-text-muted);
        --of-line: var(--h-line-strong);
        min-height: 0; background: var(--h-surface); border-color: var(--h-line);
        box-shadow: var(--na-shadow-md);
      }
      .offer__media { position: relative; inset: auto; aspect-ratio: 16 / 10; }
      .offer__scrim { background: linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0%, transparent 45%); }
      .offer__badge { top: var(--na-space-4); left: var(--na-space-4); }
      .offer__body { padding: var(--na-space-6); max-width: none; }
      .offer__desc { font-size: var(--na-text-sm); }
      .offer__cta {
        width: 100%;
        // Content sits on the page surface here — use the adaptive CTA pair
        // (cream in dark theme, deep brown in light theme).
        background: var(--h-cta-bg); color: var(--h-cta-text);
      }
      .offer__band { height: auto; aspect-ratio: 16 / 9; }
    }
    @media (prefers-reduced-motion: reduce) {
      .offer, .offer__cta, .offer__img, .offer__band-img, .offer__cta svg, .offer__cta--secondary svg { transition: none; }
      .offer:hover, .offer__cta:hover { transform: none; }
      .offer--featured:hover .offer__img, .offer--secondary:hover .offer__band-img { transform: none; }
    }
  `,
})
export class OffersSection {
  protected readonly featured = OFFERS.find((o) => o.featured);
  protected readonly secondary = OFFERS.filter((o) => !o.featured);
  private readonly departDate = daysFromNow(21);

  protected cabinLabel(cabin: string): string {
    return cabin === 'BUSINESS' ? 'Business class' : 'Economy';
  }

  protected cabinOf(o: Offer): string {
    return o.cabin.charAt(0) + o.cabin.slice(1).toLowerCase();
  }

  protected discountOf(o: Offer): string {
    const pct = Math.round((1 - o.price / o.oldPrice) * 100);
    return `−${pct}%`;
  }

  protected cityOf(o: Offer, index: 0 | 1): string {
    return o.routeLabel.split('→')[index]?.trim() ?? '';
  }

  protected paramsFor(o: Offer): Record<string, string | number> {
    return {
      tripType: 'ONE_WAY',
      origin: o.origin,
      destination: o.destination,
      depart: this.departDate,
      adults: 1,
      children: 0,
      infants: 0,
      cabin: o.cabin,
    };
  }
}
