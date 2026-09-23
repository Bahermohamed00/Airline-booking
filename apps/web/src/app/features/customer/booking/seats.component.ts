import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { SeatService, SeatMapState } from '../../../core/services/seat.service';
import { PricingService, formatMoney } from '../../../core/services/pricing.service';
import type { Seat } from '../../../core/models/domain.model';
import type { SeatSelection } from '../../../core/models/booking-flow.model';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { BOOKING_STEPS } from './passengers.component';

const STATE_LABELS: Record<SeatMapState, string> = {
  available: 'Available',
  occupied: 'Occupied',
  selected: 'Selected',
  held: 'Hold expired',
  blocked: 'Blocked',
  exit: 'Exit row',
};

@Component({
  selector: 'na-seats-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NaStepper, NaButton, NaAlert],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="2" />
      <h1>Choose your seats</h1>

      @if (holdExpires()) {
        <p class="hold na-text-small" aria-live="polite">
          Seat hold: <strong class="na-text-mono">{{ countdown() }}</strong> remaining
        </p>
        @if (expiredNotice()) {
          <na-alert tone="danger" icon="⚠" title="Seat hold expired" [dismissible]="true" (dismissed)="expiredNotice.set(false)">
            Your seat hold ran out, so the selected seats were released. Please pick them again.
          </na-alert>
        } @else if (secondsLeft() < 120) {
          <na-alert tone="warning" icon="⏱" title="Hold expiring soon">
            Your held seats will be released in less than two minutes.
          </na-alert>
        }
      }

      <div class="pax-tabs" role="tablist" aria-label="Assign seats per passenger">
        @for (p of passengers(); track $index; let i = $index) {
          <button
            type="button"
            role="tab"
            class="pax-tab"
            [class.pax-tab--active]="i === activePassenger()"
            [attr.aria-selected]="i === activePassenger()"
            (click)="activePassenger.set(i)"
          >
            <span class="pax-tab__name">{{ p.firstName || 'Passenger ' + ($index + 1) }}</span>
            <span class="pax-tab__seat">{{ seatFor(i)?.seatNumber ?? 'No seat' }}</span>
          </button>
        }
      </div>

      <div class="layout">
        <section class="na-card map-panel" aria-label="Seat map">
          <div class="legend" aria-hidden="true">
            <span><i class="sw sw--available"></i>Available</span>
            <span><i class="sw sw--selected"></i>Selected</span>
            <span><i class="sw sw--occupied"></i>Occupied</span>
            <span><i class="sw sw--exit"></i>Exit row</span>
          </div>

          <div class="seatmap" role="group" aria-label="Aircraft seat map">
            <div class="seatmap__cols" aria-hidden="true">
              <span>A</span><span>B</span><span>C</span><span></span><span>D</span><span>E</span><span>F</span>
            </div>
            @for (row of rows(); track row.rowNumber) {
              <div class="seatmap__row">
                @for (seat of row.left; track seat.id) {
                  <button
                    type="button"
                    class="seat seat--{{ stateOf(seat) }}"
                    [disabled]="stateOf(seat) === 'occupied'"
                    [attr.aria-pressed]="isSelected(seat)"
                    [attr.aria-label]="seatAria(seat)"
                    [title]="seatAria(seat)"
                    (click)="toggleSeat(seat)"
                  >
                    <span class="seat__no">{{ seat.seatNumber }}</span>
                    @if (feeOf(seat) > 0 && stateOf(seat) !== 'occupied') {
                      <span class="seat__fee">{{ feeOf(seat) }}€</span>
                    }
                  </button>
                }
                <span class="seatmap__aisle" aria-hidden="true">{{ row.rowNumber }}</span>
                @for (seat of row.right; track seat.id) {
                  <button
                    type="button"
                    class="seat seat--{{ stateOf(seat) }}"
                    [disabled]="stateOf(seat) === 'occupied'"
                    [attr.aria-pressed]="isSelected(seat)"
                    [attr.aria-label]="seatAria(seat)"
                    [title]="seatAria(seat)"
                    (click)="toggleSeat(seat)"
                  >
                    <span class="seat__no">{{ seat.seatNumber }}</span>
                    @if (feeOf(seat) > 0 && stateOf(seat) !== 'occupied') {
                      <span class="seat__fee">{{ feeOf(seat) }}€</span>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <details class="alt">
            <summary>Text seat list (accessible alternative)</summary>
            <ul class="alt__list">
              @for (seat of accessibleSeats(); track seat.id) {
                <li>
                  <button type="button" class="alt__pick" (click)="toggleSeat(seat)">
                    Seat {{ seat.seatNumber }} — {{ label(seat.cabinClass) }}
                    {{ feeOf(seat) > 0 ? ', +' + money(feeOf(seat)) : ', free' }}
                    {{ seat.isExitRow ? '· exit row' : '' }}
                  </button>
                </li>
              }
            </ul>
          </details>
        </section>

        <aside class="na-card side" aria-label="Selection summary">
          <h2>Your selection</h2>
          <ul class="side__list">
            @for (p of passengers(); track $index; let i = $index) {
              <li>
                <span>{{ p.firstName || 'Passenger ' + (i + 1) }}</span>
                <strong>{{ seatFor(i)?.seatNumber ?? '—' }}</strong>
              </li>
            }
          </ul>
          <p class="side__fees na-text-small">
            Seat charges: <strong>{{ money(seatFees()) }}</strong>
          </p>
          <div class="side__actions">
            <na-button variant="secondary" (clicked)="back()">Back</na-button>
            <na-button variant="cta" (clicked)="continue()">Continue to extras</na-button>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); }
    h1 { margin-bottom: var(--na-space-4); }
    .hold { color: var(--na-ink-700); margin-bottom: var(--na-space-3); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .pax-tabs { display: flex; gap: var(--na-space-2); flex-wrap: wrap; margin-bottom: var(--na-space-5); }
    .pax-tab {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      border: 1px solid var(--na-border-strong); background: var(--na-surface-raised);
      border-radius: var(--na-radius-md); padding: var(--na-space-2) var(--na-space-4); min-height: 44px; min-width: 120px;
    }
    .pax-tab--active { border-color: var(--na-blue-600); background: var(--na-blue-100); }
    .pax-tab__name { font-weight: var(--na-font-semibold); font-size: var(--na-text-sm); }
    .pax-tab__seat { font-size: var(--na-text-xs); color: var(--na-ink-500); }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: var(--na-space-5); align-items: start; }
    .map-panel { padding: var(--na-space-5); overflow-x: auto; }
    .legend { display: flex; gap: var(--na-space-4); flex-wrap: wrap; font-size: var(--na-text-xs); color: var(--na-ink-500); margin-bottom: var(--na-space-4); }
    .legend span { display: inline-flex; align-items: center; gap: var(--na-space-1); }
    .sw { width: 14px; height: 14px; border-radius: var(--na-radius-sm); display: inline-block; border: 1px solid var(--na-border-strong); }
    .sw--available { background: var(--na-surface-raised); }
    .sw--selected { background: var(--na-cta); border-color: var(--na-cta); }
    .sw--occupied { background: var(--na-ink-100); }
    .sw--exit { background: var(--na-surface-raised); border-color: var(--na-warning); border-width: 2px; }
    .seatmap { display: inline-block; }
    .seatmap__cols { display: grid; grid-template-columns: repeat(3, 40px) 28px repeat(3, 40px); font-size: var(--na-text-xs); color: var(--na-ink-300); text-align: center; margin-bottom: var(--na-space-1); }
    .seatmap__row { display: grid; grid-template-columns: repeat(3, 40px) 28px repeat(3, 40px); gap: 4px; margin-bottom: 4px; align-items: center; }
    .seatmap__aisle { text-align: center; font-size: var(--na-text-xs); color: var(--na-ink-300); }
    .seat {
      width: 40px; height: 40px; border-radius: var(--na-radius-sm); border: 1px solid var(--na-border-strong);
      background: var(--na-surface-raised); display: flex; flex-direction: column; align-items: center; justify-content: center;
      line-height: 1; padding: 0;
    }
    .seat__no { font-size: 10px; font-weight: var(--na-font-semibold); }
    .seat__fee { font-size: 9px; color: var(--na-ink-500); }
    .seat:hover:not(:disabled) { border-color: var(--na-blue-600); }
    .seat--selected { background: var(--na-cta); border-color: var(--na-cta); color: var(--na-cta-contrast); }
    .seat--selected .seat__fee { color: var(--na-cta-contrast); }
    .seat--occupied { background: var(--na-ink-100); color: var(--na-ink-300); border-color: var(--na-ink-100); }
    .seat--exit { border: 2px solid var(--na-warning); }
    .seat--held { background: var(--na-warning-bg); border-color: var(--na-warning); }
    .alt { margin-top: var(--na-space-5); }
    .alt summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: var(--na-font-semibold); color: var(--na-blue-600); }
    .alt__list { list-style: none; padding: 0; margin: var(--na-space-2) 0 0; display: grid; gap: var(--na-space-1); max-height: 260px; overflow-y: auto; }
    .alt__pick { width: 100%; text-align: left; background: none; border: 1px solid var(--na-border); border-radius: var(--na-radius-sm); padding: var(--na-space-2) var(--na-space-3); min-height: 40px; }
    .alt__pick:hover { background: var(--na-blue-100); }
    .side { padding: var(--na-space-5); position: sticky; top: var(--na-space-4); }
    .side h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .side__list { list-style: none; padding: 0; margin: 0 0 var(--na-space-3); display: grid; gap: var(--na-space-2); }
    .side__list li { display: flex; justify-content: space-between; gap: var(--na-space-3); font-size: var(--na-text-sm); }
    .side__fees { color: var(--na-ink-700); border-top: 1px solid var(--na-border); padding-top: var(--na-space-3); }
    .side__actions { display: grid; gap: var(--na-space-2); margin-top: var(--na-space-4); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; }
    }
  `,
})
export class SeatsPage {
  private readonly router = inject(Router);
  private readonly draft = inject(BookingDraftService);
  private readonly seatsApi = inject(SeatService);
  private readonly pricing = inject(PricingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps = BOOKING_STEPS;
  protected readonly passengers = this.draft.passengers;
  protected readonly activePassenger = signal(0);
  protected readonly selections = signal<SeatSelection[]>([]);
  protected readonly now = signal(Date.now());
  protected readonly accessibleSeats = signal<Seat[]>([]);
  protected readonly expiredNotice = signal(false);

  private readonly occupied = new Set<string>();

  protected readonly rows = computed(() => {
    const f = this.draft.outbound();
    return f ? this.seatsApi.seatMapRows(f) : [];
  });

  protected readonly selectedIds = computed(() => new Set(this.selections().map((s) => s.seat.id)));

  protected readonly holdExpires = this.draft.seatHoldExpiresAt;

  protected readonly secondsLeft = computed(() => {
    const expires = this.holdExpires();
    if (!expires) return 0;
    return Math.max(0, Math.floor((new Date(expires).getTime() - this.now()) / 1000));
  });

  protected readonly countdown = computed(() => {
    const s = this.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  protected readonly seatFees = computed(() =>
    this.selections().reduce((sum, s) => sum + this.pricing.seatFee(s.seat), 0),
  );

  constructor() {
    const d = this.draft.draft();
    if (!d) {
      this.router.navigateByUrl('/search');
      return;
    }
    this.occupied = this.seatsApi.occupiedSeatIds(d.outbound);
    this.selections.set(d.seats);

    // If a previous hold already expired, release it immediately.
    if (this.draft.isHoldExpired()) {
      this.draft.releaseHold();
      this.selections.set([]);
      this.expiredNotice.set(true);
    }

    this.seatsApi
      .accessibleSeatList(d.outbound, d.fare.cabinClass)
      .subscribe((list) => this.accessibleSeats.set(list));

    const timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.draft.isHoldExpired() && this.selections().length > 0) {
        this.draft.releaseHold();
        this.selections.set([]);
        this.expiredNotice.set(true);
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected stateOf(seat: Seat): SeatMapState {
    return this.seatsApi.stateOf(seat, this.occupied, this.selectedIds(), this.holdExpires(), this.now());
  }

  protected isSelected(seat: Seat): boolean {
    return this.selectedIds().has(seat.id);
  }

  protected seatFor(passengerIndex: number): Seat | undefined {
    return this.selections().find((s) => s.passengerIndex === passengerIndex)?.seat;
  }

  protected feeOf(seat: Seat): number {
    return this.pricing.seatFee(seat);
  }

  protected seatAria(seat: Seat): string {
    const state = STATE_LABELS[this.stateOf(seat)];
    const fee = this.pricing.seatFee(seat);
    const feeLabel = fee > 0 ? `, ${formatMoney(fee, 'EUR')}` : ', free';
    return `Seat ${seat.seatNumber}, ${state}${this.stateOf(seat) === 'occupied' ? '' : feeLabel}`;
  }

  protected toggleSeat(seat: Seat): void {
    if (this.stateOf(seat) === 'occupied') return;
    const active = this.activePassenger();
    this.selections.update((list) => {
      const without = list.filter((s) => s.seat.id !== seat.id && s.passengerIndex !== active);
      // Clicking an already-selected seat just deselects it.
      if (list.some((s) => s.seat.id === seat.id)) return without;
      return [...without, { passengerIndex: active, seat }];
    });
    // Auto-advance to the next passenger without a seat.
    const next = this.passengers().findIndex((_, i) => i > active && !this.seatFor(i));
    if (next !== -1) this.activePassenger.set(next);
  }

  protected money(amount: number): string {
    return formatMoney(amount, 'EUR');
  }

  protected label(cabin: string): string {
    return cabin
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  protected continue(): void {
    this.draft.setSeats(this.selections(), []);
    this.router.navigateByUrl('/booking/extras');
  }

  protected back(): void {
    this.router.navigateByUrl('/booking/passengers');
  }
}
