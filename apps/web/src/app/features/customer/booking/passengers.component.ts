import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
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
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="1" />
      <h1>Who is travelling?</h1>
      <p class="na-text-muted">Enter details exactly as they appear on each traveller's travel document.</p>

      <form [formGroup]="form" (ngSubmit)="continue()" novalidate>
        @if (savedError()) {
          <na-alert
            tone="warning"
            icon="⚠"
            title="Saved travellers unavailable"
            retryable
            (retry)="loadSaved()"
            class="saved-alert"
          >
            We could not load your saved travellers. You can try again, or simply enter the details manually below.
          </na-alert>
        }

        <div formArrayName="passengers" class="pax-list">
          @for (group of passengersArray.controls; track $index; let i = $index) {
            <section class="na-card pax" [formGroupName]="i" [attr.aria-labelledby]="'pax-h-' + i">
              <header class="pax__head">
                <h2 [id]="'pax-h-' + i">{{ passengerTitle(i) }}</h2>
                @if (selectionFor(i); as sel) {
                  <span class="pax__source">{{ sel.source === 'profile' ? 'Your profile' : 'Saved traveller' }}</span>
                }
              </header>

              @if (savedLoading()) {
                <div class="pax__loading">
                  <na-skeleton [rows]="[1]" height="4rem" />
                </div>
              } @else if (options().length) {
                <div class="travellers">
                  @if (selectionFor(i); as sel) {
                    @if (!isPickerOpen(i)) {
                      <div class="travellers__summary">
                        <span class="travellers__avatar" aria-hidden="true">{{ initialsOf(sel) }}</span>
                        <span class="travellers__who">
                          <strong>{{ sel.firstName }} {{ sel.lastName }}</strong>
                          <small>
                            {{ sel.source === 'profile' ? 'Filled from your profile' : 'Filled from saved travellers' }}
                            @if (sel.nationality) { · {{ sel.nationality }} }
                          </small>
                        </span>
                        <na-button
                          variant="ghost"
                          size="sm"
                          (clicked)="openPicker(i)"
                          [attr.aria-label]="'Choose another traveller for ' + passengerTitle(i)"
                          >Change traveller</na-button
                        >
                      </div>
                      @if (missingFor(i).length) {
                        <p class="travellers__missing">
                          This profile has no {{ missingFor(i).join(' · ') }} yet — please complete
                          {{ missingFor(i).length === 1 ? 'it' : 'them' }} below.
                        </p>
                      }
                    }
                  }

                  @if (!selectionFor(i) || isPickerOpen(i)) {
                    <p class="travellers__title" [id]="'tw-title-' + i">
                      Autofill from saved travellers <span class="na-hint">(optional)</span>
                    </p>
                    <div class="travellers__grid" role="group" [attr.aria-labelledby]="'tw-title-' + i">
                      @for (t of options(); track t.id) {
                        @let usedBy = usedElsewhere(i, t.id);
                        @let selected = selections()[i] === t.id;
                        <button
                          type="button"
                          class="tcard"
                          [class.tcard--selected]="selected"
                          [attr.aria-pressed]="selected"
                          [disabled]="usedBy !== null"
                          (click)="selectTraveller(i, t)"
                        >
                          <span class="tcard__avatar" aria-hidden="true">{{ initialsOf(t) }}</span>
                          <span class="tcard__body">
                            <span class="tcard__name">{{ t.firstName }} {{ t.lastName }}</span>
                            <span class="tcard__meta">
                              @if (usedBy) {
                                Already selected for {{ usedBy }}
                              } @else if (t.source === 'profile') {
                                Your profile
                              } @else if (t.nationality) {
                                {{ t.nationality }}
                              } @else {
                                Saved traveller
                              }
                            </span>
                          </span>
                          @if (selected) {
                            <span class="tcard__check" aria-hidden="true">✓</span>
                          }
                        </button>
                      }
                    </div>
                    <div class="travellers__foot">
                      <p class="travellers__hint">
                        Fills name, date of birth, nationality and passport / ID for you — document numbers are never
                        shown here. Everything stays editable afterwards.
                      </p>
                      @if (selectionFor(i)) {
                        <na-button variant="ghost" size="sm" (clicked)="closePicker(i)">Keep current selection</na-button>
                      }
                    </div>
                  }
                </div>
              }

              <div class="pax__grid">
                <div class="na-field">
                  <label class="na-label" [attr.for]="'fn-' + i">First name</label>
                  <input class="na-input" [id]="'fn-' + i" type="text" formControlName="firstName" autocomplete="given-name"
                    [attr.aria-invalid]="invalid(i, 'firstName')" [attr.aria-describedby]="invalid(i, 'firstName') ? 'fn-err-' + i : null" />
                  @if (invalid(i, 'firstName')) {
                    <p class="na-error" [id]="'fn-err-' + i">First name is required.</p>
                  }
                </div>
                <div class="na-field">
                  <label class="na-label" [attr.for]="'ln-' + i">Last name</label>
                  <input class="na-input" [id]="'ln-' + i" type="text" formControlName="lastName" autocomplete="family-name"
                    [attr.aria-invalid]="invalid(i, 'lastName')" [attr.aria-describedby]="invalid(i, 'lastName') ? 'ln-err-' + i : null" />
                  @if (invalid(i, 'lastName')) {
                    <p class="na-error" [id]="'ln-err-' + i">Last name is required.</p>
                  }
                </div>
                <div class="na-field">
                  <label class="na-label" [attr.for]="'dob-' + i">Date of birth</label>
                  <input class="na-input" [id]="'dob-' + i" type="date" formControlName="dateOfBirth" max="2099-12-31"
                    [attr.aria-invalid]="invalid(i, 'dateOfBirth')" [attr.aria-describedby]="invalid(i, 'dateOfBirth') ? 'dob-err-' + i : null" />
                  @if (invalid(i, 'dateOfBirth')) {
                    <p class="na-error" [id]="'dob-err-' + i">Date of birth is required.</p>
                  }
                </div>
                <div class="na-field">
                  <label class="na-label" [attr.for]="'nat-' + i">Nationality</label>
                  <input class="na-input" [id]="'nat-' + i" type="text" formControlName="nationality" placeholder="e.g. Germany"
                    [attr.aria-invalid]="invalid(i, 'nationality')" [attr.aria-describedby]="invalid(i, 'nationality') ? 'nat-err-' + i : null" />
                  @if (invalid(i, 'nationality')) {
                    <p class="na-error" [id]="'nat-err-' + i">Nationality is required.</p>
                  }
                </div>
                <div class="na-field">
                  <label class="na-label" [attr.for]="'pp-' + i">
                    Passport / ID number
                    @if (typeOf(i) === 'INFANT') { <span class="na-hint">(optional for infants)</span> }
                  </label>
                  <input class="na-input" [id]="'pp-' + i" type="text" formControlName="passportNumber" autocomplete="off"
                    [attr.aria-invalid]="invalid(i, 'passportNumber')" [attr.aria-describedby]="invalid(i, 'passportNumber') ? 'pp-err-' + i : null" />
                  @if (invalid(i, 'passportNumber')) {
                    <p class="na-error" [id]="'pp-err-' + i">
                      {{ typeOf(i) === 'INFANT' ? 'Use 6–12 letters or digits.' : 'A passport number (6–12 letters or digits) is required.' }}
                    </p>
                  }
                </div>
                <div class="na-field">
                  <label class="na-label" [attr.for]="'sa-' + i">Special assistance <span class="na-hint">(optional)</span></label>
                  <input class="na-input" [id]="'sa-' + i" type="text" formControlName="specialAssistance" placeholder="e.g. Wheelchair, dietary needs" />
                </div>
              </div>
            </section>
          }
        </div>

        <section class="na-card contact" aria-labelledby="contact-h">
          <h2 id="contact-h">Contact details</h2>
          <p class="na-text-muted na-text-small contact__sub">
            The booking confirmation and any flight updates go to this email address.
          </p>
          <div class="pax__grid">
            <div class="na-field">
              <label class="na-label" for="contact-email">Email</label>
              <input class="na-input" id="contact-email" type="email" formControlName="contactEmail" autocomplete="email"
                [attr.aria-invalid]="contactInvalid('contactEmail')" [attr.aria-describedby]="contactInvalid('contactEmail') ? 'contact-email-err' : null" />
              @if (contactInvalid('contactEmail')) {
                <p class="na-error" id="contact-email-err">
                  {{ form.controls.contactEmail.hasError('required') ? 'A contact email is required.' : 'Enter a valid email address.' }}
                </p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="contact-phone">Phone <span class="na-hint">(optional)</span></label>
              <input class="na-input" id="contact-phone" type="tel" formControlName="contactPhone" autocomplete="tel"
                [attr.aria-invalid]="contactInvalid('contactPhone')" [attr.aria-describedby]="contactInvalid('contactPhone') ? 'contact-phone-err' : null" />
              @if (contactInvalid('contactPhone')) {
                <p class="na-error" id="contact-phone-err">Keep the phone number under 50 characters.</p>
              }
            </div>
          </div>
        </section>

        @if (submitted() && form.invalid) {
          <na-alert tone="danger" icon="⚠" title="Some details are missing">
            Please correct the highlighted fields above before continuing.
          </na-alert>
        }

        <div class="actions">
          <na-button variant="secondary" (clicked)="back()">Back</na-button>
          <na-button variant="cta" type="submit">Continue to seat selection</na-button>
        </div>
      </form>
    </div>

    <na-dialog
      [open]="pendingFill() !== null"
      title="Replace traveller details?"
      confirmLabel="Replace details"
      (confirmed)="confirmFill()"
      (cancelled)="pendingFill.set(null)"
    >
      @if (pendingFill(); as p) {
        This replaces the details you already entered for {{ passengerTitle(p.index) }} with the saved information
        for {{ optionName(p.optionId) }}.
      }
    </na-dialog>
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); max-width: 860px; }
    h1 { margin-bottom: var(--na-space-1); }
    .page > p { margin-bottom: var(--na-space-6); }
    .saved-alert { display: block; margin-bottom: var(--na-space-5); }
    .pax-list { display: grid; gap: var(--na-space-5); margin-bottom: var(--na-space-5); }
    .pax { padding: var(--na-space-6); }
    .pax__head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--na-space-4); margin-bottom: var(--na-space-4); flex-wrap: wrap; }
    .pax__head h2 { font-size: var(--na-text-xl); }
    .pax__source {
      color: var(--na-ink-500); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.1em; text-transform: uppercase;
    }
    .pax__loading { margin-bottom: var(--na-space-5); }
    .pax__loading na-skeleton { display: block; margin-bottom: calc(-1 * var(--na-space-3)); }

    /* ---------- Saved traveller selection ---------- */
    .travellers { margin-bottom: var(--na-space-5); padding-bottom: var(--na-space-5); border-bottom: 1px solid var(--na-border); }
    .travellers__title { font-size: var(--na-text-sm); font-weight: var(--na-font-semibold); margin-bottom: var(--na-space-3); }
    .travellers__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: var(--na-space-3); }
    .tcard {
      display: flex; align-items: center; gap: var(--na-space-3);
      min-height: 64px; padding: var(--na-space-3) var(--na-space-4);
      background: var(--na-surface-sunken); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg);
      color: var(--na-ink-900); text-align: left; cursor: pointer;
      transition: border-color var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease), transform var(--na-motion-fast) var(--na-ease);
    }
    .tcard:hover:not(:disabled) { border-color: var(--na-border-strong); transform: translateY(-1px); }
    .tcard:focus-visible { outline: none; border-color: var(--na-blue-600); box-shadow: var(--na-focus-ring); }
    .tcard:disabled { opacity: 0.55; cursor: not-allowed; }
    .tcard--selected, .tcard--selected:hover:not(:disabled) {
      border-color: var(--na-blue-600); background: var(--na-blue-100); transform: none;
    }
    .tcard__avatar {
      display: inline-flex; align-items: center; justify-content: center; flex: none;
      width: 40px; height: 40px; border-radius: var(--na-radius-full);
      background: var(--na-navy-600); color: var(--na-ink-900);
      font-size: var(--na-text-sm); font-weight: var(--na-font-semibold);
    }
    .tcard--selected .tcard__avatar { background: var(--na-cta); color: var(--na-cta-contrast); }
    .tcard__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .tcard__name { font-size: var(--na-text-sm); font-weight: var(--na-font-semibold); }
    .tcard__meta { color: var(--na-ink-500); font-size: var(--na-text-xs); }
    .tcard__check {
      display: inline-flex; align-items: center; justify-content: center; flex: none;
      width: 22px; height: 22px; margin-left: auto; border-radius: var(--na-radius-full);
      background: var(--na-cta); color: var(--na-cta-contrast);
      font-size: var(--na-text-xs); font-weight: var(--na-font-bold);
    }
    .travellers__summary {
      display: flex; align-items: center; gap: var(--na-space-3); flex-wrap: wrap;
      padding: var(--na-space-3) var(--na-space-4);
      background: var(--na-info-bg); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg);
    }
    .travellers__avatar {
      display: inline-flex; align-items: center; justify-content: center; flex: none;
      width: 40px; height: 40px; border-radius: var(--na-radius-full);
      background: var(--na-cta); color: var(--na-cta-contrast);
      font-size: var(--na-text-sm); font-weight: var(--na-font-semibold);
    }
    .travellers__who { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 12rem; }
    .travellers__who small { color: var(--na-ink-500); }
    .travellers__missing {
      margin: var(--na-space-3) 0 0; padding: var(--na-space-2) var(--na-space-3);
      background: var(--na-warning-bg); color: var(--na-warning);
      border-radius: var(--na-radius-md); font-size: var(--na-text-xs); font-weight: var(--na-font-medium);
    }
    .travellers__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-3); margin-top: var(--na-space-3); flex-wrap: wrap; }
    .travellers__hint { color: var(--na-ink-500); font-size: var(--na-text-xs); margin: 0; flex: 1 1 26ch; }

    .pax__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--na-space-4); }
    .contact { padding: var(--na-space-6); margin-bottom: var(--na-space-5); }
    .contact h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-1); }
    .contact__sub { margin-bottom: var(--na-space-4); }
    .actions { display: flex; justify-content: space-between; gap: var(--na-space-3); margin-top: var(--na-space-6); }
    na-alert { display: block; }
    @media (max-width: 639px) {
      .pax { padding: var(--na-space-4); }
      .pax__grid { grid-template-columns: 1fr; }
      .travellers__summary na-button { width: 100%; }
      .actions { flex-direction: column-reverse; }
      .actions na-button { width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .tcard { transition: none; }
      .tcard:hover:not(:disabled) { transform: none; }
    }
  `,
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
        { id: PROFILE_OPTION_ID, source: 'profile', firstName: user.firstName, lastName: user.lastName },
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
