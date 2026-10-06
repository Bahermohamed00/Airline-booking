import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { scrollToSection } from '../../shared/utils/scroll-to-section';
import { NaThemeToggle } from '../../shared/ui/theme-toggle.component';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  target: string;
}

@Component({
  selector: 'na-home-navbar',
  imports: [RouterLink, NaThemeToggle],
  host: {
    '(window:scroll)': 'onWindowScroll()',
    '(document:keydown.escape)': 'closeMenu()',
  },
  template: `
    <header class="nav" [class.nav--scrolled]="scrolled()">
      <div class="nav__inner">
        <a href="#top" class="brand" aria-label="NovaAir — back to top" (click)="go('top', $event)">
          <svg class="brand__mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5.5l8 2.5z"
            />
          </svg>
          <span class="brand__name">NovaAir</span>
        </a>

        <nav class="nav__links" aria-label="Primary">
          @for (item of items; track item.target) {
            <a [href]="'#' + item.target" class="nav__link" (click)="go(item.target, $event)">
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="nav__actions">
          <na-theme-toggle />
          @if (auth.user(); as u) {
            <a routerLink="/profile" class="nav__signin">{{ u.firstName }}</a>
          } @else {
            <a routerLink="/login" class="nav__signin">Sign in</a>
          }
          <a href="#book" class="nav__cta" (click)="go('book', $event)">Book now</a>
          <button
            type="button"
            class="nav__burger"
            aria-label="Toggle navigation menu"
            aria-controls="home-mobile-menu"
            [attr.aria-expanded]="menuOpen()"
            (click)="toggleMenu()"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>
      </div>

      @if (menuOpen()) {
        <nav id="home-mobile-menu" class="nav__mobile" aria-label="Mobile">
          @for (item of items; track item.target) {
            <a
              [href]="'#' + item.target"
              class="nav__mobile-link"
              (click)="go(item.target, $event)"
            >
              {{ item.label }}
            </a>
          }
          @if (auth.user(); as u) {
            <a routerLink="/profile" class="nav__mobile-link" (click)="closeMenu()">{{
              u.firstName
            }}</a>
          } @else {
            <a routerLink="/login" class="nav__mobile-link" (click)="closeMenu()">Sign in</a>
          }
          <a href="#book" class="nav__mobile-cta" (click)="go('book', $event)">Book now</a>
        </nav>
      }
    </header>
  `,
  styles: `
    .nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      color: var(--h-cream);
      --na-theme-toggle-hover: var(--h-hover-light);
      transition:
        background var(--na-motion-base) var(--na-ease),
        border-color var(--na-motion-base) var(--na-ease);
      border-bottom: 1px solid transparent;
    }
    .nav--scrolled {
      background: var(--h-scrim);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom-color: var(--h-line);
    }
    .nav__inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--na-space-6);
      height: 72px;
      display: flex;
      align-items: center;
      gap: var(--na-space-8);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: var(--na-space-2);
      color: var(--h-cream);
    }
    .brand:hover {
      text-decoration: none;
    }
    .brand__mark {
      width: 34px;
      height: 34px;
      padding: 7px;
      background: var(--h-cream);
      color: var(--h-brown-900);
      border-radius: 10px;
      transform: rotate(45deg);
    }
    .brand__name {
      font-family: var(--h-font-display);
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .nav__links {
      display: flex;
      gap: var(--na-space-1);
      flex: 1;
    }
    .nav__link {
      color: var(--h-cream-soft);
      font-size: var(--na-text-sm);
      font-weight: var(--na-font-medium);
      padding: 0.5rem 0.85rem;
      border-radius: var(--na-radius-md);
      transition:
        color var(--na-motion-fast) var(--na-ease),
        background var(--na-motion-fast) var(--na-ease);
    }
    .nav__link:hover {
      color: var(--h-cream);
      background: var(--h-hover-light);
      text-decoration: none;
    }
    .nav__actions {
      display: flex;
      align-items: center;
      gap: var(--na-space-4);
    }
    .nav__signin {
      color: var(--h-cream-soft);
      font-size: var(--na-text-sm);
      font-weight: var(--na-font-medium);
      padding: 0.5rem 0.25rem;
    }
    .nav__signin:hover {
      color: var(--h-cream);
      text-decoration: none;
    }
    .nav__cta {
      background: var(--h-cream);
      color: var(--h-brown-900);
      font-size: var(--na-text-sm);
      font-weight: var(--na-font-semibold);
      padding: 0.6rem 1.25rem;
      border-radius: var(--na-radius-full);
      transition:
        background var(--na-motion-fast) var(--na-ease),
        transform var(--na-motion-fast) var(--na-ease);
    }
    .nav__cta:hover {
      background: #ffffff;
      text-decoration: none;
      transform: translateY(-1px);
    }
    .nav__burger {
      display: none;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      width: 44px;
      height: 44px;
      padding: 10px;
      background: transparent;
      border: 1px solid var(--h-onphoto-line);
      border-radius: var(--na-radius-md);
    }
    .nav__burger span {
      display: block;
      height: 2px;
      background: var(--h-cream);
      border-radius: 2px;
    }
    .nav__burger:hover {
      border-color: var(--h-onphoto-line-strong);
    }
    .nav__mobile {
      display: flex;
      flex-direction: column;
      gap: var(--na-space-1);
      padding: var(--na-space-4) var(--na-space-6) var(--na-space-6);
      background: #000000;
      border-bottom: 1px solid var(--h-onphoto-line);
      max-height: calc(100dvh - 72px);
      overflow-y: auto;
    }
    .nav__mobile-link {
      color: var(--h-cream-soft);
      font-weight: var(--na-font-medium);
      padding: var(--na-space-3) var(--na-space-2);
      border-radius: var(--na-radius-md);
      min-height: 44px;
    }
    .nav__mobile-link:hover {
      background: var(--h-hover-light);
      color: var(--h-cream);
      text-decoration: none;
    }
    .nav__mobile-cta {
      margin-top: var(--na-space-3);
      text-align: center;
      background: var(--h-cream);
      color: var(--h-brown-900);
      font-weight: var(--na-font-semibold);
      padding: var(--na-space-3);
      border-radius: var(--na-radius-full);
      min-height: 44px;
    }
    .nav__mobile-cta:hover {
      text-decoration: none;
      background: #ffffff;
    }
    @media (max-width: 900px) {
      .nav__links,
      .nav__signin,
      .nav__cta {
        display: none;
      }
      .nav__burger {
        display: flex;
      }
      .nav__inner {
        gap: var(--na-space-4);
        padding: 0 var(--na-space-4);
      }
      .nav__actions {
        margin-left: auto;
      }
    }
  `,
})
export class HomeNavbar {
  protected readonly auth = inject(AuthService);

  protected readonly items: NavItem[] = [
    { label: 'Book', target: 'book' },
    { label: 'Destinations', target: 'destinations' },
    { label: 'Offers', target: 'offers' },
    { label: 'Experience', target: 'experience' },
    { label: 'Reviews', target: 'reviews' },
  ];

  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);

  protected onWindowScroll(): void {
    const past = window.scrollY > 32;
    if (past !== this.scrolled()) this.scrolled.set(past);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected go(target: string, event: Event): void {
    this.closeMenu();
    scrollToSection(target, event);
  }
}
