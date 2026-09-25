import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';

@Component({
  selector: 'app-admin-login',
  imports: [NgOptimizedImage, ReactiveFormsModule, NaButton, NaAlert],
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
          <p class="na-text-muted">Operations access requires a staff account. Use your NovaAir crew credentials.</p>

          @if (error()) {
            <na-alert tone="danger" title="Sign-in failed">{{ error() }}</na-alert>
          }
          @if (notice()) {
            <na-alert tone="info" title="Signed out">{{ notice() }}</na-alert>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="na-field">
              <label class="na-label" for="admin-email">Email</label>
              <input id="admin-email" class="na-input" type="email" formControlName="email" autocomplete="email" />
            </div>
            <div class="na-field">
              <label class="na-label" for="admin-password">Password</label>
              <input id="admin-password" class="na-input" type="password" formControlName="password" autocomplete="current-password" />
            </div>
            <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Sign in to Ops</na-button>
          </form>
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
    na-alert { display: block; margin-top: var(--na-space-4); }
    form { margin-top: var(--na-space-6); display: grid; gap: var(--na-space-2); }
    @media (max-width: 899px) {
      .login { grid-template-columns: 1fr; }
      .login__visual { min-height: 260px; }
      .login__brand { left: var(--na-space-4); right: var(--na-space-4); bottom: var(--na-space-5); }
    }
  `,
})
export class AdminLoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(
    this.route.snapshot.queryParamMap.get('reason') === 'session-expired'
      ? 'Your session has expired. Please sign in again.'
      : null,
  );

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (result) => {
        this.auth.setSession(result.user);
        if (!this.auth.isStaff()) {
          // Valid credentials, wrong portal: drop the session again.
          this.auth.logout();
          this.loading.set(false);
          this.error.set('This portal is restricted to staff accounts.');
          return;
        }
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl ?? '/admin/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Unable to sign in. Check your credentials and try again.');
      },
    });
  }
}
