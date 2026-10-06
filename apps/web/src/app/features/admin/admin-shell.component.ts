import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ADMIN_NAV } from './admin-nav';
import { NaThemeToggle } from '../../shared/ui/theme-toggle.component';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NaThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin" [class.admin--collapsed]="collapsed()">
      <aside class="sidebar" aria-label="Admin navigation">
        <a routerLink="/admin/dashboard" class="brand">
          <span class="brand__mark" aria-hidden="true">✈</span>
          @if (!collapsed()) { <span class="brand__name">NovaAir Ops</span> }
        </a>
        <nav class="side-nav">
          @for (item of visibleNav(); track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="side-nav__link--active"
              class="side-nav__link"
              [attr.aria-label]="item.label"
              [title]="collapsed() ? item.label : null"
            >
              <span class="side-nav__icon" aria-hidden="true">{{ item.icon }}</span>
              @if (!collapsed()) { <span>{{ item.label }}</span> }
            </a>
          }
        </nav>
        <button type="button" class="collapse-btn" (click)="collapsed.set(!collapsed())" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          {{ collapsed() ? '»' : '«' }}
        </button>
      </aside>

      <div class="content">
        <header class="topbar">
          <span class="mock-pill" title="All data shown is mock demo data">DEMO DATA</span>
          <div class="topbar__right">
            <na-theme-toggle />
            <span class="staff">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }} · {{ auth.user()?.roles?.[0] }}</span>
            <button type="button" class="signout" (click)="signOut()">Sign out</button>
          </div>
        </header>
        <main class="page">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .admin { display: flex; min-height: 100vh; background: var(--na-surface); }
    .sidebar {
      width: var(--na-sidebar-w); background: var(--na-navy-800); color: var(--na-ink-900);
      display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
      transition: width var(--na-motion-base) var(--na-ease); flex-shrink: 0;
      border-right: 1px solid var(--na-border);
    }
    .admin--collapsed .sidebar { width: var(--na-sidebar-w-collapsed); }
    .brand { display: flex; align-items: center; gap: var(--na-space-2); padding: var(--na-space-4); color: var(--na-ink-900); font-family: var(--na-font-display); font-weight: var(--na-font-bold); border-bottom: 1px solid var(--na-navy-600); }
    .brand:hover { text-decoration: none; }
    .brand__mark { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--na-cta); color: var(--na-cta-contrast); border-radius: var(--na-radius-md); flex-shrink: 0; }
    .side-nav { flex: 1; overflow-y: auto; padding: var(--na-space-3) var(--na-space-2); display: flex; flex-direction: column; gap: 2px; }
    .side-nav__link { display: flex; align-items: center; gap: var(--na-space-3); color: var(--na-ink-100); padding: 0.55rem 0.75rem; border-radius: var(--na-radius-md); font-size: var(--na-text-sm); font-weight: var(--na-font-medium); white-space: nowrap; }
    .side-nav__link:hover { background: var(--na-navy-600); text-decoration: none; }
    .side-nav__link--active { background: var(--na-navy-600); color: var(--na-ink-900); }
    .side-nav__icon { width: 20px; text-align: center; flex-shrink: 0; }
    .collapse-btn { margin: var(--na-space-3); background: var(--na-navy-600); color: var(--na-ink-900); border: none; border-radius: var(--na-radius-md); padding: 0.4rem; }
    .content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      display: flex; align-items: center; gap: var(--na-space-3);
      background: var(--na-surface-raised); border-bottom: 1px solid var(--na-border);
      padding: var(--na-space-3) var(--na-space-5); position: sticky; top: 0; z-index: 50;
    }
    .mock-pill { background: var(--na-warning-bg); color: var(--na-warning); border: 1px solid var(--na-warning); border-radius: var(--na-radius-full); padding: 0.15rem 0.6rem; font-size: var(--na-text-xs); font-weight: var(--na-font-bold); letter-spacing: 0.05em; }
    .topbar__right { margin-left: auto; display: flex; align-items: center; gap: var(--na-space-3); }
    .staff { font-weight: var(--na-font-medium); font-size: var(--na-text-sm); }
    .signout { background: none; border: 1px solid var(--na-border-strong); color: var(--na-ink-700); border-radius: var(--na-radius-md); padding: 0.4rem 0.8rem; font-size: var(--na-text-sm); min-height: 40px; }
    .page { padding: var(--na-space-6); max-width: var(--na-admin-max); width: 100%; margin: 0 auto; }
    @media (max-width: 1023px) {
      .sidebar { position: fixed; z-index: 80; }
      .admin:not(.admin--collapsed) .sidebar { width: var(--na-sidebar-w-collapsed); }
      .side-nav__link span:not(.side-nav__icon) { display: none; }
      .brand__name { display: none; }
      // The rail is fixed (out of flow): offset the content so it never slides under it.
      .content { margin-left: var(--na-sidebar-w-collapsed); }
      .topbar { gap: var(--na-space-2); padding: var(--na-space-3); }
      .staff { display: none; }
    }
    @media (max-width: 639px) {
      .mock-pill { display: none; }
      .signout { padding: 0.4rem 0.55rem; }
      .page { padding: var(--na-space-4); }
    }
  `,
})
export class AdminShell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly collapsed = signal(false);

  readonly visibleNav = computed(() =>
    ADMIN_NAV.filter((item) => this.auth.hasPermission(item.permission)),
  );

  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
