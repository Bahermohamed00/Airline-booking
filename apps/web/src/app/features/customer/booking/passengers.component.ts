import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Passenger } from '../../../core/models/domain.model';
import type { PassengerForm } from '../../../core/models/booking-flow.model';
import { NaStepper, StepItem } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';

const PASSPORT_PATTERN = /^[A-Za-z0-9]{6,12}$/;

export const BOOKING_STEPS: StepItem[] = [
  { id: 'search', label: 'Search' },
  { id: 'passengers', label: 'Passengers' },
  { id: 'seats', label: 'Seats' },
  { id: 'extras', label: 'Extras' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
];

@Component({
  selector: 'na-passengers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NaStepper, NaButton, NaAlert],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="1" />
      <h1>Who is travelling?</h1>
      <p class="na-text-muted">Enter details exactly as they appear on each traveller's travel document.</p>

      <form [formGroup]="form" (ngSubmit)="continue()" novalidate>
        <div formArrayName="passengers" class="pax-list">
          @for (group of passengersArray.controls; track $index; let i = $index) {
            <section class="na-card pax" [formGroupName]="i" [attr.aria-labelledby]="'pax-h-' + i">
              <header class="pax__head">
                <h2 [id]="'pax-h-' + i">{{ passengerTitle(i) }}</h2>
                @if (saved().length) {
                  <div class="pax__fill">
                    <label class="na-label" [attr.for]="'fill-' + i">Autofill from saved travellers</label>
                    <select class="na-select" [id]="'fill-' + i" (change)="fillFromSaved(i, $any($event.target).value); $any($event.target).value = ''">
                      <option value="">Choose…</option>
                      @for (s of saved(); track s.id) {
                        <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
                      }
                    </select>
                  </div>
                }
              </header>

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
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); max-width: 860px; }
    h1 { margin-bottom: var(--na-space-1); }
    .page > p { margin-bottom: var(--na-space-6); }
    .pax-list { display: grid; gap: var(--na-space-5); margin-bottom: var(--na-space-5); }
    .pax { padding: var(--na-space-6); }
    .pax__head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--na-space-4); margin-bottom: var(--na-space-4); flex-wrap: wrap; }
    .pax__head h2 { font-size: var(--na-text-xl); }
    .pax__fill { min-width: 220px; }
    .pax__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--na-space-4); }
    .actions { display: flex; justify-content: space-between; gap: var(--na-space-3); margin-top: var(--na-space-6); }
    na-alert { display: block; }
    @media (max-width: 639px) {
      .pax__grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column-reverse; }
      .actions na-button { width: 100%; }
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
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    passengers: this.fb.array<FormGroup>([]),
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
    this.auth.savedPassengers().subscribe((list) => this.saved.set(list));
  }

  get passengersArray(): FormArray<FormGroup> {
    return this.form.get('passengers') as FormArray<FormGroup>;
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

  protected fillFromSaved(index: number, passengerId: string): void {
    const p = this.saved().find((x) => x.id === passengerId);
    if (!p) return;
    this.passengersArray.at(index).patchValue({
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth ?? '',
      nationality: p.nationality ?? '',
      passportNumber: p.passportNumber ?? '',
    });
  }

  protected continue(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.passengersArray.controls.forEach((c) => c.markAllAsTouched());
      return;
    }
    this.draft.setPassengers(this.passengersArray.getRawValue() as PassengerForm[]);
    this.router.navigateByUrl('/booking/seats');
  }

  protected back(): void {
    const id = this.draft.outbound()?.id;
    this.router.navigate(id ? ['/flights', id] : ['/search']);
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
