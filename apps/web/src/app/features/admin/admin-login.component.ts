import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { STAFF_ROLE_PERMISSIONS } from '../../core/admin-nav';
import { environment } from '../../../environments/environment';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaButton } from '../../shared/ui/button.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [NgOptimizedImage, ReactiveFormsModule, NaAlert, NaButton],
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
          @if (useRealApi) {
            <p class="na-text-muted">Sign in with your staff account to access the operations dashboard.</p>

            @if (error()) {
              <na-alert tone="danger" title="Sign-in failed">{{ error() }}</na-alert>
            }

            <form [formGroup]="form" (ngSubmit)="submit()">
              <div class="na-field">
                <label class="na-label" for="admin-email">Email</label>
                <input
                  id="admin-email" class="na-input" type="email" formControlName="email" autocomplete="email"
                  [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
                />
                @if (form.controls.email.touched && form.controls.email.errors?.['required']) { <span class="na-error">Email is required.</span> }
                @if (form.controls.email.touched && form.controls.email.errors?.['email']) { <span class="na-error">Enter a valid email address.</span> }
              </div>
              <div class="na-field">
                <label class="na-label" for="admin-password">Password</label>
                <input
                  id="admin-password" class="na-input" type="password" formControlName="password" autocomplete="current-password"
                  [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched"
                />
                @if (form.controls.password.touched && form.controls.password.errors?.['required']) { <span class="na-error">Password is required.</span> }
              </div>
              <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Sign in</na-button>
            </form>

            <p class="demo-hint">Demo credentials: <strong>admin@airline.local</strong> / <strong>Admin123!</strong></p>
          } @else {
            <p class="na-text-muted">Choose a demo staff role to explore role-aware access to the operations dashboard.</p>
            <div class="roles">
              @for (role of roles; track role) {
                <button type="button" class="role-btn" (click)="signInAs(role)">
                  <span class="role-btn__name">{{ role }}</span>
                  <span class="role-btn__hint">{{ hint(role) }}</span>
                </button>
              }
            </div>
          }
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
    na-alert { display: block; margin-top: var(--na-space-4); }
    form { margin-top: var(--na-space-6); }
    .demo-hint { margin-top: var(--na-space-6); padding: var(--na-space-3); background: var(--na-info-bg); border-radius: var(--na-radius-md); font-size: var(--na-text-xs); color: var(--na-info); }
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
  private readonly fb = inject(FormBuilder);
  readonly roles = Object.keys(STAFF_ROLE_PERMISSIONS);
  readonly useRealApi = environment.useRealApi;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  hint(role: string): string {
    const perms = STAFF_ROLE_PERMISSIONS[role] ?? [];
    return perms.includes('super_admin') ? 'Full access' : `${perms.length} permissions`;
  }

  signInAs(role: string): void {
    this.auth.loginAsRole(role);
    this.router.navigate(['/admin/dashboard']);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/admin/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? err?.message ?? 'Unable to sign in. Check your credentials and try again.');
      },
    });
  }
}
