import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Aircraft, AircraftStatus, CabinClass, Seat } from '../../../core/models/domain.model';
import type { AircraftPayload } from './catalog-api.model';
import { CatalogService } from './catalog.service';
import { AIRCRAFT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const SEAT_PREVIEW_ROWS = 15;
const REGISTRATION_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
const DUPLICATE_REGISTRATION_MESSAGE = 'An aircraft with this registration already exists.';

@Component({
  selector: 'na-admin-aircraft',
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaSkeleton, NaEmptyState],
  templateUrl: './aircraft.component.html',
  styleUrl: './aircraft.component.css',
})
export class AircraftPage {
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  readonly AIRCRAFT_STATUS_MAP = AIRCRAFT_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly previewRows = SEAT_PREVIEW_ROWS;
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly fleet = signal<Aircraft[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.fleet().find((a) => a.id === this.selectedId()) ?? null);

  /** Seats load lazily when the detail drawer opens — never fabricated client-side. */
  readonly seats = signal<Seat[]>([]);
  readonly seatsLoading = signal(false);
  readonly seatsError = signal<string | null>(null);

  readonly createOpen = signal(false);
  readonly toggleDialogOpen = signal(false);
  readonly submitting = signal(false);
  readonly createError = signal<string | null>(null);

  formRegistration = '';
  formModel = '';
  formCapacity: number | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.catalog.listAircraft().subscribe({
      next: (fleet) => {
        this.fleet.set(fleet);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load the aircraft fleet.'));
        this.loading.set(false);
      },
    });
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
    this.loadSeats(id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
    this.seats.set([]);
    this.seatsLoading.set(false);
    this.seatsError.set(null);
  }

  retrySeats(): void {
    const id = this.selectedId();
    if (id) this.loadSeats(id);
  }

  cabinSummary(): { cabin: CabinClass; label: string; count: number }[] {
    const labels: Record<CabinClass, string> = {
      FIRST: 'First',
      BUSINESS: 'Business',
      PREMIUM_ECONOMY: 'Premium economy',
      ECONOMY: 'Economy',
    };
    const order: CabinClass[] = ['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'ECONOMY'];
    return order
      .map((cabin) => ({
        cabin,
        label: labels[cabin],
        count: this.seats().filter((s) => s.cabinClass === cabin).length,
      }))
      .filter((c) => c.count > 0);
  }

  previewSeats(): Seat[] {
    return this.seats().filter((s) => (s.seatRow ?? 0) <= SEAT_PREVIEW_ROWS);
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
    if (!REGISTRATION_PATTERN.test(reg)) {
      this.createError.set(
        'Registration must be 3–20 characters: letters, digits and dashes, starting with a letter or digit.',
      );
      return;
    }
    if (model.length < 2 || model.length > 100) {
      this.createError.set('Model must be between 2 and 100 characters.');
      return;
    }
    if (this.fleet().some((a) => a.registration.toUpperCase() === reg)) {
      this.createError.set(DUPLICATE_REGISTRATION_MESSAGE);
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 6 || capacity > 600) {
      this.createError.set('Capacity must be between 6 and 600 seats.');
      return;
    }

    // DTO fields only — the server assigns the id and generates the seat map.
    const payload: AircraftPayload = { registration: reg, model, capacity };
    this.submitting.set(true);
    this.catalog.createAircraft(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.fleet.update((list) => [...list, created]);
        this.createOpen.set(false);
        this.toast.success(`Aircraft ${created.registration} added to the fleet.`);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.createError.set(
          toErrorMessage(
            err,
            'Could not add the aircraft. Please try again.',
            DUPLICATE_REGISTRATION_MESSAGE,
          ),
        );
      },
    });
  }

  confirmToggle(): void {
    this.toggleDialogOpen.set(false);
    const a = this.selected();
    if (!a || a.status === 'RETIRED') return;
    const next: AircraftStatus = a.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
    this.catalog.updateAircraft(a.id, { status: next }).subscribe({
      next: (updated) => {
        this.fleet.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.toast.success(
          next === 'MAINTENANCE'
            ? `${a.registration} sent to maintenance.`
            : `${a.registration} returned to service.`,
        );
      },
      error: (err: unknown) =>
        this.toast.error(toErrorMessage(err, 'Could not update the aircraft status.')),
    });
  }

  private loadSeats(id: string): void {
    this.seats.set([]);
    this.seatsLoading.set(true);
    this.seatsError.set(null);
    this.catalog.getAircraftSeats(id).subscribe({
      next: (seats) => {
        if (this.selectedId() !== id) return;
        this.seats.set(seats);
        this.seatsLoading.set(false);
      },
      error: (err: unknown) => {
        if (this.selectedId() !== id) return;
        this.seatsError.set(toErrorMessage(err, 'Could not load the seat map.'));
        this.seatsLoading.set(false);
      },
    });
  }
}
