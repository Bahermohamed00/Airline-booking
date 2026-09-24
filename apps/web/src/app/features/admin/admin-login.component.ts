import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { STAFF_ROLE_PERMISSIONS } from '../../core/admin-nav';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <div class="login__visual">
        <div class="login__bg" aria-hidden="true">
          <img
            ngSrc="/assets/img/cabin-premium.jpg"
            fill
            priority
            sizes="(max-width: 899px) 100vw, 50vw"
            alt=""
            class="login__img"
          />
          <div class="login__scrim"></div>
        </div>
        <div class="login__brand">
          <p class="login__brand-name">NovaAir Ops</p>
          <p class="login__brand-tag">
            Operations control for the NovaAir network — flights, bookings, payments and crew in one console.
          </p>
        </div>
      </div>

      <div class="login__panel">
        <div class="card na-card">
          <h1>Staff sign-in</h1>
          <p class="na-text-muted">Choose a demo staff role to explore role-aware access to the operations dashboard.</p>
          <div class="roles">
            @for (role of roles; track role) {
              <button type="button" class="role-btn" (click)="signInAs(role)">
                <span class="role-btn__name">{{ role }}</span>
                <span class="role-btn__hint">{{ hint(role) }}</span>
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .login { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; background: var(--na-surface); }
    .login__visual { position: relative; overflow: hidden; }
    .login__bg { position: absolute; inset: 0; }
    .login__img { object-fit: cover; object-position: center; }
    .login__scrim {
      position: absolute; inset: 0;
      background: linear-gradient(210deg, transparent 25%, var(--na-overlay) 68%, var(--na-navy-900) 100%);
    }
    .login__brand {
      position: absolute; left: var(--na-space-8); right: var(--na-space-8); bottom: var(--na-space-10);
    }
    .login__brand-name {
      font-family: var(--na-font-display); font-size: var(--na-text-3xl);
      font-weight: var(--na-font-bold); color: var(--na-ink-900);
    }
    .login__brand-tag {
      margin-top: var(--na-space-2); color: var(--na-ink-700);
      max-width: 38ch; line-height: var(--na-leading-base);
    }
    .login__panel { display: flex; align-items: center; justify-content: center; padding: var(--na-space-8) var(--na-space-4); }
    .card { width: min(520px, 100%); padding: var(--na-space-8); }
    .card h1 { margin-bottom: var(--na-space-2); }
    .roles { display: flex; flex-direction: column; gap: var(--na-space-3); margin-top: var(--na-space-6); }
    .role-btn { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-3); padding: var(--na-space-4); border: 1px solid var(--na-border-strong); border-radius: var(--na-radius-md); background: var(--na-surface-raised); text-align: left; min-height: 56px; }
    .role-btn:hover { border-color: var(--na-blue-600); background: var(--na-blue-100); }
    .role-btn__name { font-weight: var(--na-font-semibold); }
    .role-btn__hint { color: var(--na-ink-500); font-size: var(--na-text-xs); text-align: right; }
    @media (max-width: 899px) {
      .login { grid-template-columns: 1fr; }
      .login__visual { min-height: 260px; }
      .login__brand { left: var(--na-space-4); right: var(--na-space-4); bottom: var(--na-space-5); }
    }
  `,
})
export class AdminLoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly roles = Object.keys(STAFF_ROLE_PERMISSIONS);

  hint(role: string): string {
    const perms = STAFF_ROLE_PERMISSIONS[role] ?? [];
    return perms.includes('super_admin') ? 'Full access' : `${perms.length} permissions`;
  }

  signInAs(role: string): void {
    this.auth.loginAsRole(role);
    this.router.navigate(['/admin/dashboard']);
  }
}
