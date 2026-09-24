import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'na-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media =
    typeof this.document.defaultView?.matchMedia === 'function'
      ? this.document.defaultView.matchMedia('(prefers-color-scheme: light)')
      : null;

  readonly theme = signal<Theme>(this.initialTheme());
  readonly isLight = computed(() => this.theme() === 'light');

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.setAttribute('data-theme', theme);
      if (this.explicit()) {
        try {
          localStorage.setItem(STORAGE_KEY, theme);
        } catch {
          // storage unavailable — theme stays session-scoped
        }
      }
    });
    // Follow the system theme only while the user has not made an explicit choice.
    this.media?.addEventListener('change', (e) => {
      if (!this.explicit()) this.theme.set(e.matches ? 'light' : 'dark');
    });
  }

  toggle(): void {
    this.explicit.set(true);
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private readonly explicit = signal(this.hasStoredPreference());

  private hasStoredPreference(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'dark' || saved === 'light';
    } catch {
      return false;
    }
  }

  private initialTheme(): Theme {
    // index.html applies the theme pre-boot; stay in sync with it to avoid a flip.
    const applied = this.document.documentElement.getAttribute('data-theme');
    if (applied === 'dark' || applied === 'light') return applied;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // fall through to system preference
    }
    return this.media?.matches ? 'light' : 'dark';
  }
}
