import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BookingDraftService } from './booking-draft.service';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { FLIGHT_STATUS_MAP } from '../../../core/status-maps';
import type { BookingDraft } from '../../../core/models/booking-flow.model';
import type { CreateBookingPayload } from '../../../core/models/customer-booking.model';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { BOOKING_STEPS } from './passengers.component';

@Component({
  selector: 'na-review-page',
  imports: [RouterLink, NaStepper, NaButton, NaBadge, NaAlert],
  templateUrl: './review.component.html',
  styleUrl: './review.component.css',
})
export class ReviewPage {
  private readonly router = inject(Router);
  private readonly draftApi = inject(BookingDraftService);
  private readonly bookings = inject(CustomerBookingService);
  private readonly auth = inject(AuthService);

  protected readonly steps = BOOKING_STEPS;
  protected readonly draft = this.draftApi.draft;
  protected readonly consent = signal(false);
  protected readonly consentError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitErrorRetryable = signal(false);

  /**
   * Server-consistent figures: the server prices a booking as fare components
   * × passenger count. There are no seat charges, extras or discounts.
   */
  protected readonly breakdown = computed(() => {
    const d = this.draft();
    if (!d) return null;
    const passengerCount = d.passengers.length;
    const base = d.fare.basePrice * passengerCount;
    const taxes = d.fare.taxAmount * passengerCount;
    const fees = d.fare.feeAmount * passengerCount;
    return { passengerCount, base, taxes, fees, total: base + taxes + fees };
  });

  protected readonly holdWarning = computed(() => {
    const d = this.draft();
    return !!d && d.seats.length > 0 && this.draftApi.isHoldExpired();
  });

  constructor() {
    if (!this.draft()) {
      this.router.navigateByUrl('/search');
    }
  }

  protected seatNumber(d: BookingDraft, passengerIndex: number): string | null {
    return d.seats.find((s) => s.passengerIndex === passengerIndex)?.seat.seatNumber ?? null;
  }

  protected submit(): void {
    const d = this.draft();
    if (!d || d.passengers.length === 0 || this.submitting()) return;
    if (!this.consent()) {
      this.consentError.set(true);
      return;
    }
    this.consentError.set(false);
    // The route's authGuard enforces this too; redirect defensively so a guest
    // who reached this page can log in and land back here.
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
      return;
    }

    // Exactly the CreateBookingDto contract — the server owns identity (JWT),
    // booking reference, status and totals; never send client-computed fields.
    const payload: CreateBookingPayload = {
      flightId: d.outbound.id,
      cabinClass: d.fare.cabinClass,
      seatIds: d.seats.map((s) => s.seat.id),
      passengers: d.passengers.map((p) => ({
        passengerType: p.passengerType,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        ...(p.dateOfBirth ? { dateOfBirth: p.dateOfBirth } : {}),
        ...(p.nationality ? { nationality: p.nationality } : {}),
        ...(p.passportNumber ? { passportNumber: p.passportNumber } : {}),
      })),
      ...(d.contactEmail ? { contactEmail: d.contactEmail } : {}),
      ...(d.contactPhone ? { contactPhone: d.contactPhone } : {}),
    };

    this.submitting.set(true);
    this.submitError.set(null);
    this.bookings.create(payload).subscribe({
      next: (booking) => {
        this.submitting.set(false);
        this.draftApi.setConfirmedBooking(booking);
        this.router.navigate(['/booking/confirmation'], { queryParams: { id: booking.id } });
      },
      error: (err: HttpErrorResponse) => this.handleCreateError(err),
    });
  }

  private handleCreateError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    switch (err?.status) {
      case 401:
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
        return;
      case 400: {
        const message = (err.error as { message?: string | string[] } | undefined)?.message;
        this.submitError.set(
          Array.isArray(message)
            ? message.join(' ')
            : (message ?? 'The booking details were rejected. Please review them and try again.'),
        );
        this.submitErrorRetryable.set(false);
        return;
      }
      case 404:
        this.submitError.set('This flight is no longer available. Please start a new search.');
        this.submitErrorRetryable.set(false);
        return;
      case 409:
        // Seat conflict: drop the local selection so the user re-picks from
        // refreshed availability on the seats page.
        this.draftApi.releaseHold();
        this.router.navigate(['/booking/seats'], { state: { seatConflict: true } });
        return;
      default:
        this.submitError.set(
          'The booking could not be created right now. Your details are preserved — you can safely try again.',
        );
        this.submitErrorRetryable.set(true);
    }
  }

  protected money(amount: number): string {
    const currency = this.draft()?.fare.currency ?? 'EUR';
    return formatMoney(amount, currency);
  }

  protected time(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  }

  protected fullDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  protected cabinName(cabin: string): string {
    return cabin
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  protected typeLabel(type: string): string {
    return type === 'ADULT' ? 'Adult' : type === 'CHILD' ? 'Child' : 'Infant';
  }

  protected statusLabel(status: keyof typeof FLIGHT_STATUS_MAP): string {
    return FLIGHT_STATUS_MAP[status].label;
  }

  protected statusTone(status: keyof typeof FLIGHT_STATUS_MAP) {
    return FLIGHT_STATUS_MAP[status].tone;
  }
}
