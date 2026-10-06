import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingService } from '../../../core/services/booking.service';
import { CheckInService } from '../../../core/services/domain-services';
import { AuthService } from '../../../core/services/auth.service';
import { BOOKING_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { Booking } from '../../../core/models/domain.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaEmptyState, NaRouteLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkin.component.html',
  styleUrl: './checkin.component.css',
})
export class CheckInPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly checkInService = inject(CheckInService);
  private readonly auth = inject(AuthService);
  readonly router = inject(Router);

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly listLoading = signal(false);
  readonly listError = signal(false);
  readonly mine = signal<Booking[]>([]);
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly selected = signal<Booking | null>(null);
  readonly docConfirmed = signal<Set<string>>(new Set());
  readonly checkingIn = signal<string | null>(null);
  readonly now = signal(Date.now());

  private readonly timer = setInterval(() => this.now.set(Date.now()), 1000);
  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  readonly form = this.fb.nonNullable.group({
    reference: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    if (this.isLoggedIn()) this.loadMine();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  loadMine(): void {
    this.listLoading.set(true);
    this.listError.set(false);
    this.bookingService.myBookings().subscribe({
      next: (bookings) => {
        this.mine.set(
          bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'),
        );
        this.listLoading.set(false);
      },
      error: () => {
        this.listLoading.set(false);
        this.listError.set(true);
      },
    });
  }

  lookup(): void {
    if (this.form.invalid) return;
    this.lookupLoading.set(true);
    this.lookupError.set(null);
    const { reference, email } = this.form.getRawValue();
    this.bookingService.findByReference(reference, email).subscribe({
      next: (booking) => {
        this.lookupLoading.set(false);
        if (booking) {
          this.select(booking);
        } else {
          this.lookupError.set('No booking found for this reference.');
        }
      },
      error: (err) => {
        this.lookupLoading.set(false);
        this.lookupError.set(err?.message ?? 'Unable to find your booking. Please try again.');
      },
    });
  }

  select(booking: Booking): void {
    this.selected.set(booking);
    this.docConfirmed.set(new Set());
  }

  eligibilityOf(booking: Booking) {
    return this.checkInService.eligibility(booking, this.now());
  }

  opensInFuture(booking: Booking): boolean {
    const opensAt = this.eligibilityOf(booking).opensAt;
    return !!opensAt && new Date(opensAt).getTime() > this.now();
  }

  closingSoon(booking: Booking): boolean {
    const closesAt = this.eligibilityOf(booking).closesAt;
    return !!closesAt && new Date(closesAt).getTime() - this.now() < 2 * 60 * 60 * 1000;
  }

  countdown(opensAtIso: string): string {
    const ms = Math.max(0, new Date(opensAtIso).getTime() - this.now());
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m} min`;
  }

  alreadyDone(booking: Booking, bookingPassengerId: string): boolean {
    return this.checkInService
      .alreadyCheckedIn(booking.id)
      .some((c) => c.bookingPassengerId === bookingPassengerId && c.status === 'COMPLETED');
  }

  allCheckedIn(booking: Booking): boolean {
    return (
      booking.passengers.length > 0 &&
      booking.passengers.every((bp) => this.alreadyDone(booking, bp.id))
    );
  }

  toggleDoc(bookingPassengerId: string): void {
    this.docConfirmed.update((set) => {
      const next = new Set(set);
      if (next.has(bookingPassengerId)) next.delete(bookingPassengerId);
      else next.add(bookingPassengerId);
      return next;
    });
  }

  completeCheckIn(booking: Booking, passengerIndex: number, bookingPassengerId: string): void {
    if (this.checkingIn()) return;
    this.checkingIn.set(bookingPassengerId);
    this.checkInService.complete(booking, passengerIndex).subscribe({
      next: () => {
        this.checkingIn.set(null);
        this.router.navigate(['/checkin', booking.id, 'pass']);
      },
      error: (err) => {
        this.checkingIn.set(null);
        this.lookupError.set(err?.message ?? 'Check-in failed. Please try again.');
      },
    });
  }

  goBoardingPass(booking: Booking): void {
    this.router.navigate(['/checkin', booking.id, 'pass']);
  }

  seatOf(booking: Booking, bookingPassengerId: string): string | null {
    return (
      booking.seats.find((s) => s.bookingPassengerId === bookingPassengerId)?.seatNumber ?? null
    );
  }

  fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }
}
