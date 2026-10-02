import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CustomerBookingService } from '../../core/services/customer-booking.service';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaAuthLayout } from './auth-layout.component';

@Component({
  selector: 'app-manage-lookup',
  imports: [ReactiveFormsModule, NaButton, NaAlert, NaAuthLayout],
  template: `
    <na-auth-layout>
      <h1>Find your booking</h1>
      <p class="na-text-muted">Enter the booking reference of a booking on your account. You will be asked to sign in first.</p>

      @if (loginRequired()) {
        <na-alert tone="info" title="Sign in required">
          Bookings are private to your account — please sign in to look one up. Taking you to the login page…
        </na-alert>
      }
      @if (error()) {
        <na-alert tone="danger" title="Lookup failed" dismissible (dismissed)="error.set(null)">{{ error() }}</na-alert>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="na-field">
          <label class="na-label" for="reference">Booking reference</label>
          <input id="reference" class="na-input na-text-mono" type="text" formControlName="reference" placeholder="e.g. NVA7K2" autocomplete="off" [attr.aria-invalid]="form.controls.reference.invalid && form.controls.reference.touched" />
          @if (form.controls.reference.touched && form.controls.reference.errors?.['required']) { <span class="na-error">Booking reference is required.</span> }
        </div>
        <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Find booking</na-button>
      </form>
    </na-auth-layout>
  `,
  styles: `
    h1 { font-size: var(--na-text-2xl); margin-bottom: var(--na-space-2); }
    na-alert { display: block; margin-top: var(--na-space-4); }
    form { margin-top: var(--na-space-6); }
  `,
})
export class ManageLookupPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly bookingService = inject(CustomerBookingService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loginRequired = signal(false);

  readonly form = this.fb.nonNullable.group({
    reference: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    // There is no public lookup API — ownership is enforced server-side, so
    // guests must authenticate before any reference is resolved.
    if (!this.auth.isLoggedIn()) {
      this.loginRequired.set(true);
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/manage' } });
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const reference = this.form.getRawValue().reference.trim();
    this.bookingService.myBookings().subscribe({
      next: (bookings) => {
        this.loading.set(false);
        const match = bookings.find((b) => b.bookingReference.toLowerCase() === reference.toLowerCase());
        if (match) {
          this.router.navigate(['/bookings', match.id]);
        } else {
          this.error.set('No booking found for this reference. Check the code and try again.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to look up your booking right now. Please try again.');
      },
    });
  }
}
