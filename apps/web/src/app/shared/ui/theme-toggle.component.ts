import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'na-theme-toggle',
  template: `
    <button
      type="button"
      class="toggle"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      [attr.aria-pressed]="theme.isLight()"
      (click)="theme.toggle()"
    >
      @if (theme.isLight()) {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path
            d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6"
            stroke-linecap="round"
          />
        </svg>
      }
    </button>
  `,
  styles: `
    .toggle {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; flex: none;
      background: transparent; color: inherit;
      border: none; border-radius: var(--na-radius-md);
      transition: background var(--na-motion-fast) var(--na-ease), transform var(--na-motion-fast) var(--na-ease);
    }
    .toggle:hover { background: var(--na-theme-toggle-hover, var(--na-navy-600)); }
    .toggle:active { transform: scale(0.92); }
    .toggle svg { width: 20px; height: 20px; }
  `,
})
export class NaThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() =>
    this.theme.isLight() ? 'Switch to dark mode' : 'Switch to light mode',
  );
}
