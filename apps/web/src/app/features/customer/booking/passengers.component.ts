import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingDraftService } from './booking-draft.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Passenger } from '../../../core/models/domain.model';
import type { PassengerForm } from '../../../core/models/booking-flow.model';
import { NaStepper, StepItem } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaDialog } from '../../../shared/ui/dialog.component';

const PASSPORT_PATTERN = /^[A-Za-z0-9]{6,12}$/;
const PROFILE_OPTION_ID = '__profile__';

export const BOOKING_STEPS: StepItem[] = [
  { id: 'search', label: 'Search' },
  { id: 'passengers', label: 'Passengers' },
  { id: 'seats', label: 'Seats' },
  { id: 'extras', label: 'Extras' },
  { id: 'review', label: 'Review' },
];

interface TravellerOption {
  id: string;
  source: 'profile' | 'saved';
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  passportNumber?: string | null;
}

@Component({
  selector: 'na-passengers-page',
  imports: [ReactiveFormsModule, NaStepper, NaButton, NaAlert, NaSkeleton, NaDialog],
  templateUrl: './passengers.component.html',
  styleUrl: './passengers.component.css',
})
export class PassengersPage {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly draft = inject(BookingDraftService);
  private readonly auth = inject(AuthService);

  protected readonly steps = BOOKING_STEPS;
  protected readonly saved = signal<Passenger[]>([]);
  protected readonly savedLoading = signal(true);
  protected readonly savedError = signal(false);
  protected readonly submitted = signal(false);
  /** Passenger index -> selected traveller option id. */
  protected readonly selections = signal<Record<number, string>>({});
  /** Passenger index -> whether the traveller picker is expanded (default: open). */
  protected readonly pickerOpen = signal<Record<number, boolean>>({});
  protected readonly pendingFill = signal<{ index: number; optionId: string } | null>(null);

  /** Selectable travellers: saved travellers plus the signed-in user's own profile (deduplicated by name). */
  protected readonly options = computed<TravellerOption[]>(() => {
    const user = this.auth.user();
    const isSelf = (first: string, last: string) =>
      !!user &&
      first.trim().toLowerCase() === user.firstName.trim().toLowerCase() &&
      last.trim().toLowerCase() === user.lastName.trim().toLowerCase();

    const savedOptions: TravellerOption[] = this.saved().map((p) => ({
      id: p.id,
      source: isSelf(p.firstName, p.lastName) ? 'profile' : 'saved',
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      nationality: p.nationality,
      passportNumber: p.passportNumber,
    }));

    if (user && !savedOptions.some((o) => o.source === 'profile')) {
      return [
        {
          id: PROFILE_OPTION_ID,
          source: 'profile',
          firstName: user.firstName,
          lastName: user.lastName,
        },
        ...savedOptions,
      ];
    }
    return savedOptions;
  });

