import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CheckInApiService } from '../../../core/services/checkin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { BOOKING_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { CheckInBooking } from '../../../core/models/checkin.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';
import { NaSegmented, type SegmentOption } from '../../../shared/ui/segmented.component';

type LookupMode = 'reference' | 'email';

const LOOKUP_MODES: SegmentOption[] = [
  { value: 'reference', label: 'Booking reference' },
  { value: 'email', label: 'Email address' },
];

const CHECKIN_ERROR_MESSAGES: Record<string, string> = {
  CHECKIN_NOT_OPEN: 'Online check-in is not open yet — it opens 24 hours before departure.',
  CHECKIN_CLOSED: 'Online check-in for this flight has closed.',
  ALREADY_CHECKED_IN: 'This passenger is already checked in.',
  CHECKIN_NOT_ELIGIBLE: 'This booking is not eligible for online check-in.',
};

interface Eligibility {
  eligible: boolean;
  reason: string | null;
  opensAt: string;
  closesAt: string;
}

interface NestError {
  status?: number;
  error?: { code?: string; message?: string };
}

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NaButton,
    NaAlert,
    NaBadge,
    NaEmptyState,
    NaRouteLine,
    NaSegmented,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkin.component.html',
  styleUrl: './checkin.component.css',
})
export class CheckInPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CheckInApiService);
  private readonly auth = inject(AuthService);
  readonly router = inject(Router);

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly statusLabel = statusLabel;
  readonly lookupModes = LOOKUP_MODES;

  readonly lookupMode = signal<LookupMode>('reference');
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly lookupRetryable = signal(false);
  /** Null until the first lookup completes. */
  readonly results = signal<CheckInBooking[] | null>(null);
  readonly selected = signal<CheckInBooking | null>(null);
  readonly docConfirmed = signal<Set<string>>(new Set());
  readonly checkingIn = signal<string | null>(null);
  readonly checkInError = signal<string | null>(null);
  /** Declared checked bags per passenger (default 0 — never assumed). */
  readonly bagCounts = signal<Record<string, number>>({});
  /** Issued bag tags returned by the server after a completed check-in. */
  readonly issuedTags = signal<Record<string, { tagNumber: string; status: string }[]>>({});
  readonly bagOptions = [0, 1, 2, 3] as const;
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
    this.form.controls.email.disable();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  setLookupMode(mode: string): void {
    if (mode !== 'reference' && mode !== 'email') return;
    this.lookupMode.set(mode);
    this.lookupError.set(null);
    this.lookupRetryable.set(false);
    const { reference, email } = this.form.controls;
    if (mode === 'reference') {
      reference.enable();
      email.disable();
    } else {
      email.enable();
      reference.disable();
    }
  }

  lookup(): void {
    if (this.form.invalid) return;
    this.lookupLoading.set(true);
    this.lookupError.set(null);
    this.lookupRetryable.set(false);
    const { reference, email } = this.form.getRawValue();
    const request$ =
      this.lookupMode() === 'reference'
        ? this.api.lookupByReference(reference)
        : this.api.lookupByEmail(email);
    request$.subscribe({
      next: (bookings) => {
        this.lookupLoading.set(false);
        this.results.set(bookings);
        if (bookings.length === 0) {
          this.lookupError.set('No booking found. Check your details and try again.');
        }
      },
      error: (err: NestError) => {
        this.lookupLoading.set(false);
        const code = err?.error?.code;
        if (code === 'EMAIL_MISMATCH') {
          this.lookupError.set(
            "This email doesn't match your account. Use the email you signed up with, or look up by booking reference.",
          );
        } else if (err?.status === 404 || code === 'BOOKING_NOT_FOUND') {
          this.lookupError.set('No booking found. Check your details and try again.');
        } else {
          this.lookupError.set(
            err?.error?.message ?? 'Unable to find your booking. Please try again.',
          );
          this.lookupRetryable.set(true);
        }
      },
    });
  }

  select(booking: CheckInBooking): void {
    this.selected.set(booking);
    this.docConfirmed.set(new Set());
    this.bagCounts.set({});
    this.issuedTags.set({});
    this.checkInError.set(null);
  }

  bagCountOf(bookingPassengerId: string): number {
    return this.bagCounts()[bookingPassengerId] ?? 0;
  }

  /** All tags issued during this session's check-ins (flattened). */
  readonly allIssuedTags = computed(() => Object.values(this.issuedTags()).flat());

  setBagCount(bookingPassengerId: string, value: string): void {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 0 || n > 3) return;
    this.bagCounts.update((map) => ({ ...map, [bookingPassengerId]: n }));
  }

  /**
   * Display-only eligibility window (opens departure−24h, closes departure−1h).
   * The server is the enforcement authority — POST /api/checkin 409 codes win.
   */
  eligibilityOf(booking: CheckInBooking): Eligibility {
    const dep = new Date(booking.flight.departureTime).getTime();
    const opensAt = new Date(dep - 24 * 3600 * 1000).toISOString();
    const closesAt = new Date(dep - 60 * 60 * 1000).toISOString();
    if (booking.status !== 'CONFIRMED' && booking.status !== 'CHECKED_IN') {
      return { eligible: false, reason: 'Only confirmed bookings can be checked in.', opensAt, closesAt };
    }
    if (this.now() < dep - 24 * 3600 * 1000) {
      return { eligible: false, reason: 'Online check-in opens 24 hours before departure.', opensAt, closesAt };
    }
    if (this.now() > dep - 60 * 60 * 1000) {
      return { eligible: false, reason: 'Online check-in closed 1 hour before departure.', opensAt, closesAt };
    }
    return { eligible: true, reason: null, opensAt, closesAt };
  }

  opensInFuture(booking: CheckInBooking): boolean {
    const { opensAt } = this.eligibilityOf(booking);
    return new Date(opensAt).getTime() > this.now();
  }

  closingSoon(booking: CheckInBooking): boolean {
    const { closesAt } = this.eligibilityOf(booking);
    return new Date(closesAt).getTime() - this.now() < 2 * 60 * 60 * 1000;
  }

  countdown(iso: string): string {
    const ms = Math.max(0, new Date(iso).getTime() - this.now());
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m} min`;
  }

  allCheckedIn(booking: CheckInBooking): boolean {
    return booking.passengers.length > 0 && booking.passengers.every((p) => p.checkedIn);
  }

  toggleDoc(bookingPassengerId: string): void {
    this.docConfirmed.update((set) => {
      const next = new Set(set);
      if (next.has(bookingPassengerId)) next.delete(bookingPassengerId);
      else next.add(bookingPassengerId);
      return next;
    });
  }

  completeCheckIn(booking: CheckInBooking, bookingPassengerId: string): void {
    if (this.checkingIn()) return;
    this.checkingIn.set(bookingPassengerId);
    this.checkInError.set(null);
    this.api.checkIn(booking.id, bookingPassengerId, this.bagCountOf(bookingPassengerId)).subscribe({
      next: (res) => {
        this.checkingIn.set(null);
        const done = res.checkIns.filter((c) => c.status === 'COMPLETED');
        this.issuedTags.update((map) => ({ ...map, [bookingPassengerId]: res.baggage ?? [] }));
        this.selected.update((current) => {
          if (!current || current.id !== booking.id) return current;
          return {
            ...current,
            status: res.bookingStatus,
            passengers: current.passengers.map((p) => {
              const record = done.find((c) => c.bookingPassengerId === p.bookingPassengerId);
              if (!record) return p;
              return { ...p, checkedIn: true, seatNumber: record.boardingPass.seatNumber };
            }),
          };
        });
      },
      error: (err: NestError) => {
        this.checkingIn.set(null);
        const code = err?.error?.code;
        this.checkInError.set(
          (code && CHECKIN_ERROR_MESSAGES[code]) ??
            err?.error?.message ??
            'Check-in failed. Please try again.',
        );
      },
    });
  }

  goBoardingPass(booking: CheckInBooking): void {
    this.router.navigate(['/checkin', booking.id, 'pass']);
  }

  goToLogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkin' } });
  }

  fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }
}
