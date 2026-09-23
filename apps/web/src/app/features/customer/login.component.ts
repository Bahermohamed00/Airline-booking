import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NaButton, NaAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container auth-page">
      <div class="auth-card na-card">
        <h1>Sign in to NovaAir</h1>
        <p class="na-text-muted">Access your bookings, check in, and manage your trips.</p>

        @if (error()) {
          <na-alert tone="danger" title="Sign-in failed">{{ error() }}</na-alert>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="na-field">
            <label class="na-label" for="email">Email</label>
            <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />
            @if (form.controls.email.touched && form.controls.email.errors?.['required']) { <span class="na-error">Email is required.</span> }
            @if (form.controls.email.touched && form.controls.email.errors?.['email']) { <span class="na-error">Enter a valid email address.</span> }
          </div>
          <div class="na-field">
            <label class="na-label" for="password">Password</label>
            <input id="password" class="na-input" type="password" formControlName="password" autocomplete="current-password" [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched" />
            @if (form.controls.password.touched && form.controls.password.errors?.['required']) { <span class="na-error">Password is required.</span> }
          </div>
          <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Sign in</na-button>
        </form>

        <div class="auth-links">
          <a routerLink="/login/reset">Forgot your password?</a>
          <span>·</span>
          <a routerLink="/register">Create an account</a>
        </div>

        <p class="demo-hint">Demo account: <strong>customer@example.com</strong> with any password of 8+ characters.</p>
      </div>
    </div>
  `,
  styles: `
    .auth-page { display: flex; justify-content: center; padding-top: var(--na-space-12); }
    .auth-card { width: min(440px, 100%); padding: var(--na-space-8); }
    .auth-card h1 { font-size: var(--na-text-2xl); margin-bottom: var(--na-space-2); }
    .auth-card form { margin: var(--na-space-6) 0; display: block; }
    .auth-links { display: flex; gap: var(--na-space-2); justify-content: center; margin-top: var(--na-space-4); font-size: var(--na-text-sm); }
    .demo-hint { margin-top: var(--na-space-6); padding: var(--na-space-3); background: var(--na-info-bg); border-radius: var(--na-radius-md); font-size: var(--na-text-xs); color: var(--na-info); }
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (result) => {
        this.auth.setSession(result.user);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/bookings';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Unable to sign in. Check your credentials and try again.');
      },
    });
  }
}
