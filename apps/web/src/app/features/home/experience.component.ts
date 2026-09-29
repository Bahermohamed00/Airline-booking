import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'na-experience',
  imports: [RouterLink, NgOptimizedImage],
  template: `
    <section class="experience" id="experience" aria-labelledby="experience-title">
      <div class="experience__inner">
        <div class="experience__visual" aria-hidden="true">
          <div class="window">
            <img
              ngSrc="assets/img/tarmac-terminal.jpg"
              fill
              sizes="(max-width: 900px) 90vw, 33vw"
              alt=""
              class="window__img"
            />
          </div>
        </div>

        <div class="experience__copy">
          <p class="eyebrow">The NovaAir experience</p>
          <h2 id="experience-title">Every mile, considered.</h2>
          <p class="experience__text">
            From the quiet of our lounges to the last row of Economy, we design the journey around
            how travel should feel — calm, comfortable, and quietly luxurious. Savor menus by
            award-winning chefs, stretch out in cabins tuned for rest, and arrive ready.
          </p>
          <ul class="experience__points" role="list">
            <li>Fully flat beds in Business on long-haul routes</li>
            <li>Chef-curated menus and barista coffee at altitude</li>
            <li>Free messaging Wi-Fi on every flight</li>
          </ul>
          <a routerLink="/loyalty" class="experience__cta">
            Discover NovaAir Miles
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .experience {
      padding: var(--na-space-16) var(--na-space-6);
      background: linear-gradient(180deg, var(--h-bg) 0%, var(--h-band) 45%, var(--h-bg) 100%);
      border-top: 1px solid var(--h-line);
      border-bottom: 1px solid var(--h-line);
      scroll-margin-top: 84px;
    }
    .experience__inner {
      max-width: 1200px; margin: 0 auto;
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-16); align-items: center;
    }
    .experience__visual { display: flex; justify-content: center; }
    .window {
      position: relative; overflow: hidden;
      width: min(100%, 380px); aspect-ratio: 3 / 4;
      border-radius: 190px 190px 24px 24px;
      border: 10px solid var(--h-line-soft);
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
      background: var(--h-brown-900);
    }
    .window__img { object-fit: cover; }
    .eyebrow {
      color: var(--h-text-muted); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: var(--na-space-3);
    }
    h2 {
      font-family: var(--h-font-display);
      font-size: clamp(2rem, 4.5vw, 3rem); color: var(--h-text); margin-bottom: var(--na-space-5);
    }
    .experience__text { color: var(--h-text-soft); line-height: 1.7; margin-bottom: var(--na-space-6); }
    .experience__points {
      list-style: none; margin: 0 0 var(--na-space-8); padding: 0;
      display: flex; flex-direction: column; gap: var(--na-space-3);
    }
    .experience__points li {
      position: relative; padding-left: var(--na-space-6);
      color: var(--h-text-soft); font-size: var(--na-text-sm);
    }
    .experience__points li::before {
      content: ''; position: absolute; left: 0; top: 0.45em;
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--h-cta-bg);
    }
    .experience__cta {
      display: inline-flex; align-items: center; gap: var(--na-space-2);
      color: var(--h-text); font-weight: var(--na-font-semibold);
      border-bottom: 1px solid var(--h-line-strong); padding-bottom: 2px;
      transition: border-color var(--na-motion-fast) var(--na-ease);
    }
    .experience__cta svg { width: 16px; height: 16px; transition: transform var(--na-motion-fast) var(--na-ease); }
    .experience__cta:hover { text-decoration: none; border-color: var(--h-text); }
    .experience__cta:hover svg { transform: translateX(3px); }
    @media (max-width: 900px) {
      .experience__inner { grid-template-columns: 1fr; gap: var(--na-space-10); }
      .experience { padding: var(--na-space-12) var(--na-space-4); }
    }
  `,
})
export class ExperienceSection {}
