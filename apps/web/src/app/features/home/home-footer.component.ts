import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FOOTER_GROUPS } from './home.data';
import { scrollToSection } from '../../shared/utils/scroll-to-section';

@Component({
  selector: 'na-home-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__top">
          <div class="footer__brand">
            <a href="#top" class="brand" aria-label="NovaAir — back to top" (click)="go('top', $event)">
              <svg class="brand__mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5.5l8 2.5z"
                />
              </svg>
              <span class="brand__name">NovaAir</span>
            </a>
            <p class="footer__blurb">
              Premium air travel across 120+ destinations — considered cabins, honest fares, and
              service that remembers your name.
            </p>
            <div class="footer__social">
              <a href="https://x.com" target="_blank" rel="noopener" aria-label="NovaAir on X">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.3L2.8 2h6.4l4.4 5.9L18.9 2zm-1.1 18h1.7L7.1 3.9H5.3L17.8 20z" />
                </svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="NovaAir on Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener" aria-label="NovaAir on LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21h-4V9z" />
                </svg>
              </a>
            </div>
          </div>

          @for (group of groups; track group.heading) {
            <nav class="footer__group" [attr.aria-label]="group.heading">
              <h3 class="footer__heading">{{ group.heading }}</h3>
              <ul role="list">
                @for (link of group.links; track link.path + link.label) {
                  <li>
                    <a [routerLink]="link.path" class="footer__link">{{ link.label }}</a>
                  </li>
                }
              </ul>
            </nav>
          }

          <div class="footer__group">
            <h3 class="footer__heading">Contact</h3>
            <address class="footer__contact">
              <a href="tel:+4969000000" class="footer__link">+49 69 000 000</a>
              <a href="mailto:care&#64;novaair.example" class="footer__link">care&#64;novaair.example</a>
              <span>NovaAir Campus 1<br />60547 Frankfurt am Main</span>
            </address>
          </div>
        </div>

        <div class="footer__bottom">
          <p>&copy; {{ year }} NovaAir. All rights reserved.</p>
          <p class="footer__disclaimer">
            NovaAir is an educational demo platform — all flights, fares, and reviews are mock data.
          </p>
        </div>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      background: var(--h-brown-900);
      border-top: 1px solid var(--h-onphoto-line);
      padding: var(--na-space-16) var(--na-space-6) var(--na-space-8);
    }
    .footer__inner { max-width: 1200px; margin: 0 auto; }
    .footer__top {
      display: grid; gap: var(--na-space-10);
      grid-template-columns: 1.6fr 1fr 1fr 1fr 1.2fr;
      padding-bottom: var(--na-space-12);
      border-bottom: 1px solid var(--h-onphoto-line);
    }
    .brand { display: inline-flex; align-items: center; gap: var(--na-space-2); color: var(--h-cream); margin-bottom: var(--na-space-4); }
    .brand:hover { text-decoration: none; }
    .brand__mark {
      width: 32px; height: 32px; padding: 6px;
      background: var(--h-cream); color: var(--h-brown-900); border-radius: 9px; transform: rotate(45deg);
    }
    .brand__name { font-family: var(--h-font-display); font-size: 1.3rem; font-weight: 700; }
    .footer__blurb { color: var(--h-cream-muted); font-size: var(--na-text-sm); line-height: 1.7; max-width: 22rem; margin-bottom: var(--na-space-5); }
    .footer__social { display: flex; gap: var(--na-space-3); }
    .footer__social a {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: 50%;
      color: var(--h-cream-soft); border: 1px solid var(--h-onphoto-line);
      transition: color var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease);
    }
    .footer__social a:hover { color: var(--h-brown-900); background: var(--h-cream); border-color: var(--h-cream); }
    .footer__social svg { width: 18px; height: 18px; }
    .footer__heading {
      color: var(--h-cream); font-size: var(--na-text-sm); font-weight: var(--na-font-semibold);
      letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: var(--na-space-4);
    }
    .footer__group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--na-space-2); }
    .footer__link {
      color: var(--h-cream-muted); font-size: var(--na-text-sm);
      padding: 2px 0; display: inline-block;
      transition: color var(--na-motion-fast) var(--na-ease);
    }
    .footer__link:hover { color: var(--h-cream); text-decoration: none; }
    .footer__contact { font-style: normal; display: flex; flex-direction: column; gap: var(--na-space-2); color: var(--h-cream-muted); font-size: var(--na-text-sm); line-height: 1.6; }
    .footer__bottom {
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--na-space-3);
      padding-top: var(--na-space-6);
      color: var(--h-cream-muted); font-size: var(--na-text-xs);
    }
    .footer__disclaimer { font-style: italic; }
    @media (max-width: 1000px) { .footer__top { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px) {
      .footer { padding: var(--na-space-12) var(--na-space-4) var(--na-space-6); }
      .footer__top { grid-template-columns: 1fr; gap: var(--na-space-8); }
    }
  `,
})
export class HomeFooter {
  protected readonly groups = FOOTER_GROUPS;
  protected readonly year = new Date().getFullYear();

  protected go(target: string, event: Event): void {
    scrollToSection(target, event);
  }
}
