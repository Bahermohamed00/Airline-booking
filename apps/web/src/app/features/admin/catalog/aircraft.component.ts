import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AIRCRAFT } from '../../../core/mock/mock-data';
import type { Aircraft, AircraftStatus, CabinClass, Seat } from '../../../core/models/domain.model';
import type { StatusTone } from '../../../core/status-maps';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

const STATUS_PRESENTATION: Record<AircraftStatus, { label: string; tone: StatusTone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
  RETIRED: { label: 'Retired', tone: 'neutral' },
};

const SEAT_PREVIEW_ROWS = 15;

function buildSeats(aircraftId: string, capacity: number): Seat[] {
  const seats: Seat[] = [];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  let count = 0;
  for (let row = 1; count < capacity; row++) {
    for (const col of cols) {
      if (count >= capacity) break;
      const cabin: CabinClass =
        row <= 2 && capacity >= 300 ? 'FIRST' : row <= 6 && capacity >= 220 ? 'BUSINESS' : 'ECONOMY';
      seats.push({
        id: `${aircraftId.slice(0, 8)}-s${row}${col}`,
        aircraftId,
        seatNumber: `${row}${col}`,
        cabinClass: cabin,
        seatRow: row,
        seatColumn: col,
        isExitRow: row === 12 || row === 25,
        features: {},
      });
      count++;
    }
  }
  return seats;
}

