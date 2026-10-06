import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerBookingService } from '../../../core/services/customer-booking.service';
import { BOOKING_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { CabinClass } from '../../../core/models/domain.model';
import type { CustomerBooking } from '../../../core/models/customer-booking.model';
import { NaTabs, TabItem } from '../../../shared/ui/tabs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaRouteLine } from '../../../shared/ui/route-line.component';

type BookingTab = 'upcoming' | 'past' | 'cancelled';

interface EmptyStateContent {
  image: string | null;
  title: string;
  message: string;
  actionLabel: string | null;
}

@Component({
  selector: 'app-my-bookings',
  imports: [NaTabs, NaBadge, NaButton, NaAlert, NaEmptyState, NaRouteLine],
  templateUrl: './my-bookings.component.html',
  styleUrl: './my-bookings.component.css',
})
export class MyBookingsPage {
  private readonly bookingService = inject(CustomerBookingService);
  private readonly router = inject(Router);

  readonly BOOKING_STATUS_MAP = BOOKING_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly bookings = signal<CustomerBooking[]>([]);
  readonly activeTab = signal<BookingTab>('upcoming');

  setTab(tab: string): void {
    if (tab === 'upcoming' || tab === 'past' || tab === 'cancelled') {
      this.activeTab.set(tab);
    }
  }

  private readonly dayFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
  private readonly timeFmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  readonly tabs = computed<TabItem[]>(() => {
    const all = this.bookings();
    return [
      { id: 'upcoming', label: 'Upcoming', count: this.bucket(all, 'upcoming').length },
      { id: 'past', label: 'Past', count: this.bucket(all, 'past').length },
      { id: 'cancelled', label: 'Cancelled', count: this.bucket(all, 'cancelled').length },
    ];
  });

  readonly filtered = computed(() => this.bucket(this.bookings(), this.activeTab()));

  readonly emptyState = computed<EmptyStateContent>(() => {
    switch (this.activeTab()) {
      case 'upcoming':
        return {
          image: 'assets/img/hero-wing.jpg',
          title: 'No upcoming journeys',
          message: 'Your next adventure is waiting — search over 120 destinations.',
          actionLabel: 'Search flights',
        };
      case 'past':
        return {
          image: null,
          title: 'No past journeys',
          message: 'Flights you have taken will appear here once the journey is complete.',
          actionLabel: null,
        };
      case 'cancelled':
        return {
          image: null,
          title: 'No cancelled bookings',
          message: 'None of your bookings have been cancelled — everything is on track.',
          actionLabel: null,
        };
    }
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.bookingService.myBookings().subscribe({
      next: (bookings) => {
        this.bookings.set(bookings);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** Check-in only exists for confirmed bookings; PENDING bookings are unpaid. */
  canCheckIn(booking: CustomerBooking): boolean {
    return booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN';
  }

  goCheckIn(): void {
    this.router.navigate(['/checkin']);
  }

  goManage(booking: CustomerBooking): void {
    this.router.navigate(['/bookings', booking.id]);
  }

  goSearch(): void {
    this.router.navigate(['/search']);
  }

  metaLine(booking: CustomerBooking): string {
    const parts = [booking.flight?.flightNumber ?? 'Flight pending'];
    if (booking.cabinClass) parts.push(this.cabinLabel(booking.cabinClass));
    const n = booking.passengers.length;
    parts.push(`${n} ${n === 1 ? 'passenger' : 'passengers'}`);
    return parts.join(' · ');
  }

  fmtDate(iso: string): string {
    return this.dayFmt.format(new Date(iso));
  }

  fmtTime(iso: string): string {
    return this.timeFmt.format(new Date(iso));
  }

  private cabinLabel(cabin: CabinClass): string {
    return cabin.charAt(0) + cabin.slice(1).toLowerCase().replace('_', ' ');
  }

  private bucket(bookings: CustomerBooking[], tab: BookingTab): CustomerBooking[] {
    const now = Date.now();
    return bookings.filter((b) => {
      if (tab === 'cancelled') return b.status === 'CANCELLED';
      if (b.status === 'CANCELLED') return false;
      const dep = b.flight ? new Date(b.flight.departureTime).getTime() : null;
      // A booking without flight details is still actionable — keep it visible.
      if (tab === 'upcoming') return dep === null || dep >= now;
      return dep !== null && dep < now;
    });
  }
}
