import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaAuthLayout } from '../../../layouts/auth-layout.component';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, NaButton, NaAlert, NaAuthLayout],
  template: `
    <na-auth-layout>
      <h1>Forgot your password?</h1>
      <p class="na-text-muted">Enter your account email and we'll send you a reset link.</p>

      @if (sent()) {
        <na-alert tone="success" title="Check your inbox">
          If an account exists for that email, a reset link has been sent. The link expires soon.
        </na-alert>
        <div class="auth-links">
          <a routerLink="/login">Back to sign in</a>
        </div>
      } @else {
        @if (error()) {
          <na-alert tone="danger" title="Something went wrong">{{ error() }}</na-alert>
        }
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="na-field">
            <label class="na-label" for="email">Email</label>
            <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />
            @if (form.controls.email.touched && form.controls.email.invalid) { <span class="na-error">Enter a valid email address.</span> }
          </div>
          <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Send reset link</na-button>
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
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.requestPasswordReset(this.form.getRawValue().email).subscribe({
      // The response is deliberately generic: it never reveals whether the account exists.
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Unable to send the reset link. Please try again.');
      },
    });
  }
}
