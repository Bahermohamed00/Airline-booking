import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingService } from '../../core/services/booking.service';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';

@Component({
  selector: 'app-manage-lookup',
  standalone: true,
  imports: [ReactiveFormsModule, NaButton, NaAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <div class="lookup na-card">
        <h1>Find your booking</h1>
        <p class="na-text-muted">Enter your booking reference and contact email to manage a booking without signing in.</p>

        @if (error()) {
          <na-alert tone="danger" title="Lookup failed" dismissible (dismissed)="error.set(null)">{{ error() }}</na-alert>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="na-field">
            <label class="na-label" for="reference">Booking reference</label>
            <input id="reference" class="na-input na-text-mono" type="text" formControlName="reference" placeholder="e.g. NVA7K2" autocomplete="off" [attr.aria-invalid]="form.controls.reference.invalid && form.controls.reference.touched" />
            @if (form.controls.reference.touched && form.controls.reference.errors?.['required']) { <span class="na-error">Booking reference is required.</span> }
          </div>
          <div class="na-field">
            <label class="na-label" for="email">Contact email</label>
            <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />
            @if (form.controls.email.touched && form.controls.email.errors?.['required']) { <span class="na-error">Email is required.</span> }
            @if (form.controls.email.touched && form.controls.email.errors?.['email']) { <span class="na-error">Enter a valid email address.</span> }
          </div>
          <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Find booking</na-button>
        </form>
      </div>
    </div>
  `,
  styles: `
    .page { display: flex; justify-content: center; padding-top: var(--na-space-12); padding-bottom: var(--na-space-16); }
    .lookup { width: min(480px, 100%); padding: var(--na-space-8); }
    .lookup h1 { font-size: var(--na-text-2xl); margin-bottom: var(--na-space-2); }
    .lookup form { margin-top: var(--na-space-6); }
    .lookup na-alert { display: block; margin-top: var(--na-space-4); }
  `,
})
export class ManageLookupPage {
  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    reference: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { reference, email } = this.form.getRawValue();
    this.bookingService.findByReference(reference, email).subscribe({
      next: (booking) => {
        this.loading.set(false);
        if (booking) {
          this.router.navigate(['/bookings', booking.id]);
        } else {
          this.error.set('No booking found for this reference. Check the code and try again.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.status === 403
            ? (err?.message ?? 'The email does not match this booking.')
            : 'Unable to look up your booking right now. Please try again.',
        );
      },
    });
  }
}
