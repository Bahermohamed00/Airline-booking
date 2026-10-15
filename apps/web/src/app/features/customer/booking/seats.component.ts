import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BookingDraftService } from './booking-draft.service';
import { SeatService, SeatMapState, type SeatMapRow } from './seat.service';
import type { CabinClass, Seat } from '../../../core/models/domain.model';
import type { SeatSelection } from '../../../core/models/booking-flow.model';
import { formatMoney } from '../../../core/services/pricing.service';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { BOOKING_STEPS } from './passengers.component';

const STATE_LABELS: Record<SeatMapState, string> = {
  available: 'Available',
  occupied: 'Occupied',
  selected: 'Selected',
  held: 'Hold expired',
  blocked: 'Not available with your fare',
  exit: 'Exit row, extra legroom',
};

type SeatPosition = 'window' | 'middle' | 'aisle';

/** Consecutive rows sharing one cabin class, in cabin order from the nose. */
interface CabinSection {
  cabin: CabinClass;
  rowStart: number;
  rowEnd: number;
  rows: SeatMapRow[];
}

@Component({
  selector: 'na-seats-page',
  imports: [NaStepper, NaButton, NaAlert, NaSkeleton],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="2" />
      <h1>Choose your seats</h1>
      <p class="page__sub na-text-muted">Select a seat for each traveller to continue.</p>

      @if (conflictNotice()) {
        <na-alert tone="danger" icon="⚠" title="Those seats were just taken" [dismissible]="true" (dismissed)="conflictNotice.set(false)">
          One or more seats you selected are no longer available, so your previous selection was cleared.
          Please choose again from the available seats below.
        </na-alert>
      }

      @if (droppedNotice()) {
        <na-alert tone="warning" icon="⚠" title="Some seats are no longer available" [dismissible]="true" (dismissed)="droppedNotice.set(false)">
          Seats you had selected earlier are no longer available and were removed from your selection.
        </na-alert>
      }

      @if (expiredNotice()) {
        <na-alert tone="warning" icon="⏱" title="Selection timed out" [dismissible]="true" (dismissed)="expiredNotice.set(false)">
          Your seat selection timed out, so the selected seats were released. Please pick them again.
        </na-alert>
      }

      @if (loadError()) {
        <na-alert tone="danger" icon="⚠" title="We couldn't load the seat map" [retryable]="true" (retry)="load()">
          The seat map is unavailable right now. Your travellers and any current selection are preserved — please try again.
        </na-alert>
      }

      @if (soldOut()) {
        <na-alert tone="warning" icon="⚠" title="No seats left in your cabin">
          Every {{ label(fareCabin) }} seat on this flight is already taken or held. You can go back and
          choose a different flight or fare.
        </na-alert>
      }

      @if (holdExpires()) {
        <p class="hold na-text-small" aria-live="polite">
          Selection reserved for this session: <strong class="na-text-mono">{{ countdown() }}</strong> remaining
        </p>
        @if (secondsLeft() < 120) {
          <na-alert tone="warning" icon="⏱" title="Selection expiring soon">
            Your seat selection will be released in less than two minutes. Seats are only held for real once the booking is confirmed.
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
          @if (loading()) {
            <na-skeleton [rows]="[1, 2, 3]" height="3rem" />
          } @else {
            <header class="map-panel__head">
              <div>
                <h2 class="map-panel__title">{{ flightNumber() }}</h2>
                @if (aircraftModel(); as model) {
                  <p class="na-text-small na-text-muted">Aircraft {{ model }}</p>
                }
              </div>
              <p class="cabin-note na-text-small na-text-muted">
                Your fare includes {{ label(fareCabin) }} seats — seats in other cabins are shown disabled.
              </p>
            </header>

            <ul class="legend" aria-label="Seat map legend">
              <li><i class="sw sw--available" aria-hidden="true"></i>Available</li>
              <li><i class="sw sw--selected" aria-hidden="true"></i>Selected</li>
              <li><i class="sw sw--occupied" aria-hidden="true"></i>Occupied</li>
              <li><i class="sw sw--exit" aria-hidden="true"></i>Exit row · extra legroom</li>
              <li><i class="sw sw--blocked" aria-hidden="true"></i>Other cabin</li>
            </ul>

            <div class="fuselage">
              <div class="fuselage__nose" aria-hidden="true"><span>Front</span></div>

              <div class="seatmap" role="group" aria-label="Aircraft seat map, front to rear">
                <div class="seatmap__row seatmap__row--head" aria-hidden="true">
                  @for (c of columnLetters().left; track c) { <span>{{ c }}</span> }
                  <span></span>
                  @for (c of columnLetters().right; track c) { <span>{{ c }}</span> }
                </div>

                @for (section of sections(); track section.cabin + '-' + section.rowStart) {
                  @if (sections().length > 1) {
                    <div class="seatmap__section" aria-hidden="true">
                      <span class="seatmap__section-name">{{ label(section.cabin) }}</span>
                      <span class="seatmap__section-rows">Rows {{ section.rowStart }}–{{ section.rowEnd }}</span>
                    </div>
                  }

                  @for (row of section.rows; track row.rowNumber) {
                    <div class="seatmap__row" [class.seatmap__row--exit]="row.isExitRow">
                      @if (row.isExitRow) {
                        <span class="seatmap__exit seatmap__exit--left" aria-hidden="true">Exit</span>
                        <span class="seatmap__exit seatmap__exit--right" aria-hidden="true">Exit</span>
                      }
                      @for (seat of row.left; track seat.id) {
                        <button
                          type="button"
                          class="seat seat--{{ stateOf(seat) }}"
                          [disabled]="stateOf(seat) === 'occupied' || stateOf(seat) === 'blocked'"
                          [attr.aria-pressed]="isSelected(seat)"
                          [attr.aria-label]="seatAria(seat)"
                          [title]="seatAria(seat)"
                          (click)="toggleSeat(seat)"
                        >
                          <span class="seat__no">{{ seat.seatNumber }}</span>
                        </button>
                      }
                      <span class="seatmap__aisle" aria-hidden="true">{{ row.rowNumber }}</span>
                      @for (seat of row.right; track seat.id) {
                        <button
                          type="button"
                          class="seat seat--{{ stateOf(seat) }}"
                          [disabled]="stateOf(seat) === 'occupied' || stateOf(seat) === 'blocked'"
                          [attr.aria-pressed]="isSelected(seat)"
                          [attr.aria-label]="seatAria(seat)"
                          [title]="seatAria(seat)"
                          (click)="toggleSeat(seat)"
                        >
                          <span class="seat__no">{{ seat.seatNumber }}</span>
                        </button>
                      }
                    </div>
                  }
                }
              </div>

              <div class="fuselage__tail" aria-hidden="true"><span>Rear</span></div>
            </div>

            <details class="alt">
              <summary>Text seat list (accessible alternative)</summary>
              <ul class="alt__list">
                @for (seat of selectableSeats(); track seat.id) {
                  <li>
                    <button type="button" class="alt__pick" (click)="toggleSeat(seat)">
                      Seat {{ seat.seatNumber }} — {{ label(seat.cabinClass) }}, {{ positionOf(seat) }}{{ seat.isExitRow ? ' · exit row, extra legroom' : '' }}
                    </button>
                  </li>
                }
              </ul>
            </details>
          }
        </section>

        <aside class="na-card side" aria-label="Selection summary">
          <h2>Your selection</h2>
          <ul class="side__list">
            @for (p of passengers(); track $index; let i = $index) {
              <li>
                <span class="side__pax">
                  {{ p.firstName || 'Passenger ' + (i + 1) }}
                  @if (seatFor(i); as seat) {
                    <span class="side__meta na-text-small na-text-muted">
                      {{ label(seat.cabinClass) }} · {{ positionOf(seat) }} seat, row {{ seat.seatRow ?? '—' }}{{ seat.isExitRow ? ' · exit row, extra legroom' : '' }}
                    </span>
                  } @else {
                    <span class="side__meta na-text-small na-text-muted">No seat selected yet</span>
                  }
                </span>
                <strong>{{ seatFor(i)?.seatNumber ?? '—' }}</strong>
              </li>
            }
          </ul>
          <p class="side__note na-text-small">Seat selection is included in your fare — no additional charge applies.</p>
          <p class="side__progress na-text-small" aria-live="polite">{{ selectedCount() }} of {{ passengers().length }} selected</p>
          @if (!canContinue()) { <p class="na-hint">Select a seat for each traveller to continue.</p> }

          @if (totals(); as t) {
            <table class="side__table">
              <tbody>
                <tr><td>Base fare × {{ t.passengerCount }}</td><td>{{ money(t.base) }}</td></tr>
                <tr><td>Taxes × {{ t.passengerCount }}</td><td>{{ money(t.taxes) }}</td></tr>
                <tr><td>Fees × {{ t.passengerCount }}</td><td>{{ money(t.fees) }}</td></tr>
                <tr><td>Seats</td><td>Included</td></tr>
                <tr class="side__total"><td>Total</td><td>{{ money(t.total) }}</td></tr>
              </tbody>
            </table>
          }

          <div class="side__actions">
            <na-button variant="secondary" (clicked)="back()">Back</na-button>
            <na-button variant="cta" [disabled]="!canContinue()" (clicked)="continue()">Continue to extras</na-button>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: `
    :host { --seat-size: 42px; --aisle-w: 34px; }
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); }
    h1 { margin-bottom: var(--na-space-1); }
    .page__sub { margin-bottom: var(--na-space-4); }
    .hold { color: var(--na-ink-700); margin-bottom: var(--na-space-3); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .pax-tabs { display: flex; gap: var(--na-space-2); flex-wrap: wrap; margin-bottom: var(--na-space-5); }
    .pax-tab {
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--na-space-1);
      border: 1px solid var(--na-border-strong); background: var(--na-surface-raised);
      border-radius: var(--na-radius-md); padding: var(--na-space-2) var(--na-space-4); min-height: 44px; min-width: 120px;
      color: var(--na-ink-900);
    }
    .pax-tab--active { border-color: var(--na-blue-600); background: var(--na-blue-100); }
    .pax-tab__name { font-weight: var(--na-font-semibold); font-size: var(--na-text-sm); }
    .pax-tab__seat { font-size: var(--na-text-xs); color: var(--na-ink-500); }

    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--na-space-5); align-items: start; }
    .map-panel { padding: var(--na-space-6); overflow-x: auto; }
    .map-panel__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; margin-bottom: var(--na-space-3); }
    .map-panel__title { font-size: var(--na-text-lg); }
    .cabin-note { max-width: 30ch; }

    .legend { list-style: none; display: flex; gap: var(--na-space-4); flex-wrap: wrap; padding: 0; margin: 0 0 var(--na-space-5); font-size: var(--na-text-xs); color: var(--na-ink-500); }
    .legend li { display: inline-flex; align-items: center; gap: var(--na-space-1); }
    .sw { width: 14px; height: 14px; border-radius: 3px 3px 1px 1px; display: inline-block; border: 1px solid var(--na-border-strong); }
    .sw--available { background: var(--na-surface-raised); }
    .sw--selected { background: var(--na-cta); border-color: var(--na-cta); }
    .sw--occupied { background: var(--na-surface-sunken); }
    .sw--blocked { background: var(--na-surface-sunken); border-style: dashed; opacity: 0.6; }
    .sw--exit { background: var(--na-surface-raised); border-color: var(--na-warning); border-width: 2px; }

    /* Fuselage: rounded nose at the top, tapering tail at the bottom. */
    .fuselage {
      display: inline-block; min-width: 100%; text-align: center;
      border: 2px solid var(--na-border-strong);
      border-radius: 999px 999px var(--na-radius-xl) var(--na-radius-xl) / 180px 180px var(--na-radius-xl) var(--na-radius-xl);
      background: var(--na-surface-sunken);
      padding: var(--na-space-6) var(--na-space-8) var(--na-space-5);
    }
    .fuselage__nose, .fuselage__tail {
      width: 55%; margin: 0 auto; padding: var(--na-space-1) 0 var(--na-space-2);
      font-size: var(--na-text-xs); letter-spacing: 0.18em; text-transform: uppercase; color: var(--na-ink-300);
    }
    .fuselage__nose { border-bottom: 1px solid var(--na-border); margin-bottom: var(--na-space-4); }
    .fuselage__tail { border-top: 1px solid var(--na-border); margin-top: var(--na-space-4); padding-bottom: 0; }

    .seatmap { display: inline-block; }
    .seatmap__row {
      position: relative; display: grid; align-items: center;
      grid-template-columns: repeat(3, var(--seat-size)) var(--aisle-w) repeat(3, var(--seat-size));
      gap: var(--na-space-1); margin-bottom: var(--na-space-1);
    }
    .seatmap__row--head { font-size: var(--na-text-xs); color: var(--na-ink-300); text-align: center; margin-bottom: var(--na-space-2); }
    .seatmap__aisle { text-align: center; font-size: var(--na-text-xs); color: var(--na-ink-300); font-variant-numeric: tabular-nums; }
    .seatmap__row--exit { margin-top: var(--na-space-2); margin-bottom: var(--na-space-2); }
    .seatmap__exit {
      position: absolute; top: 50%; transform: translateY(-50%);
      font-size: 10px; font-weight: var(--na-font-bold); letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--na-warning);
    }
    .seatmap__exit--left { left: calc(-1 * var(--na-space-6)); }
    .seatmap__exit--right { right: calc(-1 * var(--na-space-6)); }

    .seatmap__section {
      display: flex; justify-content: space-between; align-items: baseline; gap: var(--na-space-3);
      border-top: 1px solid var(--na-border); border-bottom: 1px solid var(--na-border);
      margin: var(--na-space-3) 0 var(--na-space-2); padding: var(--na-space-1) var(--na-space-1);
    }
    .seatmap__section-name { font-family: var(--na-font-display); font-size: var(--na-text-sm); font-weight: var(--na-font-semibold); color: var(--na-ink-700); }
    .seatmap__section-rows { font-size: var(--na-text-xs); color: var(--na-ink-300); }

    /* Top-down seat: headrest bar on top, armrest taper at the bottom. */
    .seat {
      width: var(--seat-size); height: var(--seat-size); padding: 0;
      border: 1px solid var(--na-border-strong); border-radius: 7px 7px 3px 3px;
      background: var(--na-surface-raised); color: var(--na-ink-900);
      display: flex; align-items: center; justify-content: center; line-height: 1; position: relative;
      transition: background var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease), color var(--na-motion-fast) var(--na-ease);
    }
    .seat::before {
      content: ''; position: absolute; top: 3px; left: 20%; right: 20%; height: 2px;
      border-radius: 2px; background: currentColor; opacity: 0.35;
    }
    .seat__no { font-size: 10px; font-weight: var(--na-font-semibold); }
    .seat:hover:not(:disabled) { border-color: var(--na-blue-600); }
    .seat--selected { background: var(--na-cta); border-color: var(--na-cta); color: var(--na-cta-contrast); }
    .seat--occupied { background: var(--na-surface-sunken); color: var(--na-ink-300); border-color: var(--na-border); }
    .seat--blocked { opacity: 0.45; background: var(--na-surface-sunken); border-style: dashed; }
    .seat--exit { border: 2px solid var(--na-warning); }
    .seat--held { background: var(--na-warning-bg); border-color: var(--na-warning); }

    .alt { margin-top: var(--na-space-5); text-align: left; }
    .alt summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: var(--na-font-semibold); color: var(--na-blue-600); }
    .alt__list { list-style: none; padding: 0; margin: var(--na-space-2) 0 0; display: grid; gap: var(--na-space-1); max-height: 260px; overflow-y: auto; }
    .alt__pick { width: 100%; text-align: left; background: none; border: 1px solid var(--na-border); border-radius: var(--na-radius-sm); padding: var(--na-space-2) var(--na-space-3); min-height: 40px; color: var(--na-ink-900); }
    .alt__pick:hover { background: var(--na-blue-100); }

    .side { padding: var(--na-space-6); position: sticky; top: var(--na-space-4); }
    .side h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .side__list { list-style: none; padding: 0; margin: 0 0 var(--na-space-3); display: grid; gap: var(--na-space-3); }
    .side__list li { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3); font-size: var(--na-text-sm); }
    .side__list strong { font-size: var(--na-text-base); font-variant-numeric: tabular-nums; }
    .side__pax { display: flex; flex-direction: column; gap: 1px; }
    .side__meta { font-weight: var(--na-font-regular); }
    .side__note { color: var(--na-ink-700); border-top: 1px solid var(--na-border); padding-top: var(--na-space-3); }
    .side__table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); margin-top: var(--na-space-3); border-top: 1px solid var(--na-border); }
    .side__table td { padding: var(--na-space-1) 0; }
    .side__table td:last-child { text-align: right; font-weight: var(--na-font-medium); }
    .side__total td { border-top: 1px solid var(--na-border); padding-top: var(--na-space-2); font-size: var(--na-text-lg); font-weight: var(--na-font-bold); }
    .side__actions { display: grid; gap: var(--na-space-2); margin-top: var(--na-space-4); }

    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; }
    }
    @media (max-width: 639px) {
      :host { --seat-size: 36px; --aisle-w: 28px; }
      .map-panel { padding: var(--na-space-4); }
      .fuselage { padding: var(--na-space-5) var(--na-space-6) var(--na-space-4); }
    }
  `,
})
export class SeatsPage {
  private readonly router = inject(Router);
  private readonly draft = inject(BookingDraftService);
  private readonly seatsApi = inject(SeatService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps = BOOKING_STEPS;
  protected readonly passengers = this.draft.passengers;
  protected readonly activePassenger = signal(0);
  protected readonly selections = signal<SeatSelection[]>([]);
  protected readonly now = signal(Date.now());
  protected readonly catalog = signal<Seat[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly conflictNotice = signal(false);
  protected readonly droppedNotice = signal(false);
  protected readonly expiredNotice = signal(false);
  /** occupiedSeatIds ∪ heldSeatIds from the availability endpoint. */
  protected readonly unavailable = signal<Set<string>>(new Set());

  /** Set from the draft in the constructor; seats outside this cabin are not selectable. */
  protected fareCabin: CabinClass = 'ECONOMY';

  protected readonly rows = computed(() => this.seatsApi.seatMapRows(this.catalog()));

  /** Consecutive same-cabin rows grouped into labelled cabin sections (nose → tail). */
  protected readonly sections = computed<CabinSection[]>(() => {
    const sections: CabinSection[] = [];
    for (const row of this.rows()) {
      const last = sections[sections.length - 1];
      if (last && last.cabin === row.cabin) {
        last.rows.push(row);
        last.rowEnd = row.rowNumber;
      } else {
        sections.push({ cabin: row.cabin, rowStart: row.rowNumber, rowEnd: row.rowNumber, rows: [row] });
      }
    }
    return sections;
  });

  /** Column letters per side, derived from the actual seat data (A–C | D–F). */
  protected readonly columnLetters = computed(() => {
    const left: string[] = [];
    const right: string[] = [];
    for (const row of this.rows()) {
      for (const s of row.left) {
        if (s.seatColumn && !left.includes(s.seatColumn)) left.push(s.seatColumn);
      }
      for (const s of row.right) {
        if (s.seatColumn && !right.includes(s.seatColumn)) right.push(s.seatColumn);
      }
    }
    return { left, right };
  });

  protected readonly selectedIds = computed(() => new Set(this.selections().map((s) => s.seat.id)));

  protected readonly selectedCount = computed(() => this.selections().length);

  protected readonly canContinue = computed(() => {
    const n = this.passengers().length;
    return n > 0 && this.selections().length === n;
  });

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

  /** Text-list alternative: seats in the fare cabin that are still free. */
  protected readonly selectableSeats = computed(() => {
    const taken = this.unavailable();
    return this.catalog().filter((s) => s.cabinClass === this.fareCabin && !taken.has(s.id));
  });

  /** Loaded map with nothing left to pick in the fare cabin. */
  protected readonly soldOut = computed(
    () =>
      !this.loading() &&
      !this.loadError() &&
      this.catalog().length > 0 &&
      this.selectableSeats().length === 0 &&
      !this.canContinue(),
  );

  protected readonly flightNumber = computed(() => this.draft.draft()?.outbound?.flightNumber ?? '');

  protected readonly aircraftModel = computed(() => this.draft.draft()?.outbound?.aircraft?.model ?? null);

  /** Server-consistent figures: fare components × passengers. Seats carry no charge. */
  protected readonly totals = computed(() => {
    const d = this.draft.draft();
    if (!d) return null;
    const { basePrice, taxAmount, feeAmount } = d.fare;
    if (typeof basePrice !== 'number' || typeof taxAmount !== 'number' || typeof feeAmount !== 'number') {
      return null;
    }
    const passengerCount = d.passengers.length;
    const base = basePrice * passengerCount;
    const taxes = taxAmount * passengerCount;
    const fees = feeAmount * passengerCount;
    return { passengerCount, base, taxes, fees, total: base + taxes + fees };
  });

  constructor() {
    const d = this.draft.draft();
    if (!d) {
      this.router.navigateByUrl('/search');
      return;
    }
    this.fareCabin = d.fare.cabinClass;
    this.selections.set(d.seats);

    // The 15-minute timer is a client-side session aid only — the real seat
    // hold starts at POST /bookings. If it already ran out, release locally.
    if (this.draft.isHoldExpired()) {
      this.draft.releaseHold();
      this.selections.set([]);
      this.expiredNotice.set(true);
    }

    // Review bounces back here with navigation state when the server reports
    // a seat conflict (409); the draft's seats were already released there.
    const navState = this.router.getCurrentNavigation()?.extras.state as { seatConflict?: boolean } | undefined;
    if (navState?.seatConflict) this.conflictNotice.set(true);

    this.load();

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

  protected load(): void {
    const d = this.draft.draft();
    if (!d) return;
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      catalog: this.seatsApi.seatCatalog(d.outbound.aircraftId),
      availability: this.seatsApi.seatAvailability(d.outbound.id),
    }).subscribe({
      next: ({ catalog, availability }) => {
        this.catalog.set(catalog);
        const unavailable = new Set([...availability.occupiedSeatIds, ...availability.heldSeatIds]);
        this.unavailable.set(unavailable);
        // A seat selected on a previous visit may since have been booked or
        // held by someone else — drop it and tell the user.
        const kept = this.selections().filter((s) => !unavailable.has(s.seat.id));
        if (kept.length !== this.selections().length) {
          this.selections.set(kept);
          this.droppedNotice.set(true);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected stateOf(seat: Seat): SeatMapState {
    if (seat.cabinClass !== this.fareCabin) return 'blocked';
    return this.seatsApi.stateOf(seat, this.unavailable(), this.selectedIds(), this.holdExpires(), this.now());
  }

  protected isSelected(seat: Seat): boolean {
    return this.selectedIds().has(seat.id);
  }

  protected seatFor(passengerIndex: number): Seat | undefined {
    return this.selections().find((s) => s.passengerIndex === passengerIndex)?.seat;
  }

  /** Window/aisle/middle derived from the seat's column within the real layout. */
  protected positionOf(seat: Seat): SeatPosition | '' {
    const col = seat.seatColumn ?? '';
    const { left, right } = this.columnLetters();
    if (!col || left.length === 0 || right.length === 0) return '';
    if (col === left[0] || col === right[right.length - 1]) return 'window';
    if (col === left[left.length - 1] || col === right[0]) return 'aisle';
    return 'middle';
  }

  protected seatAria(seat: Seat): string {
    const state = this.stateOf(seat);
    const position = this.positionOf(seat);
    const detail = [position ? `${position} seat` : '', seat.isExitRow ? 'exit row, extra legroom' : '']
      .filter(Boolean)
      .join(', ');
    const suffix = detail ? `, ${detail}` : '';
    if (state === 'blocked') {
      return `Seat ${seat.seatNumber}, ${this.label(seat.cabinClass)} cabin, not available with your fare`;
    }
    return `Seat ${seat.seatNumber}${suffix}, ${STATE_LABELS[state]}`;
  }

  protected toggleSeat(seat: Seat): void {
    const state = this.stateOf(seat);
    if (state === 'occupied' || state === 'blocked') return;
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

  protected label(cabin: string): string {
    return cabin
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  protected money(amount: number): string {
    return formatMoney(amount, this.draft.draft()?.fare.currency ?? 'EUR');
  }

  protected continue(): void {
    if (!this.canContinue()) return;
    this.draft.setSeats(this.selections(), []);
    this.router.navigateByUrl('/booking/extras');
  }

  protected back(): void {
    this.router.navigateByUrl('/booking/passengers');
  }
}
