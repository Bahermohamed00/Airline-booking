import { Component, inject } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import type { Offer } from '../home/home.models';
import { daysFromNow } from '../home/date-input';
import { scrollToSection } from '../home/scroll-to-section';
import { OFFER_PAGE_OFFERS } from './offers.data';

@Component({
  selector: 'na-offers-page',
  imports: [RouterLink, NgOptimizedImage, DatePipe],
  template: `
    <div class="na-container page">
      <section class="panel panel--hero" aria-labelledby="offers-hero-title">
        <div class="panel__media" aria-hidden="true">
          <img ngSrc="assets/img/hero-wing.jpg" fill priority sizes="100vw" alt="" class="panel__img" />
          <span class="panel__scrim"></span>
        </div>
        <div class="panel__body">
          <p class="caps caps--dim">Limited-time fares</p>
          <h1 id="offers-hero-title" class="hero__title">Offers worth packing for</h1>
          <p class="soft hero__sub">
            Handpicked one-way fares from Frankfurt — premium cabins, city breaks, and winter sun.
            Book before they are gone.
          </p>
          <div class="hero__actions">
            <a href="#all-offers" class="cta" (click)="go('all-offers', $event)">
              Browse all offers
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>
            <a routerLink="/search" class="hero__link">Search flights instead</a>
          </div>
          <ul class="stats">
            <li><strong>−30%</strong><span>Business to New York</span></li>
            <li><strong>{{ count }}</strong><span>destinations on sale</span></li>
            <li><strong>€{{ lowest }}</strong><span>lowest one-way fare</span></li>
          </ul>
        </div>
      </section>

      @if (featured; as f) {
        <article class="panel panel--featured" aria-labelledby="featured-title">
          <div class="panel__media" aria-hidden="true">
            @if (f.image; as img) {
              <img [ngSrc]="img" fill sizes="(max-width: 1000px) 100vw, 80vw" [alt]="f.title" class="panel__img" />
            }
            <span class="panel__scrim"></span>
          </div>

          <span class="badge">
            <strong>{{ discountOf(f) }}</strong>
            <small class="caps">{{ cabinOf(f) }}</small>
          </span>

          <div class="panel__body">
            <p class="caps caps--dim">Featured offer</p>
            <p class="f-route">
              <span class="f-ep">
                <span class="f-code">{{ f.origin }}</span>
                <span class="f-city caps">{{ cityOf(f, 0) }}</span>
              </span>
              <span class="f-path" aria-hidden="true">
                <span class="f-line"></span>
                <svg viewBox="0 0 24 24" fill="currentColor" class="f-plane">
                  <path
                    d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5.5l8 2.5z"
                  />
                </svg>
                <span class="f-line"></span>
              </span>
              <span class="f-ep f-ep--to">
                <span class="f-code">{{ f.destination }}</span>
                <span class="f-city caps">{{ cityOf(f, 1) }}</span>
              </span>
            </p>

            <h2 id="featured-title" class="f-title">{{ f.title }}</h2>
            <p class="soft f-desc">{{ f.description }}</p>

            <ul class="facts caps">
              <li>{{ f.perk }}</li>
              <li>Book by {{ f.bookBy | date: 'd MMM y' }}</li>
              <li>{{ f.travelWindow }}</li>
            </ul>

            <div class="f-foot">
              <p class="pricing">
                <span class="caps caps--dim">From</span>
                <span class="price price--lg">€{{ f.price }}</span>
                <s class="dim">€{{ f.oldPrice }}</s>
                <span class="caps caps--dim">{{ cabinLabel(f.cabin) }}</span>
              </p>
              <a
                routerLink="/results"
                [queryParams]="paramsFor(f)"
                class="cta"
                [attr.aria-label]="'Book offer: ' + f.routeLabel + ', ' + cabinLabel(f.cabin) + ', from €' + f.price"
              >
                Book now
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </article>
      }

      <section class="all" id="all-offers" aria-labelledby="all-offers-title">
        <header class="all__head">
          <h2 id="all-offers-title">All offers</h2>
          <p class="na-text-muted">One-way fares from Frankfurt, taxes included. New deals land every week.</p>
        </header>

        <div class="all__grid">
          @for (o of regular; track o.destination) {
            <article class="card">
              <div class="card__media" aria-hidden="true">
                @if (o.image; as img) {
                  <img
                    [ngSrc]="img"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                    [alt]="o.title"
                    class="card__img"
                  />
                }
                <span class="card__scrim"></span>
                <span class="pill pill--tag">{{ o.badge }}</span>
                <span class="pill pill--off">{{ discountOf(o) }}</span>
              </div>

              <div class="card__body">
                <p class="caps card__route">{{ o.origin }} → {{ o.destination }} · {{ cityOf(o, 1) }}</p>
                <h3 class="card__title">{{ o.title }}</h3>
                <p class="card__desc">{{ o.description }}</p>
                <p class="card__perk">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
                    <path d="M4 12.5l5 5L20 6.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ o.perk }}
                </p>
                <p class="card__validity">Book by {{ o.bookBy | date: 'd MMM y' }} · {{ o.travelWindow }}</p>

                <div class="card__foot">
                  <p class="pricing">
                    <span class="price price--md">€{{ o.price }}</span>
                    <s class="dim">€{{ o.oldPrice }}</s>
                    <span class="caps cabin">{{ cabinLabel(o.cabin) }}</span>
                  </p>
                  <a
                    routerLink="/results"
                    [queryParams]="paramsFor(o)"
                    class="cta cta--outline"
                    [attr.aria-label]="'View offer: ' + o.routeLabel + ', from €' + o.price"
                  >
                    View offer
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </article>
          }
        </div>
      </section>

      <p class="smallprint">
        Fares are one-way, per person, and include taxes and fees. Light fares include hand baggage only;
        checked baggage and seat selection may carry an additional charge. Limited seat availability at the
        advertised price — the fare shown is the lowest currently available on the route.
      </p>
    </div>
  `,
  styles: `
    // Photo panels use fixed on-photo foregrounds over the dark scrim; below 640px
    // they switch to adaptive on-surface colors (image band on top, content below).
    .page { padding: var(--na-space-8) 0 var(--na-space-16); --mv: var(--na-motion-fast) var(--na-ease); }
    .panel {
      --fg: var(--na-cream); --fg-soft: rgba(225, 220, 201, 0.82); --fg-muted: rgba(225, 220, 201, 0.64);
      --cta-bg: var(--na-cream); --cta-fg: var(--na-brown-900); --cta-h: #ffffff;
      position: relative; overflow: hidden; display: flex;
      background: var(--na-navy-800); border: 1px solid var(--na-border);
      border-radius: var(--na-radius-xl); box-shadow: var(--na-shadow-lg);
    }
    .panel--hero { min-height: 430px; }
    .panel--featured { min-height: 500px; margin-top: var(--na-space-8); }
    .panel__media { position: absolute; inset: 0; z-index: 0; }
    .panel__img { object-fit: cover; object-position: center 35%; transition: transform 900ms var(--na-ease); }
    .panel:hover .panel__img { transform: scale(1.03); }
    .panel__scrim {
      position: absolute; inset: 0;
      background:
        linear-gradient(90deg, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.42) 42%, rgba(0, 0, 0, 0.08) 68%, transparent 85%),
        linear-gradient(0deg, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.35) 40%, transparent 62%);
    }
    .panel__body {
      position: relative; z-index: 1; margin-top: auto; max-width: 620px;
      display: flex; flex-direction: column; align-items: flex-start; padding: var(--na-space-8);
    }
    .panel :is(h1, h2) { color: var(--fg); margin-top: var(--na-space-3); }
    .soft { color: var(--fg-soft); line-height: 1.65; }

    // Small uppercase label text (eyebrows, route meta, cabin tags, facts).
    .caps { font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); letter-spacing: 0.14em; text-transform: uppercase; }
    .caps--dim, .dim { color: var(--fg-muted, var(--na-ink-500)); }

    .cta {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--na-space-2);
      min-height: 48px; padding: 0.7rem 1.6rem;
      background: var(--cta-bg); color: var(--cta-fg);
      border-radius: var(--na-radius-full); font-weight: var(--na-font-semibold);
      transition: background var(--mv), transform var(--mv);
    }
    .cta svg { width: 16px; height: 16px; transition: transform var(--mv); }
    .cta:hover { text-decoration: none; background: var(--cta-h); transform: translateY(-1px); }
    .cta:hover svg { transform: translateX(3px); }
    .cta--outline {
      min-height: 44px; padding: 0.55rem 1.25rem; font-size: var(--na-text-sm);
      background: transparent; color: var(--na-ink-900); border: 1px solid var(--na-border-strong);
    }
    .cta--outline:hover { background: var(--na-blue-100); border-color: var(--na-blue-600); }

    .hero__title { font-size: clamp(2rem, 1.2rem + 3.4vw, 3.25rem); margin-bottom: var(--na-space-3); }
    .hero__sub { max-width: 46ch; margin-bottom: var(--na-space-6); }
    .hero__actions { display: flex; align-items: center; gap: var(--na-space-4); flex-wrap: wrap; margin-bottom: var(--na-space-8); }
    .hero__link { color: var(--fg); font-size: var(--na-text-sm); font-weight: var(--na-font-medium); min-height: 44px; display: inline-flex; align-items: center; }
    .stats { display: flex; gap: var(--na-space-5); flex-wrap: wrap; list-style: none; padding: 0; margin: 0; }
    .stats li { display: flex; flex-direction: column; }
    .stats strong { font: var(--na-font-bold) var(--na-text-lg)/1.15 var(--na-font-display); color: var(--fg); }
    .stats span { color: var(--fg-muted); font-size: var(--na-text-xs); }

    .badge {
      position: absolute; top: var(--na-space-6); left: var(--na-space-6); z-index: 2;
      display: flex; flex-direction: column; gap: 1px;
      background: var(--na-cream); color: var(--na-brown-900);
      padding: var(--na-space-2) var(--na-space-4); border-radius: var(--na-radius-md);
    }
    .badge strong { font: var(--na-font-bold) var(--na-text-xl)/1.1 var(--na-font-display); }
    .f-route { display: flex; align-items: center; gap: var(--na-space-4); margin-bottom: var(--na-space-5); }
    .f-ep { display: flex; flex-direction: column; }
    .f-ep--to { text-align: right; }
    .f-code { font: var(--na-font-bold) clamp(1.75rem, 1rem + 2vw, 2.6rem)/1 var(--na-font-display); }
    .f-city { margin-top: var(--na-space-1); }
    .f-path { display: inline-flex; align-items: center; gap: var(--na-space-2); min-width: 90px; color: var(--fg-muted); }
    .f-line { flex: 1; height: 1px; background: var(--fg-muted); }
    .f-plane { width: 15px; height: 15px; flex: none; transform: rotate(45deg); color: var(--fg); }
    .f-title { font-size: clamp(1.6rem, 1rem + 1.6vw, var(--na-text-3xl)); margin-bottom: var(--na-space-3); }
    .f-desc { max-width: 48ch; margin-bottom: var(--na-space-4); }
    .facts {
      display: flex; flex-wrap: wrap; gap: var(--na-space-2) var(--na-space-5); list-style: none;
      padding: 0; margin: 0 0 var(--na-space-6); color: var(--fg-muted);
    }
    .facts li { display: flex; align-items: center; gap: var(--na-space-2); }
    .facts li::before { content: ''; width: 5px; height: 5px; border-radius: var(--na-radius-full); background: var(--fg-muted); }
    .f-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--na-space-5); width: 100%; flex-wrap: wrap; }

    .pricing { display: flex; align-items: baseline; gap: var(--na-space-3); flex-wrap: wrap; }
    .price { color: var(--fg, var(--na-ink-900)); }
    .price--lg { font: var(--na-font-bold) var(--na-text-3xl) var(--na-font-display); }
    .price--md { font: var(--na-font-bold) var(--na-text-2xl) var(--na-font-display); }
    .cabin { width: 100%; color: var(--na-ink-500); letter-spacing: 0.1em; }

    .all { margin-top: var(--na-space-10); scroll-margin-top: calc(var(--na-topbar-h) + var(--na-space-4)); }
    .all__head { margin-bottom: var(--na-space-6); }
    .all__grid { display: grid; gap: var(--na-space-5); grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); }
    .card {
      display: flex; flex-direction: column; overflow: hidden;
      background: var(--na-surface-raised); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg);
      box-shadow: var(--na-shadow-sm);
      transition: transform var(--na-motion-base) var(--na-ease), box-shadow var(--na-motion-base) var(--na-ease), border-color var(--na-motion-base) var(--na-ease);
    }
    .card:hover { transform: translateY(-4px); border-color: var(--na-border-strong); box-shadow: var(--na-shadow-md); }
    .card__media { position: relative; height: 170px; flex-shrink: 0; overflow: hidden; }
    .card__img { object-fit: cover; object-position: center 40%; transition: transform 600ms var(--na-ease); }
    .card:hover .card__img { transform: scale(1.05); }
    .card__scrim { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0%, transparent 55%); }
    .pill {
      position: absolute; top: var(--na-space-3); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3rem 0.75rem; border-radius: var(--na-radius-full);
    }
    .pill--tag { left: var(--na-space-3); color: var(--na-brown-900); background: var(--na-cream); }
    .pill--off { right: var(--na-space-3); color: var(--na-cream); background: rgba(0, 0, 0, 0.55); }
    .card__body { display: flex; flex-direction: column; align-items: flex-start; flex: 1; padding: var(--na-space-5); }
    .card__route { color: var(--na-ink-500); margin-bottom: var(--na-space-2); }
    .card__title { font-family: var(--na-font-display); margin-bottom: var(--na-space-2); }
    .card__desc { color: var(--na-ink-700); font-size: var(--na-text-sm); margin-bottom: var(--na-space-3); }
    .card__perk { display: flex; align-items: center; gap: var(--na-space-2); font-size: var(--na-text-sm); font-weight: var(--na-font-medium); margin-bottom: var(--na-space-2); }
    .card__perk svg { width: 15px; height: 15px; flex: none; color: var(--na-success); }
    .card__validity { color: var(--na-ink-500); font-size: var(--na-text-xs); margin-bottom: var(--na-space-4); }
    .card__foot {
      display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3);
      width: 100%; margin-top: auto; padding-top: var(--na-space-4); border-top: 1px solid var(--na-border); flex-wrap: wrap;
    }

    .smallprint { color: var(--na-ink-300); font-size: var(--na-text-xs); max-width: 72ch; margin-top: var(--na-space-8); }

    @media (max-width: 640px) {
      .page { padding-top: var(--na-space-5); }
      .panel {
        --fg: var(--na-ink-900); --fg-soft: var(--na-ink-700); --fg-muted: var(--na-ink-500);
        --cta-bg: var(--na-cta); --cta-fg: var(--na-cta-contrast); --cta-h: var(--na-cta-hover);
        min-height: 0; background: var(--na-surface-raised); box-shadow: var(--na-shadow-md); flex-direction: column;
      }
      .panel__media, .card__media { position: relative; inset: auto; height: auto; aspect-ratio: 16 / 10; }
      .panel__scrim, .card__scrim { background: linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0%, transparent 45%); }
      .panel__body { padding: var(--na-space-5); max-width: none; margin-top: 0; }
      .hero__actions { margin-bottom: var(--na-space-6); }
      .cta { width: 100%; }
      .badge { top: var(--na-space-4); left: var(--na-space-4); }
      .f-path { min-width: 64px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card, .cta, .panel__img, .card__img, .cta svg { transition: none; }
      .card:hover, .cta:hover, .panel:hover .panel__img, .card:hover .card__img { transform: none; }
    }
  `,
})
export class OffersPage {
  protected readonly offers = OFFER_PAGE_OFFERS;
  protected readonly featured = OFFER_PAGE_OFFERS.find((o) => o.featured);
  protected readonly regular = OFFER_PAGE_OFFERS.filter((o) => !o.featured);
  protected readonly count = OFFER_PAGE_OFFERS.length;
  protected readonly lowest = Math.min(...OFFER_PAGE_OFFERS.map((o) => o.price));
  private readonly departDate = daysFromNow(21);

  constructor() {
    inject(Title).setTitle('NovaAir — Offers & special fares');
  }

  protected go(target: string, event: Event): void {
    scrollToSection(target, event);
  }

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
