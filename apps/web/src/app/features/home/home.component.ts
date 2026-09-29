import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HomeNavbar } from './home-navbar.component';
import { HeroSection } from './hero.component';
import { SearchCard } from './search-card.component';
import { DestinationsSection } from './destinations.component';
import { BenefitsSection } from './benefits.component';
import { OffersSection } from './offers.component';
import { ExperienceSection } from './experience.component';
import { TestimonialsSection } from './testimonials.component';
import { CtaBanner } from './cta-banner.component';
import { HomeFooter } from './home-footer.component';

@Component({
  selector: 'na-home-page',
  imports: [
    HomeNavbar,
    HeroSection,
    SearchCard,
    DestinationsSection,
    BenefitsSection,
    OffersSection,
    ExperienceSection,
    TestimonialsSection,
    CtaBanner,
    HomeFooter,
  ],
  template: `
    <div class="page">
      <a href="#book" class="skip-link">Skip to flight search</a>
      <na-home-navbar />
      <main>
        <na-hero />
        <section id="book" class="book" aria-label="Book a flight">
          <div class="book__inner">
            <na-search-card />
          </div>
        </section>
        <na-destinations />
        <na-benefits />
        <na-offers />
        <na-experience />
        <na-testimonials />
        <na-cta-banner />
      </main>
      <na-home-footer />
    </div>
  `,
  styles: `
    :host {
      // -- Constants: dark-chrome & on-photo styling, identical in both themes --
      --h-cream: #e1dcc9;
      --h-cream-soft: rgba(225, 220, 201, 0.78);
      --h-cream-muted: rgba(225, 220, 201, 0.64);
      --h-brown-900: #1f150c;
      --h-brown-700: #412d15;
      --h-glass: rgba(31, 21, 12, 0.72);
      --h-field: rgba(0, 0, 0, 0.45);
      --h-field-focus: rgba(0, 0, 0, 0.6);
      --h-scrim: rgba(0, 0, 0, 0.85);
      --h-hover-light: rgba(225, 220, 201, 0.08);
      --h-onphoto-line: rgba(225, 220, 201, 0.2);
      --h-onphoto-line-strong: rgba(225, 220, 201, 0.35);
      --h-watermark: rgba(225, 220, 201, 0.14);
      --h-btn-bg: #e1dcc9;
      --h-btn-text: #1f150c;

      // -- Adaptive: page surfaces & section text, flip per theme --
      --h-bg: #000000;
      --h-text: #e1dcc9;
      --h-text-soft: rgba(225, 220, 201, 0.78);
      --h-text-muted: rgba(225, 220, 201, 0.62);
      --h-line: rgba(225, 220, 201, 0.12);
      --h-line-soft: rgba(225, 220, 201, 0.2);
      --h-line-strong: rgba(225, 220, 201, 0.28);
      --h-surface: rgba(31, 21, 12, 0.55);
      --h-surface-raised: rgba(65, 45, 21, 0.5);
      --h-cta-bg: #e1dcc9;
      --h-cta-text: #1f150c;
      --h-band: #1f150c;

      --h-font-display: Georgia, 'Times New Roman', serif;
      --na-focus-ring: 0 0 0 3px rgba(225, 220, 201, 0.45);
    }
    :host-context([data-theme='light']) {
      --h-bg: #f5f1e6;
      --h-text: #1f150c;
      --h-text-soft: rgba(31, 21, 12, 0.75);
      --h-text-muted: rgba(31, 21, 12, 0.6);
      --h-line: rgba(65, 45, 21, 0.14);
      --h-line-soft: rgba(65, 45, 21, 0.2);
      --h-line-strong: rgba(65, 45, 21, 0.32);
      --h-surface: rgba(255, 253, 247, 0.85);
      --h-surface-raised: rgba(65, 45, 21, 0.07);
      --h-cta-bg: #412d15;
      --h-cta-text: #f3eddc;
      --h-band: #ede7d6;
      --na-focus-ring: 0 0 0 3px rgba(65, 45, 21, 0.35);
    }
    .page {
      background: var(--h-bg);
      color: var(--h-text);
      min-height: 100vh;
    }
    .skip-link {
      position: absolute; left: var(--na-space-4); top: -100px; z-index: 200;
      background: var(--h-btn-bg); color: var(--h-btn-text); font-weight: var(--na-font-semibold);
      padding: var(--na-space-3) var(--na-space-5); border-radius: var(--na-radius-md);
      transition: top var(--na-motion-fast) var(--na-ease);
    }
    .skip-link:focus-visible { top: var(--na-space-4); }
    .book {
      position: relative; z-index: 5;
      padding: 0 var(--na-space-6);
      margin-top: -110px;
      scroll-margin-top: 96px;
    }
    .book__inner { max-width: 1200px; margin: 0 auto; }
    @media (max-width: 900px) {
      .book { margin-top: -80px; padding: 0 var(--na-space-4); }
    }
  `,
})
export class HomePage {
  constructor() {
    inject(Title).setTitle('NovaAir — Premium flights to 120+ destinations');
  }
}
