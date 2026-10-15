import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthService, type AuthError } from '../../../core/services/auth.service';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaAuthLayout } from './auth-layout.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

/** Mirrors the backend rule (AuthService.register): the 18th birthday itself passes. */
function minAge(years: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return { invalidDate: true };
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    return dob <= cutoff ? null : { minAge: true };
  };
}

/** Mirrors RegisterDto.PHONE_PATTERN (backend stays the final authority). */
const PHONE_PATTERN = /^\+?[0-9][0-9().\s-]{4,19}$/;

/** Mirrors RegisterDto.STREET_ADDRESS_PATTERN (backend stays the final authority). */
const STREET_ADDRESS_PATTERN = /^(?=.*[\p{L}\p{N}]).{5,255}$/u;

/** Mirrors RegisterDto.NATIONAL_ID_PATTERN: Egyptian national ID, exactly 14 digits. */
const NATIONAL_ID_PATTERN = /^\d{14}$/;

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
            <input
              id="firstName"
              class="na-input"
              type="text"
              formControlName="firstName"
              autocomplete="given-name"
              [attr.aria-invalid]="
                form.controls.firstName.invalid && form.controls.firstName.touched
              "
            />
            @if (form.controls.firstName.touched && form.controls.firstName.errors?.['required']) {
              <span class="na-error">First name is required.</span>
            }
          </div>
          <div class="na-field">
            <label class="na-label" for="lastName">Last name</label>
            <input
              id="lastName"
              class="na-input"
              type="text"
              formControlName="lastName"
              autocomplete="family-name"
              [attr.aria-invalid]="form.controls.lastName.invalid && form.controls.lastName.touched"
            />
            @if (form.controls.lastName.touched && form.controls.lastName.errors?.['required']) {
              <span class="na-error">Last name is required.</span>
            }
          </div>
        </div>
        <div class="na-field">
          <label class="na-label" for="dateOfBirth">Date of birth</label>
          <input
            id="dateOfBirth"
            class="na-input"
            type="date"
            formControlName="dateOfBirth"
            autocomplete="bday"
            [attr.aria-invalid]="
              form.controls.dateOfBirth.invalid && form.controls.dateOfBirth.touched
            "
          />
          @if (
            form.controls.dateOfBirth.touched && form.controls.dateOfBirth.errors?.['required']
          ) {
            <span class="na-error">Date of birth is required.</span>
          }
          @if (form.controls.dateOfBirth.touched && form.controls.dateOfBirth.errors?.['minAge']) {
            <span class="na-error">You must be at least 18 years old to register.</span>
          }
          @if (
            form.controls.dateOfBirth.touched && form.controls.dateOfBirth.errors?.['invalidDate']
          ) {
            <span class="na-error">Enter a valid date of birth.</span>
          }
        </div>
        <div class="na-field">
          <label class="na-label" for="phone">Mobile number</label>
          <input
            id="phone"
            class="na-input"
            type="tel"
            formControlName="phone"
            autocomplete="tel"
            [attr.aria-invalid]="form.controls.phone.invalid && form.controls.phone.touched"
          />
          @if (form.controls.phone.touched && form.controls.phone.errors?.['required']) {
            <span class="na-error">Please enter your mobile number.</span>
          }
          @if (form.controls.phone.touched && form.controls.phone.errors?.['pattern']) {
            <span class="na-error">Invalid mobile number.</span>
          }
          @if (form.controls.phone.touched && form.controls.phone.errors?.['server']) {
            <span class="na-error">{{ form.controls.phone.errors?.['server'] }}</span>
          }
        </div>
        <div class="na-field">
          <label class="na-label" for="streetAddress">Street address</label>
          <input
            id="streetAddress"
            class="na-input"
            type="text"
            formControlName="streetAddress"
            autocomplete="street-address"
            [attr.aria-invalid]="
              form.controls.streetAddress.invalid && form.controls.streetAddress.touched
            "
          />
          @if (
            form.controls.streetAddress.touched && form.controls.streetAddress.errors?.['required']
          ) {
            <span class="na-error">Please enter your street address.</span>
          }
          @if (
            form.controls.streetAddress.touched && form.controls.streetAddress.errors?.['pattern']
          ) {
            <span class="na-error">Invalid street address.</span>
          }
          @if (
            form.controls.streetAddress.touched && form.controls.streetAddress.errors?.['server']
          ) {
            <span class="na-error">{{ form.controls.streetAddress.errors?.['server'] }}</span>
          }
        </div>
        <div class="na-field">
          <label class="na-label" for="nationalId">National ID</label>
          <input
            id="nationalId"
            class="na-input"
            type="text"
            formControlName="nationalId"
            inputmode="numeric"
            autocomplete="off"
            aria-describedby="nationalId-hint"
            [attr.aria-invalid]="
              form.controls.nationalId.invalid && form.controls.nationalId.touched
            "
          />
          <span id="nationalId-hint" class="na-hint">Your 14-digit Egyptian national ID.</span>
          @if (
            form.controls.nationalId.touched && form.controls.nationalId.errors?.['required']
          ) {
            <span class="na-error">Please enter your national ID.</span>
          }
          @if (form.controls.nationalId.touched && form.controls.nationalId.errors?.['pattern']) {
            <span class="na-error">National ID must be exactly 14 digits.</span>
          }
          @if (form.controls.nationalId.touched && form.controls.nationalId.errors?.['server']) {
            <span class="na-error">{{ form.controls.nationalId.errors?.['server'] }}</span>
          }
        </div>
        <div class="na-field">
          <label class="na-label" for="email">Email</label>
          <input
            id="email"
            class="na-input"
            type="email"
            formControlName="email"
            autocomplete="email"
            [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
          />
          @if (form.controls.email.touched && form.controls.email.errors?.['required']) {
            <span class="na-error">Email is required.</span>
          }
          @if (form.controls.email.touched && form.controls.email.errors?.['email']) {
            <span class="na-error">Enter a valid email address.</span>
          }
        </div>
        <div class="na-field">
          <label class="na-label" for="password">Password</label>
          <input
            id="password"
            class="na-input"
            type="password"
            formControlName="password"
            autocomplete="new-password"
            aria-describedby="password-hint"
            [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched"
          />
          <span id="password-hint" class="na-hint">At least 12 characters.</span>
          @if (form.controls.password.touched && form.controls.password.errors?.['required']) {
            <span class="na-error">Password is required.</span>
          }
          @if (form.controls.password.touched && form.controls.password.errors?.['minlength']) {
            <span class="na-error">Password must be at least 12 characters.</span>
          }
        </div>
        <div class="na-field">
          <label class="na-label" for="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            class="na-input"
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
            [attr.aria-invalid]="
              form.controls.confirmPassword.touched &&
              (form.controls.confirmPassword.invalid || form.errors?.['passwordMismatch'])
            "
          />
          @if (
            form.controls.confirmPassword.touched &&
            form.controls.confirmPassword.errors?.['required']
          ) {
            <span class="na-error">Please confirm your password.</span>
          }
          @if (form.controls.confirmPassword.touched && form.errors?.['passwordMismatch']) {
            <span class="na-error">Passwords do not match.</span>
          }
        </div>
        <na-button
          variant="cta"
          size="lg"
          type="submit"
          [loading]="loading()"
          [disabled]="form.invalid"
          >Create account</na-button
        >
      </form>

      <div class="auth-links">
        <span>Already have an account?</span>
        <a routerLink="/login">Sign in</a>
      </div>
    </na-auth-layout>
  `,
  styles: `
    h1 {
      font-size: var(--na-text-2xl);
      margin-bottom: var(--na-space-2);
    }
    na-alert {
      display: block;
      margin-top: var(--na-space-4);
    }
    form {
      margin: var(--na-space-6) 0;
    }
    .name-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--na-space-4);
    }
    .auth-links {
      display: flex;
      gap: var(--na-space-2);
      justify-content: center;
      margin-top: var(--na-space-4);
      font-size: var(--na-text-sm);
    }
    @media (max-width: 639px) {
      .name-row {
        grid-template-columns: 1fr;
        gap: 0;
      }
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
      dateOfBirth: ['', [Validators.required, minAge(18)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
      streetAddress: ['', [Validators.required, Validators.pattern(STREET_ADDRESS_PATTERN)]],
      nationalId: ['', [Validators.required, Validators.pattern(NATIONAL_ID_PATTERN)]],
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
    const { email, password, firstName, lastName, dateOfBirth, phone, streetAddress, nationalId } =
      this.form.getRawValue();
    this.auth
      .register({ email, password, firstName, lastName, dateOfBirth, phone, streetAddress, nationalId })
      .subscribe({
        next: () => {
          this.toast.success(
            'Account created. Check your email to verify your address, then sign in.',
          );
          this.router.navigate(['/login']);
        },
        error: (err: AuthError) => {
          this.loading.set(false);
          if (this.applyServerFieldErrors(err)) return;
          this.error.set(err?.message ?? 'Unable to create your account. Please try again.');
        },
      });
  }

  /**
   * Maps API 400 validation messages back onto their fields, so the user sees
   * e.g. "Please enter your mobile number." / "Invalid street address." next to
   * the input instead of a generic banner. When a field produced both messages
   * (missing value), the "Please enter…" one wins. Returns true when at least
   * one message was mapped to a field.
   */
  private applyServerFieldErrors(err: AuthError): boolean {
    const messages = err.messages ?? [err.message];
    let mapped = false;
    for (const message of messages) {
      const control = message.includes('mobile number')
        ? this.form.controls.phone
        : message.includes('street address')
          ? this.form.controls.streetAddress
          : message.toLowerCase().includes('national id')
            ? this.form.controls.nationalId
            : null;
      if (!control) continue;
      const current = control.errors?.['server'] as string | undefined;
      if (!current || message.startsWith('Please enter')) {
        control.setErrors({ ...control.errors, server: message });
      }
      control.markAsTouched();
      mapped = true;
    }
    return mapped;
  }
}
