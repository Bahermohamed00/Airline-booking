import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { ToastService } from '../../shared/ui/toast.service';
import { NaAuthLayout } from './auth-layout.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NaButton, NaAlert, NaAuthLayout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <na-auth-layout>
      <h1>Create your account</h1>
      <p class="na-text-muted">Join NovaAir to book flights, check in online, and earn miles.</p>

      @if (error()) {
        <na-alert tone="danger" title="Registration failed">{{ error() }}</na-alert>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="name-row">
          <div class="na-field">
            <label class="na-label" for="firstName">First name</label>
            <input id="firstName" class="na-input" type="text" formControlName="firstName" autocomplete="given-name" [attr.aria-invalid]="form.controls.firstName.invalid && form.controls.firstName.touched" />
            @if (form.controls.firstName.touched && form.controls.firstName.errors?.['required']) { <span class="na-error">First name is required.</span> }
          </div>
          <div class="na-field">
            <label class="na-label" for="lastName">Last name</label>
            <input id="lastName" class="na-input" type="text" formControlName="lastName" autocomplete="family-name" [attr.aria-invalid]="form.controls.lastName.invalid && form.controls.lastName.touched" />
            @if (form.controls.lastName.touched && form.controls.lastName.errors?.['required']) { <span class="na-error">Last name is required.</span> }
          </div>
        </div>
        <div class="na-field">
          <label class="na-label" for="email">Email</label>
          <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />
          @if (form.controls.email.touched && form.controls.email.errors?.['required']) { <span class="na-error">Email is required.</span> }
          @if (form.controls.email.touched && form.controls.email.errors?.['email']) { <span class="na-error">Enter a valid email address.</span> }
        </div>
        <div class="na-field">
          <label class="na-label" for="password">Password</label>
          <input id="password" class="na-input" type="password" formControlName="password" autocomplete="new-password" aria-describedby="password-hint" [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched" />
          <span id="password-hint" class="na-hint">At least 12 characters.</span>
          @if (form.controls.password.touched && form.controls.password.errors?.['required']) { <span class="na-error">Password is required.</span> }
          @if (form.controls.password.touched && form.controls.password.errors?.['minlength']) { <span class="na-error">Password must be at least 12 characters.</span> }
        </div>
        <div class="na-field">
          <label class="na-label" for="confirmPassword">Confirm password</label>
          <input id="confirmPassword" class="na-input" type="password" formControlName="confirmPassword" autocomplete="new-password" [attr.aria-invalid]="form.controls.confirmPassword.touched && (form.controls.confirmPassword.invalid || form.errors?.['passwordMismatch'])" />
          @if (form.controls.confirmPassword.touched && form.controls.confirmPassword.errors?.['required']) { <span class="na-error">Please confirm your password.</span> }
          @if (form.controls.confirmPassword.touched && form.errors?.['passwordMismatch']) { <span class="na-error">Passwords do not match.</span> }
        </div>
        <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Create account</na-button>
      </form>

      <div class="auth-links">
        <span>Already have an account?</span>
        <a routerLink="/login">Sign in</a>
      </div>
    </na-auth-layout>
  `,
  styles: `
    h1 { font-size: var(--na-text-2xl); margin-bottom: var(--na-space-2); }
    na-alert { display: block; margin-top: var(--na-space-4); }
    form { margin: var(--na-space-6) 0; }
    .name-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4); }
    .auth-links { display: flex; gap: var(--na-space-2); justify-content: center; margin-top: var(--na-space-4); font-size: var(--na-text-sm); }
    @media (max-width: 639px) {
      .name-row { grid-template-columns: 1fr; gap: 0; }
    }
  `,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password, firstName, lastName } = this.form.getRawValue();
    this.auth.register({ email, password, firstName, lastName }).subscribe({
      next: () => {
        this.toast.success('Account created. Check your email to verify your address, then sign in.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Unable to create your account. Please try again.');
      },
    });
  }
}