@Component({
  selector: 'na-admin-aircraft',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <na-breadcrumbs [items]="[{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Aircraft' }]" />
      <header class="page__head">
        <div>
          <h1>Aircraft fleet</h1>
          <p class="subtitle">Fleet inventory, seat configuration and availability status.</p>
        </div>
        <na-button variant="cta" (clicked)="openCreate()">Add aircraft</na-button>
      </header>

      @if (loading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="na-card card"><na-skeleton [rows]="[1, 2, 3]" height="1.2rem" /></div>
          }
        </div>
      } @else {
        <div class="grid">
          @for (a of fleet(); track a.id) {
            <button type="button" class="na-card card" (click)="openDetail(a.id)">
              <div class="card__top">
                <span class="card__reg na-text-mono">{{ a.registration }}</span>
                <na-badge [tone]="statusOf(a).tone">{{ statusOf(a).label }}</na-badge>
              </div>
              <p class="card__model">{{ a.model }}</p>
              <p class="card__cap">{{ a.capacity }} seats · {{ a.seats.length }} configured</p>
            </button>
          }
        </div>
      }

      <!-- Detail drawer -->
      @if (selected(); as a) {
        <div class="backdrop" (click)="closeDetail()" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="a.registration + ' details'">
          <header class="drawer__head">
            <div>
              <h2>{{ a.registration }}</h2>
              <p class="subtitle">{{ a.model }} · {{ a.capacity }} seats</p>
            </div>
            <button type="button" class="drawer__close" aria-label="Close details" (click)="closeDetail()">×</button>
          </header>
          <div class="drawer__body">
            <dl class="facts">
              <div><dt>Status</dt><dd><na-badge [tone]="statusOf(a).tone">{{ statusOf(a).label }}</na-badge></dd></div>
              <div><dt>Capacity</dt><dd>{{ a.capacity }}</dd></div>
            </dl>

            <h3>Seat configuration</h3>
            <ul class="cabins">
              @for (c of cabinSummary(a); track c.cabin) {
                <li>
                  <span class="dot dot--{{ c.cabin.toLowerCase() }}" aria-hidden="true"></span>
                  <span>{{ c.label }}</span>
                  <span class="cabins__count">{{ c.count }} seats</span>
                </li>
              }
            </ul>

            <h3>Seat map preview <span class="na-text-muted na-text-small">(first {{ previewRows }} rows)</span></h3>
            <div class="seatmap" role="img" [attr.aria-label]="'Seat map preview for ' + a.registration">
              @for (seat of previewSeats(a); track seat.id) {
                <span
                  class="seat seat--{{ seat.cabinClass.toLowerCase() }}"
                  [class.seat--exit]="seat.isExitRow"
                  [title]="seat.seatNumber + ' · ' + seat.cabinClass.replace('_', ' ')"
                ></span>
              }
            </div>
            <div class="legend">
              <span><span class="dot dot--first" aria-hidden="true"></span> First</span>
              <span><span class="dot dot--business" aria-hidden="true"></span> Business</span>
              <span><span class="dot dot--economy" aria-hidden="true"></span> Economy</span>
            </div>

            <div class="actions">
              <na-button
                [variant]="a.status === 'ACTIVE' ? 'danger' : 'primary'"
                size="sm"
                [disabled]="a.status === 'RETIRED'"
                (clicked)="toggleDialogOpen.set(true)"
              >
                {{ a.status === 'ACTIVE' ? 'Send to maintenance' : 'Return to service' }}
              </na-button>
            </div>
          </div>
        </aside>
      }

      <!-- Add aircraft drawer -->
      @if (createOpen()) {
        <div class="backdrop" (click)="createOpen.set(false)" role="presentation"></div>
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Add aircraft">
          <header class="drawer__head">
            <h2>Add aircraft</h2>
            <button type="button" class="drawer__close" aria-label="Close form" (click)="createOpen.set(false)">×</button>
          </header>
          <form class="drawer__body" (submit)="submitCreate($event)">
            <div class="na-field">
              <label class="na-label" for="ac-reg">Registration</label>
              <input
                id="ac-reg" class="na-input" name="acReg" [(ngModel)]="formRegistration"
                placeholder="NV-738Z" required
                [attr.aria-invalid]="createError() ? 'true' : null"
              />
              <p class="na-hint">Unique tail number, e.g. NV-738Z.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="ac-model">Model</label>
              <input id="ac-model" class="na-input" name="acModel" [(ngModel)]="formModel" placeholder="Boeing 737-800" required />
            </div>
            <div class="na-field">
              <label class="na-label" for="ac-cap">Seat capacity</label>
              <input id="ac-cap" class="na-input" type="number" name="acCap" [(ngModel)]="formCapacity" min="6" max="600" required />
              @if (createError()) { <p class="na-error" role="alert">{{ createError() }}</p> }
            </div>
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="createOpen.set(false)">Cancel</na-button>
              <na-button variant="cta" type="submit">Add aircraft</na-button>
            </div>
          </form>
        </aside>
      }

      <na-dialog
        [open]="toggleDialogOpen()"
        [title]="selected()?.status === 'ACTIVE' ? 'Send aircraft to maintenance?' : 'Return aircraft to service?'"
        [confirmLabel]="selected()?.status === 'ACTIVE' ? 'Send to maintenance' : 'Return to service'"
        [confirmDanger]="selected()?.status === 'ACTIVE'"
        (confirmed)="confirmToggle()"
        (cancelled)="toggleDialogOpen.set(false)"
      >
        {{ selected()?.registration }} ({{ selected()?.model }}) will
        {{ selected()?.status === 'ACTIVE' ? 'be marked as under maintenance and unavailable for scheduling' : 'become available for flight scheduling again' }}.
      </na-dialog>
    </div>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: var(--na-space-5); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .subtitle { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--na-space-4); }
    .card { padding: var(--na-space-5); text-align: left; cursor: pointer; transition: box-shadow var(--na-motion-fast), border-color var(--na-motion-fast); }
    .card:hover { box-shadow: var(--na-shadow-md); border-color: var(--na-navy-300); }
    .card__top { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-2); }
    .card__reg { font-weight: var(--na-font-bold); color: var(--na-ink-900); }
    .card__model { margin-top: var(--na-space-2); font-weight: var(--na-font-medium); }
    .card__cap { color: var(--na-ink-500); font-size: var(--na-text-sm); margin-top: var(--na-space-1); }
    .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 99; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 100;
      width: min(480px, 100vw); background: var(--na-surface-raised);
      border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg); display: flex; flex-direction: column;
    }
    .drawer__head {
      display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3);
      padding: var(--na-space-5); border-bottom: 1px solid var(--na-border);
    }
    .drawer__close { background: none; border: none; font-size: 1.6rem; line-height: 1; color: var(--na-ink-500); min-width: 44px; min-height: 44px; }
    .drawer__body { padding: var(--na-space-5); overflow-y: auto; }
    .drawer__body h3 { margin: var(--na-space-5) 0 var(--na-space-2); font-size: var(--na-text-base); }
    .drawer__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); margin-top: var(--na-space-4); }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-3); margin: 0; }
    .facts dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); }
    .facts dd { margin: var(--na-space-1) 0 0; font-weight: var(--na-font-medium); font-size: var(--na-text-sm); }
    .cabins { list-style: none; margin: 0; padding: 0; }
    .cabins li { display: flex; align-items: center; gap: var(--na-space-2); padding: var(--na-space-2) 0; border-bottom: 1px solid var(--na-border); font-size: var(--na-text-sm); }
    .cabins__count { margin-left: auto; font-weight: var(--na-font-semibold); }
    .seatmap { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; max-width: 220px; padding: var(--na-space-3); background: var(--na-surface-sunken); border-radius: var(--na-radius-md); }
    .seat { aspect-ratio: 1; border-radius: 3px; }
    .seat--economy { background: var(--na-blue-500); }
    .seat--business { background: var(--na-cta); }
    .seat--first { background: var(--na-navy-700); }
    .seat--exit { outline: 2px solid var(--na-warning); outline-offset: 1px; }
    .legend { display: flex; gap: var(--na-space-4); margin-top: var(--na-space-3); font-size: var(--na-text-xs); color: var(--na-ink-500); }
    .legend span { display: inline-flex; align-items: center; gap: var(--na-space-1); }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
    .dot--economy { background: var(--na-blue-500); }
    .dot--business { background: var(--na-cta); }
    .dot--first { background: var(--na-navy-700); }
    .actions { margin-top: var(--na-space-6); }
  `,
})
export class AircraftPage {
  private readonly toast = inject(ToastService);

  readonly previewRows = SEAT_PREVIEW_ROWS;
  readonly loading = signal(true);
  readonly fleet = signal<Aircraft[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.fleet().find((a) => a.id === this.selectedId()) ?? null);

  readonly createOpen = signal(false);
  readonly toggleDialogOpen = signal(false);
  readonly createError = signal<string | null>(null);

  formRegistration = '';
  formModel = '';
  formCapacity: number | null = null;

  constructor() {
    setTimeout(() => {
      this.fleet.set(AIRCRAFT.map((a) => ({ ...a })));
      this.loading.set(false);
    }, 300);
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  statusOf(a: Aircraft): { label: string; tone: StatusTone } {
    return STATUS_PRESENTATION[a.status];
  }

  cabinSummary(a: Aircraft): { cabin: CabinClass; label: string; count: number }[] {
    const labels: Record<CabinClass, string> = {
      FIRST: 'First',
      BUSINESS: 'Business',
      PREMIUM_ECONOMY: 'Premium economy',
      ECONOMY: 'Economy',
    };
    const order: CabinClass[] = ['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'ECONOMY'];
    return order
      .map((cabin) => ({ cabin, label: labels[cabin], count: a.seats.filter((s) => s.cabinClass === cabin).length }))
      .filter((c) => c.count > 0);
  }

  previewSeats(a: Aircraft): Seat[] {
    return a.seats.filter((s) => (s.seatRow ?? 0) <= SEAT_PREVIEW_ROWS);
  }

  openCreate(): void {
    this.formRegistration = '';
    this.formModel = '';
    this.formCapacity = null;
    this.createError.set(null);
    this.createOpen.set(true);
  }

  submitCreate(event: Event): void {
    event.preventDefault();
    const reg = this.formRegistration.trim().toUpperCase();
    const model = this.formModel.trim();
    const capacity = Number(this.formCapacity);
    if (!reg || !model || !Number.isFinite(capacity)) {
      this.createError.set('All fields are required.');
      return;
    }
    if (this.fleet().some((a) => a.registration.toUpperCase() === reg)) {
      this.createError.set('An aircraft with this registration already exists.');
      return;
    }
    if (capacity < 6 || capacity > 600) {
      this.createError.set('Capacity must be between 6 and 600 seats.');
      return;
    }
    const id = crypto.randomUUID();
    this.fleet.update((list) => [
      ...list,
      { id, registration: reg, model, capacity, status: 'ACTIVE', seats: buildSeats(id, capacity) },
    ]);
    this.createOpen.set(false);
    this.toast.success(`Aircraft ${reg} added to the fleet.`);
  }

  confirmToggle(): void {
    this.toggleDialogOpen.set(false);
    const a = this.selected();
    if (!a || a.status === 'RETIRED') return;
    const next: AircraftStatus = a.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
    this.fleet.update((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    this.toast.success(
      next === 'MAINTENANCE'
        ? `${a.registration} sent to maintenance.`
        : `${a.registration} returned to service.`,
    );
  }
}
