import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaAuthLayout } from './auth-layout.component';

type VerifyState = 'verifying' | 'success' | 'error' | 'missing';

@Component({
  selector: 'app-verify-email',
  imports: [ReactiveFormsModule, RouterLink, NaButton, NaAlert, NaAuthLayout],
  template: `
    <na-auth-layout>
      <h1>Verify your email</h1>

      @if (state() === 'verifying') {
        <p class="na-text-muted">Verifying your email address…</p>
      }

      @if (state() === 'success') {
        <na-alert tone="success" title="Email verified">Your account is now active. You can sign in.</na-alert>
        <div class="auth-links">
          <a routerLink="/login">Sign in</a>
        </div>
      }

      @if (state() === 'error') {
        <na-alert tone="danger" title="Verification failed">{{ error() }}</na-alert>
      }

      @if (state() === 'error' || state() === 'missing') {
        <p class="na-text-muted">Enter your email address and we'll send you a new verification link.</p>
        <form [formGroup]="resendForm" (ngSubmit)="resend()">
          <div class="na-field">
            <label class="na-label" for="email">Email</label>
            <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" />
            @if (resendForm.controls.email.touched && resendForm.controls.email.invalid) { <span class="na-error">Enter a valid email address.</span> }
          </div>
          <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="resendForm.invalid">Resend verification link</na-button>
        </form>
        @if (resent()) {
          <na-alert tone="info" title="Check your inbox">If an account exists for that email, a new verification link has been sent.</na-alert>
        }
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
export class VerifyEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly state = signal<VerifyState>('verifying');
  readonly error = signal<string | null>(null);
  readonly resent = signal(false);
  readonly loading = signal(false);

  readonly resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('missing');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      error: (err) => {
        this.error.set(err?.message ?? 'This verification link is invalid or has expired.');
        this.state.set('error');
      },
    });
  }

  resend(): void {
    if (this.resendForm.invalid) return;
    this.loading.set(true);
    // The API response is deliberately anti-enumeration, so the same message is
    // shown whether or not the account exists.
    this.auth.resendVerification(this.resendForm.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        this.resent.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.resent.set(true);
      },
    });
  }
}
