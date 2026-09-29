import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DESTINATIONS } from './home.data';
import type { Destination } from './home.models';
import { SectionHeader } from './section-header.component';
import { daysFromNow } from './date-input';

@Component({
  selector: 'na-destinations',
  imports: [RouterLink, SectionHeader, NgOptimizedImage],
  template: `
    <section class="section" id="destinations" aria-labelledby="destinations-title">
      <na-section-header
        eyebrow="Where to next"
        title="Popular destinations"
        headingId="destinations-title"
        subtitle="Handpicked routes from Frankfurt, with fares worth packing for."
      />

      <div class="grid">
        @for (d of destinations; track d.code) {
          <a
            routerLink="/results"
            [queryParams]="paramsFor(d)"
            class="card"
            [attr.aria-label]="'Flights to ' + d.city + ', ' + d.country + ' from €' + d.priceFrom"
          >
            <img
              [ngSrc]="d.image"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
              alt=""
              class="card__img"
            />
            <span class="card__scrim" aria-hidden="true"></span>
            <span class="card__code" aria-hidden="true">{{ d.code }}</span>
            <span class="card__body">
              <span class="card__city">{{ d.city }}</span>
              <span class="card__country">{{ d.country }}</span>
            </span>
            <span class="card__foot">
              <span class="card__price">from €{{ d.priceFrom }}</span>
              <span class="card__cta" aria-hidden="true">
                Search flights
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </span>
          </a>
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
    .card {
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; justify-content: flex-end;
      min-height: 340px; padding: var(--na-space-6);
      border: 1px solid var(--h-line); border-radius: 20px;
      color: var(--h-cream); background: var(--h-brown-900);
      transition: transform var(--na-motion-base) var(--na-ease), border-color var(--na-motion-base) var(--na-ease), box-shadow var(--na-motion-base) var(--na-ease);
    }
    .card:hover {
      text-decoration: none; transform: translateY(-6px);
      border-color: var(--h-line-strong);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6);
    }
    .card__img {
      object-fit: cover; z-index: 0;
      transition: transform 600ms var(--na-ease);
    }
    .card:hover .card__img { transform: scale(1.05); }
    .card__scrim {
      position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, transparent 35%, rgba(0, 0, 0, 0.55) 68%, rgba(0, 0, 0, 0.88) 100%);
    }
    .card__code {
      position: absolute; top: var(--na-space-4); right: var(--na-space-5); z-index: 2;
      font-family: var(--h-font-display);
      font-size: 1.1rem; font-weight: 700; letter-spacing: 0.12em;
      color: var(--h-cream);
      background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(6px);
      border: 1px solid var(--h-onphoto-line); border-radius: var(--na-radius-full);
      padding: 0.3rem 0.8rem;
    }
    .card__body { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--na-space-4); }
    .card__city { font-family: var(--h-font-display); font-size: var(--na-text-2xl); font-weight: 700; }
    .card__country { color: var(--h-cream-soft); font-size: var(--na-text-sm); }
    .card__foot {
      position: relative; z-index: 2;
      display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3);
      padding-top: var(--na-space-4); border-top: 1px solid var(--h-onphoto-line);
    }
    .card__price { font-weight: var(--na-font-semibold); }
    .card__cta {
      display: inline-flex; align-items: center; gap: var(--na-space-1);
      color: var(--h-cream-soft); font-size: var(--na-text-sm); font-weight: var(--na-font-medium);
      transition: color var(--na-motion-fast) var(--na-ease);
    }
    .card__cta svg { width: 16px; height: 16px; transition: transform var(--na-motion-fast) var(--na-ease); }
    .card:hover .card__cta { color: var(--h-cream); }
    .card:hover .card__cta svg { transform: translateX(3px); }
    @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) {
      .section { padding: var(--na-space-12) var(--na-space-4); }
      .grid { grid-template-columns: 1fr; }
      .card { min-height: 260px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card__img { transition: none; }
      .card:hover .card__img { transform: none; }
    }
  `,
})
export class DestinationsSection {
  protected readonly destinations = DESTINATIONS;
  private readonly departDate = daysFromNow(14);

  protected paramsFor(d: Destination): Record<string, string | number> {
    return {
      tripType: 'ONE_WAY',
      origin: 'FRA',
      destination: d.code,
      depart: this.departDate,
      adults: 1,
      children: 0,
      infants: 0,
      cabin: 'ECONOMY',
    };
  }
}
