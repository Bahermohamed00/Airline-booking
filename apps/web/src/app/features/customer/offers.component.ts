import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { OffersService, type OfferView } from '../../core/services/offers.service';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';
import { scrollToSection } from '../home/scroll-to-section';

@Component({
  selector: 'na-offers-page',
  imports: [RouterLink, NgOptimizedImage, DatePipe, NaAlert, NaSkeleton, NaEmptyState],
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
            Handpicked fares across the NovaAir network — premium cabins, city breaks, and winter sun.
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
            <li><strong>{{ offers().length }}</strong><span>live offers</span></li>
            <li><strong>{{ destinationCount() }}</strong><span>destinations on sale</span></li>
            <li><strong>Weekly</strong><span>new fares</span></li>
          </ul>
        </div>
      </section>

      @if (error()) {
        <na-alert tone="warning" icon="⚠" title="Offers unavailable" retryable (retry)="load()" class="state">
          We could not load the current offers. Please try again in a moment.
        </na-alert>
      } @else if (loading()) {
        <div class="state"><na-skeleton [rows]="[1]" height="22rem" /></div>
        <div class="state"><na-skeleton [rows]="[1, 2]" height="12rem" /></div>
      } @else if (offers().length === 0) {
        <na-empty-state
          icon="✈"
          title="No offers right now"
          message="There are no active offers at the moment — new fares land every week, so check back soon."
          actionLabel="Search flights"
          (action)="go2search()"
        />
      } @else {
        @if (featured(); as f) {
          <article class="panel panel--featured" aria-labelledby="featured-title">
            <div class="panel__media" aria-hidden="true">
              @if (f.imageUrl; as img) {
                <img [ngSrc]="img" fill sizes="(max-width: 1000px) 100vw, 80vw" [alt]="f.title" class="panel__img" />
              }
              <span class="panel__scrim"></span>
            </div>
            @if (f.badge) {
              <span class="badge"><strong>{{ f.offerValue ?? f.badge }}</strong><small class="caps">{{ f.badge }}</small></span>
            }
            <div class="panel__body">
              <p class="caps caps--dim">Featured offer</p>
              @if (f.destination) {
                <p class="f-route caps">{{ f.destination }}</p>
              }
              <h2 id="featured-title" class="f-title">{{ f.title }}</h2>
              <p class="soft f-desc">{{ f.description }}</p>
              <ul class="facts caps">
                <li>Valid until {{ f.validUntil | date: 'd MMM y' }}</li>
                @if (f.terms) {
                  <li>{{ f.terms }}</li>
                }
              </ul>
              <div class="f-foot">
                @if (f.offerValue) {
                  <p class="value">{{ f.offerValue }}</p>
                }
                <a routerLink="/search" class="cta" [attr.aria-label]="'Search flights for offer: ' + f.title">
                  Search flights
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
            <p class="na-text-muted">Every fare is live right now — validity dates are shown on each offer.</p>
          </header>

          <div class="all__grid">
            @for (o of regular(); track o.id) {
              <article class="card">
                <div class="card__media" aria-hidden="true">
                  @if (o.imageUrl; as img) {
                    <img
                      [ngSrc]="img"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                      [alt]="o.title"
                      class="card__img"
                    />
                  } @else {
                    <span class="card__placeholder">✈</span>
                  }
                  <span class="card__scrim"></span>
                  @if (o.badge) {
                    <span class="pill pill--tag">{{ o.badge }}</span>
                  }
                </div>

                <div class="card__body">
                  @if (o.destination) {
                    <p class="caps card__route">{{ o.destination }}</p>
                  }
                  <h3 class="card__title">{{ o.title }}</h3>
                  <p class="card__desc">{{ o.description }}</p>
                  @if (o.offerValue) {
                    <p class="value value--md">{{ o.offerValue }}</p>
                  }
                  <p class="card__validity">Valid until {{ o.validUntil | date: 'd MMM y' }}</p>
                  @if (o.terms) {
                    <p class="card__terms">{{ o.terms }}</p>
                  }
                  <div class="card__foot">
                    <a routerLink="/search" class="cta cta--outline" [attr.aria-label]="'Search flights for offer: ' + o.title">
                      Search flights
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
          All offers are subject to availability at the time of booking. Validity dates are inclusive and shown in
          each offer. Terms and conditions apply as stated on the individual offers.
        </p>
      }
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
    .panel--featured { min-height: 460px; margin-top: var(--na-space-8); }
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

    // Small uppercase label text (eyebrows, route meta, facts).
    .caps { font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); letter-spacing: 0.14em; text-transform: uppercase; }
    .caps--dim { color: var(--fg-muted); }

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
    .f-route { color: var(--fg-muted); margin-bottom: var(--na-space-4); }
    .f-title { font-size: clamp(1.6rem, 1rem + 1.6vw, var(--na-text-3xl)); margin-bottom: var(--na-space-3); }
    .f-desc { max-width: 48ch; margin-bottom: var(--na-space-4); }
    .facts {
      display: flex; flex-wrap: wrap; gap: var(--na-space-2) var(--na-space-5); list-style: none;
      padding: 0; margin: 0 0 var(--na-space-6); color: var(--fg-muted);
    }
    .facts li { display: flex; align-items: center; gap: var(--na-space-2); }
    .facts li::before { content: ''; width: 5px; height: 5px; border-radius: var(--na-radius-full); background: var(--fg-muted); }
    .f-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-5); width: 100%; flex-wrap: wrap; }
    .value { font: var(--na-font-bold) var(--na-text-3xl) var(--na-font-display); color: var(--fg, var(--na-ink-900)); }
    .value--md { font-size: var(--na-text-2xl); }

    .state { display: block; margin-top: var(--na-space-8); }
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
    .card__media { position: relative; height: 170px; flex-shrink: 0; overflow: hidden; background: var(--na-navy-700); }
    .card__img { object-fit: cover; object-position: center 40%; transition: transform 600ms var(--na-ease); }
    .card:hover .card__img { transform: scale(1.05); }
    .card__placeholder {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 2.5rem; color: var(--na-ink-300);
    }
    .card__scrim { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0%, transparent 55%); }
    .pill {
      position: absolute; top: var(--na-space-3); left: var(--na-space-3);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3rem 0.75rem; border-radius: var(--na-radius-full);
    }
    .pill--tag { color: var(--na-brown-900); background: var(--na-cream); }
    .card__body { display: flex; flex-direction: column; align-items: flex-start; flex: 1; padding: var(--na-space-5); }
    .card__route { color: var(--na-ink-500); margin-bottom: var(--na-space-2); }
    .card__title { font-family: var(--na-font-display); margin-bottom: var(--na-space-2); }
    .card__desc { color: var(--na-ink-700); font-size: var(--na-text-sm); margin-bottom: var(--na-space-3); }
    .card__validity { color: var(--na-ink-500); font-size: var(--na-text-xs); margin-top: var(--na-space-2); }
    .card__terms { color: var(--na-ink-300); font-size: var(--na-text-xs); margin-top: var(--na-space-1); }
    .card__foot {
      display: flex; align-items: center; justify-content: flex-end;
      width: 100%; margin-top: auto; padding-top: var(--na-space-4);
    }
    .smallprint { color: var(--na-ink-300); font-size: var(--na-text-xs); max-width: 72ch; margin-top: var(--na-space-8); }

    @media (max-width: 640px) {
      .page { padding-top: var(--na-space-5); }
      .panel {
        --fg: var(--na-ink-900); --fg-soft: var(--na-ink-700); --fg-muted: var(--na-ink-500);
        --cta-bg: var(--na-cta); --cta-fg: var(--na-cta-contrast); --cta-h: var(--na-cta-hover);
        min-height: 0; background: var(--na-surface-raised); box-shadow: var(--na-shadow-md); flex-direction: column;
      }
      .panel__media { position: relative; inset: auto; aspect-ratio: 16 / 10; }
      .panel__scrim { background: linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0%, transparent 45%); }
      .panel__body { padding: var(--na-space-5); max-width: none; margin-top: 0; }
      .hero__actions { margin-bottom: var(--na-space-6); }
      .cta { width: 100%; }
      .badge { top: var(--na-space-4); left: var(--na-space-4); }
      .card__media { height: auto; aspect-ratio: 16 / 9; }
      .card__placeholder { position: relative; min-height: 120px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card, .cta, .panel__img, .card__img, .cta svg { transition: none; }
      .card:hover, .cta:hover, .panel:hover .panel__img, .card:hover .card__img { transform: none; }
    }
  `,
})
export class OffersPage {
  private readonly offersService = inject(OffersService);
  private readonly router = inject(Router);

  protected readonly offers = signal<OfferView[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly featured = computed(() => this.offers()[0] ?? null);
  protected readonly regular = computed(() => this.offers().slice(1));
  protected readonly destinationCount = computed(
    () => new Set(this.offers().map((o) => o.destination).filter((d): d is string => !!d)).size,
  );

  constructor() {
    inject(Title).setTitle('NovaAir — Offers & special fares');
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.offersService.listPublic().subscribe({
      next: (offers) => {
        this.offers.set(offers);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected go(target: string, event: Event): void {
    scrollToSection(target, event);
  }

  protected go2search(): void {
    this.router.navigateByUrl('/search');
  }
}
