import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaAuthLayout } from '../../../layouts/auth-layout.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, NaButton, NaAlert, NaAuthLayout],
  template: `
    <na-auth-layout>
      <h1>Reset your password</h1>

      @if (success()) {
        <na-alert tone="success" title="Password updated">
          Your password has been changed. All previous sessions have been signed out — sign in with your new password.
        </na-alert>
        <div class="auth-links">
          <a routerLink="/login">Sign in</a>
        </div>
      } @else if (missingToken) {
        <na-alert tone="danger" title="Invalid reset link">
          This link is missing its reset token. Request a new reset link to continue.
        </na-alert>
        <div class="auth-links">
          <a routerLink="/forgot-password">Request a new link</a>
        </div>
      } @else {
        <p class="na-text-muted">Choose a new password for your account.</p>

        @if (error()) {
          <na-alert tone="danger" title="Could not reset your password">{{ error() }}</na-alert>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="na-field">
            <label class="na-label" for="newPassword">New password</label>
            <input id="newPassword" class="na-input" type="password" formControlName="newPassword" autocomplete="new-password" aria-describedby="new-pwd-hint" [attr.aria-invalid]="form.controls.newPassword.invalid && form.controls.newPassword.touched" />
            <span id="new-pwd-hint" class="na-hint">At least 12 characters.</span>
            @if (form.controls.newPassword.touched && form.controls.newPassword.errors?.['minlength']) { <span class="na-error">Password must be at least 12 characters.</span> }
          </div>
          <div class="na-field">
            <label class="na-label" for="confirmPassword">Confirm new password</label>
            <input id="confirmPassword" class="na-input" type="password" formControlName="confirmPassword" autocomplete="new-password" [attr.aria-invalid]="form.controls.confirmPassword.touched && form.errors?.['passwordMismatch']" />
            @if (form.controls.confirmPassword.touched && form.errors?.['passwordMismatch']) { <span class="na-error">Passwords do not match.</span> }
          </div>
          <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Update password</na-button>
        </form>

        <div class="auth-links">
          <a routerLink="/login">Back to sign in</a>
        </div>
      }
    </na-auth-layout>
  `,
  styles: `
    h1 { font-size: var(--na-text-2xl); margin-bottom: var(--na-space-2); }
    na-alert { display: block; margin-top: var(--na-space-4); }
    form { margin: var(--na-space-6) 0; }
    .auth-links { display: flex; gap: var(--na-space-2); justify-content: center; margin-top: var(--na-space-4); font-size: var(--na-text-sm); }
  `,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  // The token travels from the email link into the API call only; it is never rendered.
  private readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly missingToken = !this.token;
  readonly loading = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  submit(): void {
    if (this.form.invalid || !this.token) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token, this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        // The backend uses one generic 400 for token failures; DTO validation
        // failures carry a different message and should be shown as-is.
        const isTokenError = err?.status === 400 && typeof err?.message === 'string' && err.message.includes('Invalid or expired token');
        this.error.set(
          isTokenError
            ? 'This reset link is invalid or has expired. Request a new one to continue.'
            : (err?.message ?? 'Unable to reset your password. Please try again.'),
        );
      },
    });
  }
}
