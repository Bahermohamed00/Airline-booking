import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { STAFF_ROLE_PERMISSIONS } from '../../core/admin-nav';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-login">
      <div class="card na-card">
        <h1>NovaAir Operations</h1>
        <p class="na-text-muted">Staff sign-in for the operations dashboard. Choose a demo staff role to explore role-aware access.</p>
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
  `,
  styles: `
    .admin-login { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--na-navy-800); padding: var(--na-space-4); }
    .card { width: min(520px, 100%); padding: var(--na-space-8); }
    .card h1 { margin-bottom: var(--na-space-2); }
    .roles { display: flex; flex-direction: column; gap: var(--na-space-3); margin-top: var(--na-space-6); }
    .role-btn { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-3); padding: var(--na-space-4); border: 1px solid var(--na-border-strong); border-radius: var(--na-radius-md); background: var(--na-surface-raised); text-align: left; min-height: 56px; }
    .role-btn:hover { border-color: var(--na-blue-600); background: var(--na-blue-100); }
    .role-btn__name { font-weight: var(--na-font-semibold); }
    .role-btn__hint { color: var(--na-ink-500); font-size: var(--na-text-xs); text-align: right; }
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