  protected readonly form = this.fb.group({
    passengers: this.fb.array<FormGroup>([]),
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.maxLength(50)]],
  });

  constructor() {
    const d = this.draft.draft();
    if (!d) {
      this.router.navigateByUrl('/search');
      return;
    }
    for (const p of d.passengers) {
      this.passengersArray.push(this.buildGroup(p));
    }
    // Prefill from the draft on re-entry, otherwise from the signed-in
    // account. setValue keeps the control pristine/untouched.
    this.form.controls.contactEmail.setValue(d.contactEmail || this.auth.user()?.email || '');
    this.form.controls.contactPhone.setValue(d.contactPhone);
    // Saved-traveller autofill is an account feature; guests enter details manually.
    if (this.auth.isLoggedIn()) {
      this.loadSaved();
    } else {
      this.savedLoading.set(false);
    }
  }

  get passengersArray(): FormArray<FormGroup> {
    return this.form.get('passengers') as FormArray<FormGroup>;
  }

  protected loadSaved(): void {
    this.savedLoading.set(true);
    this.savedError.set(false);
    this.auth.savedPassengers().subscribe({
      next: (list) => {
        this.saved.set(list);
        this.savedLoading.set(false);
      },
      error: () => {
        this.savedLoading.set(false);
        this.savedError.set(true);
      },
    });
  }

  protected typeOf(index: number): PassengerForm['passengerType'] {
    return this.passengersArray.at(index).get('passengerType')?.value ?? 'ADULT';
  }

  protected passengerTitle(index: number): string {
    const type = this.typeOf(index);
    const sameTypeBefore = this.passengersArray.controls
      .slice(0, index + 1)
      .filter((c) => c.get('passengerType')?.value === type).length;
    const label = type === 'ADULT' ? 'Adult' : type === 'CHILD' ? 'Child' : 'Infant';
    return `${label} ${sameTypeBefore}`;
  }

  protected invalid(index: number, control: string): boolean {
    const c = this.passengersArray.at(index).get(control);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  protected contactInvalid(control: 'contactEmail' | 'contactPhone'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || this.submitted());
  }

  protected selectionFor(index: number): TravellerOption | null {
    const id = this.selections()[index];
    return id ? (this.options().find((o) => o.id === id) ?? null) : null;
  }

  protected isPickerOpen(index: number): boolean {
    return this.pickerOpen()[index] ?? true;
  }

  protected openPicker(index: number): void {
    this.pickerOpen.update((state) => ({ ...state, [index]: true }));
  }

  protected closePicker(index: number): void {
    this.pickerOpen.update((state) => ({ ...state, [index]: false }));
  }

  /** Title of the other passenger already using this option, or null when it is free. */
  protected usedElsewhere(index: number, optionId: string): string | null {
    for (const [key, value] of Object.entries(this.selections())) {
      const other = Number(key);
      if (other !== index && value === optionId) {
        return this.passengerTitle(other);
      }
    }
    return null;
  }

  protected selectTraveller(index: number, option: TravellerOption): void {
    // Never silently discard details the user typed by hand.
    if (this.passengersArray.at(index).dirty) {
      this.pendingFill.set({ index, optionId: option.id });
      return;
    }
    this.applyTraveller(index, option.id);
  }

  protected confirmFill(): void {
    const pending = this.pendingFill();
    if (!pending) return;
    this.applyTraveller(pending.index, pending.optionId);
    this.pendingFill.set(null);
  }

  protected optionName(optionId: string): string {
    const option = this.options().find((o) => o.id === optionId);
    return option ? `${option.firstName} ${option.lastName}` : '';
  }

  protected initialsOf(option: TravellerOption): string {
    return `${option.firstName.charAt(0)}${option.lastName.charAt(0)}`.toUpperCase();
  }

  /** Required fields the selected option cannot fill, surfaced so gaps are no surprise. */
  protected missingFor(index: number): string[] {
    const sel = this.selectionFor(index);
    if (!sel) return [];
    const missing: string[] = [];
    if (!sel.dateOfBirth) missing.push('date of birth');
    if (!sel.nationality) missing.push('nationality');
    if (!sel.passportNumber) missing.push('passport / ID');
    return missing;
  }

  protected continue(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.passengersArray.controls.forEach((c) => c.markAllAsTouched());
      this.form.controls.contactEmail.markAsTouched();
      this.form.controls.contactPhone.markAsTouched();
      return;
    }
    this.draft.setPassengers(this.passengersArray.getRawValue() as PassengerForm[]);
    this.draft.setContact(
      (this.form.controls.contactEmail.value ?? '').trim(),
      (this.form.controls.contactPhone.value ?? '').trim(),
    );
    this.router.navigateByUrl('/booking/seats');
  }

  protected back(): void {
    const id = this.draft.outbound()?.id;
    this.router.navigate(id ? ['/flights', id] : ['/search']);
  }

  private applyTraveller(index: number, optionId: string): void {
    const option = this.options().find((o) => o.id === optionId);
    if (!option) return;
    const group = this.passengersArray.at(index);
    group.patchValue({
      firstName: option.firstName,
      lastName: option.lastName,
      dateOfBirth: option.dateOfBirth ?? '',
      nationality: option.nationality ?? '',
      passportNumber: option.passportNumber ?? '',
    });
    // The fill itself is not a manual edit: no premature errors, and a later
    // hand edit is what arms the overwrite confirmation.
    group.markAsPristine();
    group.markAsUntouched();
    this.selections.update((state) => ({ ...state, [index]: optionId }));
    this.pickerOpen.update((state) => ({ ...state, [index]: false }));
  }

  private buildGroup(p: PassengerForm): FormGroup {
    const isInfant = p.passengerType === 'INFANT';
    return this.fb.group({
      passengerType: [p.passengerType],
      firstName: [p.firstName, Validators.required],
      lastName: [p.lastName, Validators.required],
      dateOfBirth: [p.dateOfBirth, Validators.required],
      nationality: [p.nationality, Validators.required],
      passportNumber: [
        p.passportNumber,
        isInfant
          ? [Validators.pattern(PASSPORT_PATTERN)]
          : [Validators.required, Validators.pattern(PASSPORT_PATTERN)],
      ],
      specialAssistance: [p.specialAssistance ?? ''],
    });
  }
}
