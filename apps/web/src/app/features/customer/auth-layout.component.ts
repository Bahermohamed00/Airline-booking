import { Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'na-auth-layout',
  imports: [NgOptimizedImage],
  template: `
    <section class="auth">
      <div class="auth__visual">
        <img
          ngSrc="assets/img/auth-terminal.jpg"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
          alt=""
          aria-hidden="true"
          class="auth__img"
        />
        <div class="auth__scrim" aria-hidden="true"></div>
        <div class="auth__brand">
          <span class="auth__mark" aria-hidden="true">✈</span>
          <span class="auth__name">NovaAir</span>
        </div>
        <p class="auth__tagline">{{ tagline() }}</p>
      </div>

      <div class="auth__panel">
        <div class="auth__content">
          <ng-content />
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; margin-bottom: calc(-1 * var(--na-space-16)); }
    .auth { display: grid; grid-template-columns: 1.05fr 1fr; min-height: calc(100vh - var(--na-topbar-h)); }
    .auth__visual {
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; justify-content: space-between; gap: var(--na-space-8);
      padding: var(--na-space-8);
      background: var(--na-navy-800);
    }
    .auth__img { object-fit: cover; object-position: center 40%; }
    .auth__scrim {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.18) 45%, rgba(0, 0, 0, 0.74) 100%);
    }
    .auth__brand { position: relative; z-index: 1; display: flex; align-items: center; gap: var(--na-space-2); }
    .auth__mark {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: var(--na-radius-md);
      background: var(--na-cta); color: var(--na-cta-contrast); font-size: 1.1rem;
    }
    .auth__name { font-family: var(--na-font-display); font-weight: var(--na-font-bold); font-size: var(--na-text-xl); color: var(--na-cream); }
    .auth__tagline {
      position: relative; z-index: 1; max-width: 22ch; margin: 0;
      font-family: var(--na-font-display); font-size: var(--na-text-2xl); line-height: var(--na-leading-tight);
      color: var(--na-cream);
    }
    .auth__panel { display: flex; align-items: center; justify-content: center; padding: var(--na-space-10) var(--na-space-6); }
    .auth__content { width: min(420px, 100%); }
    @media (max-width: 900px) {
      :host { margin-bottom: 0; }
      .auth { grid-template-columns: 1fr; min-height: 0; }
      .auth__visual { min-height: 200px; padding: var(--na-space-5); gap: var(--na-space-6); }
      .auth__tagline { font-size: var(--na-text-lg); max-width: 30ch; }
      .auth__panel { padding: var(--na-space-8) var(--na-space-4) var(--na-space-12); }
    }
  `,
})
export class NaAuthLayout {
  readonly tagline = input('Premium journeys, thoughtfully flown.');
}
