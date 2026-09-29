import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { CheckInService } from '../../../core/services/domain-services';
import type { BoardingPass, Booking, Passenger } from '../../../core/models/domain.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { ToastService } from '../../../shared/ui/toast.service';

interface PassView {
  booking: Booking;
  pass: BoardingPass;
  passenger: Passenger;
}

@Component({
  selector: 'app-boarding-pass',
  standalone: true,
  imports: [NaButton, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      @if (error()) {
        <na-alert tone="danger" title="Could not load the boarding pass" retryable (retry)="load()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="5rem" />
      } @else if (!view()) {
        <na-empty-state
          title="No boarding pass available"
          message="Complete online check-in to get your boarding pass."
          actionLabel="Go to check-in"
          (action)="router.navigate(['/checkin'])"
        />
      } @else if (view(); as v) {
          <h1>Boarding pass</h1>
          <p class="na-text-muted">Present this pass at security and at the gate.</p>

          <article class="pass na-card" aria-label="Boarding pass for {{ v.passenger.firstName }} {{ v.passenger.lastName }}">
            <div class="pass__main">
              <div class="pass__row pass__route">
                <div>
                  <p class="pass__code">{{ v.booking.flight.route.origin.iataCode }}</p>
                  <p class="na-text-muted na-text-small">{{ v.booking.flight.route.origin.city }}</p>
                  <p class="pass__time">{{ timeFmt(v.booking.flight.departureTime) }}</p>
                </div>
                <span class="pass__plane" aria-hidden="true">✈</span>
                <div>
                  <p class="pass__code">{{ v.booking.flight.route.destination.iataCode }}</p>
                  <p class="na-text-muted na-text-small">{{ v.booking.flight.route.destination.city }}</p>
                  <p class="pass__time">{{ timeFmt(v.booking.flight.arrivalTime) }}</p>
                </div>
              </div>
              <dl class="pass__grid">
                <div><dt>Passenger</dt><dd>{{ v.passenger.firstName }} {{ v.passenger.lastName }}</dd></div>
                <div><dt>Flight</dt><dd>{{ v.booking.flight.flightNumber }}</dd></div>
                <div><dt>Date</dt><dd>{{ dateFmt(v.booking.flight.departureTime) }}</dd></div>
                <div><dt>Seat</dt><dd class="pass__seat">{{ v.pass.seatNumber }}</dd></div>
                <div><dt>Group</dt><dd class="pass__seat">{{ v.pass.boardingGroup }}</dd></div>
                <div><dt>Gate</dt><dd>{{ v.pass.gate ?? 'TBA' }}</dd></div>
                <div><dt>Booking ref</dt><dd class="na-text-mono">{{ v.booking.bookingReference }}</dd></div>
                <div><dt>Issued</dt><dd>{{ fmt(v.pass.issuedAt) }}</dd></div>
              </dl>
            </div>
            <div class="pass__stub">
              <div class="qr" role="img" aria-label="Boarding pass QR code placeholder">
                @for (cell of qrCells; track $index) {
                  <span class="qr__cell" [class.qr__cell--on]="cell"></span>
                }
              </div>
              <p class="na-text-muted na-text-small pass__ref na-text-mono">{{ v.booking.bookingReference }}</p>
            </div>
          </article>

          <div class="actions">
            <na-button variant="primary" (clicked)="print()">Print</na-button>
            <na-button variant="secondary" (clicked)="downloadIcs(v)">Download calendar file</na-button>
            <na-button variant="ghost" (clicked)="share(v)">Share</na-button>
          </div>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .pass { margin-top: var(--na-space-6); display: grid; grid-template-columns: 1fr 220px; max-width: 720px; overflow: hidden; }
    .pass__main { padding: var(--na-space-6); }
    .pass__route { display: flex; align-items: center; gap: var(--na-space-6); margin-bottom: var(--na-space-6); }
    .pass__route > div:last-child { text-align: right; }
    .pass__code { font-family: var(--na-font-display); font-size: var(--na-text-3xl); font-weight: var(--na-font-bold); letter-spacing: 0.02em; }
    .pass__time { font-size: var(--na-text-xl); font-weight: var(--na-font-semibold); }
    .pass__plane { font-size: var(--na-text-2xl); color: var(--na-blue-600); }
    .pass__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--na-space-4); margin: 0; }
    .pass__grid dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); }
    .pass__grid dd { margin: 0; font-weight: var(--na-font-medium); }
    .pass__seat { font-size: var(--na-text-xl); font-weight: var(--na-font-bold); }
    .pass__stub {
      border-left: 2px dashed var(--na-border-strong); padding: var(--na-space-6);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--na-space-3);
      background: var(--na-surface-sunken);
    }
    .qr { display: grid; grid-template-columns: repeat(12, 1fr); width: 132px; height: 132px; background: var(--na-cream); border-radius: var(--na-radius-sm); padding: 6px; }
    .qr__cell--on { background: var(--na-brown-900); }
    .pass__ref { text-align: center; letter-spacing: 0.08em; }
    .actions { display: flex; gap: var(--na-space-3); margin-top: var(--na-space-6); flex-wrap: wrap; }
    @media (max-width: 639px) {
      .pass { grid-template-columns: 1fr; }
      .pass__stub { border-left: none; border-top: 2px dashed var(--na-border-strong); }
      .pass__grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media print {
      .actions, .page > p { display: none; }
      .pass { box-shadow: none; }
    }
  `,
})
export class BoardingPassPage {
  private readonly bookingService = inject(BookingService);
  private readonly checkInService = inject(CheckInService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal(false);
  private readonly booking = signal<Booking | undefined>(undefined);

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  private readonly dFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
  private readonly tFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  /** Deterministic pseudo-random QR pattern. */
  readonly qrCells: boolean[] = Array.from({ length: 144 }, (_, i) => {
    const row = Math.floor(i / 12);
    const col = i % 12;
    const inFinder = (row < 3 && col < 3) || (row < 3 && col > 8) || (row > 8 && col < 3);
    if (inFinder) return !(row % 3 === 1 && col % 3 === 1) ? true : (row * col) % 2 === 0;
    return (i * 2654435761) % 97 < 45;
  });

  readonly view = computed<PassView | null>(() => {
    const b = this.booking();
    if (!b) return null;
    const checkIns = this.checkInService
      .alreadyCheckedIn(b.id)
      .filter((c) => b.passengers.some((p) => p.id === c.bookingPassengerId) && c.boardingPass);
    const first = checkIns[0];
    if (!first?.boardingPass) return null;
    const passenger = b.passengers.find((p) => p.id === first.bookingPassengerId)?.passenger;
    if (!passenger) return null;
    return { booking: b, pass: first.boardingPass, passenger };
  });

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('bookingId') ?? '';
    this.loading.set(true);
    this.error.set(false);
    this.bookingService.getById(id).subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.loading.set(false);
        if (booking && !this.view()) {
          this.toast.info('Complete check-in first to view the boarding pass.');
          this.router.navigate(['/checkin']);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  print(): void {
    window.print();
  }

  downloadIcs(v: PassView): void {
    const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NovaAir//Boarding Pass//EN',
      'BEGIN:VEVENT',
      `UID:${v.pass.id}@novaair.dev`,
      `DTSTAMP:${stamp(v.pass.issuedAt)}`,
      `DTSTART:${stamp(v.booking.flight.departureTime)}`,
      `DTEND:${stamp(v.booking.flight.arrivalTime)}`,
      `SUMMARY:Flight ${v.booking.flight.flightNumber} ${v.booking.flight.route.origin.iataCode} → ${v.booking.flight.route.destination.iataCode}`,
      `LOCATION:${v.booking.flight.route.origin.name}`,
      `DESCRIPTION:Seat ${v.pass.seatNumber}\\, group ${v.pass.boardingGroup}\\, gate ${v.pass.gate ?? 'TBA'}. Booking ${v.booking.bookingReference}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novaair-${v.booking.bookingReference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Calendar file downloaded.');
  }

  async share(v: PassView): Promise<void> {
    const url = window.location.href;
    const text = `NovaAir flight ${v.booking.flight.flightNumber} ${v.booking.flight.route.origin.iataCode} → ${v.booking.flight.route.destination.iataCode}, seat ${v.pass.seatNumber}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'NovaAir boarding pass', text, url });
        return;
      }
      throw new Error('share unavailable');
    } catch {
      try {
        await navigator.clipboard.writeText(`${text} — ${url}`);
        this.toast.success('Link copied to clipboard.');
      } catch {
        this.toast.warning('Sharing is not available in this browser.');
      }
    }
  }

  fmt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }

  dateFmt(iso: string): string {
    return this.dFmt.format(new Date(iso));
  }

  timeFmt(iso: string): string {
    return this.tFmt.format(new Date(iso));
  }
}
