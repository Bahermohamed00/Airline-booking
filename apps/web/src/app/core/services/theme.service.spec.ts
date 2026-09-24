import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('defaults to dark when there is no stored or system preference', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('dark');
    expect(service.isLight()).toBe(false);
  });

  it('applies the theme to the document root', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    service.toggle();
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists an explicit choice and restores it on the next session', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    TestBed.tick();
    expect(localStorage.getItem('na-theme')).toBe('light');

    document.documentElement.removeAttribute('data-theme');
    const restored = TestBed.inject(ThemeService);
    expect(restored.theme()).toBe('light');
  });

  it('does not write storage before the user makes an explicit choice', () => {
    TestBed.inject(ThemeService);
    TestBed.tick();
    expect(localStorage.getItem('na-theme')).toBeNull();
  });
});
