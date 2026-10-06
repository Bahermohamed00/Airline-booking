import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PassengersPage } from './passengers.component';
import { AuthService } from '../../../core/services/auth.service';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import type { BookingDraft, PassengerForm } from '../../../core/models/booking-flow.model';
import type { Passenger, User } from '../../../core/models/domain.model';

const LENA: Passenger = {
  id: 'p1',
  firstName: 'Lena',
  lastName: 'Hoffmann',
  dateOfBirth: '1992-04-18',
  nationality: 'Germany',
  passportNumber: 'C01X00T47',
};
const JONAS: Passenger = {
  id: 'p2',
  firstName: 'Jonas',
  lastName: 'Hoffmann',
  dateOfBirth: '2016-09-02',
  nationality: 'Germany',
  passportNumber: 'C01X00T48',
};
const USER: User = {
  id: 'u1',
  email: 'aya@example.com',
  firstName: 'Aya',
  lastName: 'Mansour',
  emailVerified: true,
  mfaEnabled: false,
  status: 'ACTIVE',
  roles: ['Customer'],
  permissions: [],
};

function blankAdult(): PassengerForm {
  return {
    passengerType: 'ADULT',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    passportNumber: '',
    specialAssistance: '',
  };
}

interface SetupOptions {
  /** Undefined = signed in as USER; null = guest. */
  user?: User | null;
  saved?: Passenger[];
  savedError?: boolean;
  passengers?: PassengerForm[];
  contactEmail?: string;
  contactPhone?: string;
}

async function setup(opts: SetupOptions = {}) {
  const draftStub = {
    passengers: opts.passengers ?? [blankAdult()],
    contactEmail: opts.contactEmail ?? '',
    contactPhone: opts.contactPhone ?? '',
  } as unknown as BookingDraft;
  const draftService = {
    draft: () => draftStub,
    outbound: () => null,
    setPassengers: vi.fn(),
    setContact: vi.fn(),
  };
  const userSignal = signal<User | null>(opts.user === undefined ? USER : opts.user);
  const authService = {
    user: userSignal,
    isLoggedIn: computed(() => userSignal() !== null),
    savedPassengers: vi.fn(() =>
      opts.savedError ? throwError(() => new Error('unavailable')) : of(opts.saved ?? [LENA, JONAS]),
    ),
  };

  await TestBed.configureTestingModule({
    imports: [PassengersPage],
    providers: [
      provideRouter([]),
      { provide: BookingDraftService, useValue: draftService },
      { provide: AuthService, useValue: authService },
    ],
  }).compileComponents();

  const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture: ComponentFixture<PassengersPage> = TestBed.createComponent(PassengersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement, draftService, authService, navigateSpy };
}

async function settle(fixture: ComponentFixture<PassengersPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submitForm(el: HTMLElement): void {
  el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
}

function cardFor(el: HTMLElement, name: string): HTMLButtonElement {
  const card = Array.from(el.querySelectorAll<HTMLButtonElement>('.tcard')).find((c) => c.textContent?.includes(name));
  if (!card) throw new Error(`traveller card for ${name} not rendered`);
  return card;
}

describe('PassengersPage saved-traveller autofill', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the profile and saved travellers as selectable cards without exposing document numbers', async () => {
    const { el } = await setup();
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.tcard'));
    expect(el.querySelector('.travellers__title')?.textContent).toContain('Autofill from saved travellers');
    expect(cards.length).toBe(3); // own profile + two saved travellers
    expect(cards[0].textContent).toContain('Your profile');
    const lena = cardFor(el, 'Lena Hoffmann');
    expect(lena.textContent).toContain('Germany');
    expect(lena.textContent).not.toContain('C01X00T47');
  });

  it('fills the form on selection, collapses to a summary and keeps fields editable', async () => {
    const { fixture, el } = await setup();
    cardFor(el, 'Lena Hoffmann').click();
    await settle(fixture);

    const group = fixture.componentInstance.passengersArray.at(0);
    expect(group.get('firstName')?.value).toBe('Lena');
    expect(group.get('lastName')?.value).toBe('Hoffmann');
    expect(group.get('dateOfBirth')?.value).toBe('1992-04-18');
    expect(group.get('nationality')?.value).toBe('Germany');
    expect(group.get('passportNumber')?.value).toBe('C01X00T47');
    expect(group.valid).toBe(true);

    const summary = el.querySelector('.travellers__summary');
    expect(summary?.textContent).toContain('Lena Hoffmann');
    expect(summary?.textContent).toContain('Change traveller');

    const firstNameInput = el.querySelector('#fn-0') as HTMLInputElement;
    expect(firstNameInput.disabled).toBe(false);
    expect(firstNameInput.value).toBe('Lena');
  });

  it('asks for confirmation before replacing manually entered details', async () => {
    const { fixture, el } = await setup();
    const firstName = fixture.componentInstance.passengersArray.at(0).get('firstName');
    firstName?.setValue('Ayman');
    firstName?.markAsDirty();
    await settle(fixture);

    cardFor(el, 'Lena Hoffmann').click();
    await settle(fixture);

    // Nothing replaced yet; a confirmation dialog is shown instead.
    expect(firstName?.value).toBe('Ayman');
    expect(el.querySelector('na-dialog .dialog')).not.toBeNull();

    const confirmHost = Array.from(el.querySelectorAll<HTMLElement>('na-dialog .dialog__actions na-button')).find(
      (b) => b.textContent?.includes('Replace details'),
    );
    (confirmHost?.querySelector('button') as HTMLButtonElement).click();
    await settle(fixture);

    expect(firstName?.value).toBe('Lena');
    expect(el.querySelector('na-dialog .dialog')).toBeNull();
  });

  it('keeps required-field validation when the selected profile is incomplete', async () => {
    const { fixture, el } = await setup({ user: USER, saved: [JONAS] });
    // First card is the signed-in user's own profile (name only).
    (el.querySelector('.tcard') as HTMLButtonElement).click();
    await settle(fixture);

    const group = fixture.componentInstance.passengersArray.at(0);
    expect(group.get('firstName')?.value).toBe('Aya');
    expect(group.get('dateOfBirth')?.value).toBe('');
    expect(group.invalid).toBe(true);
    expect(el.querySelector('.travellers__missing')?.textContent).toContain('date of birth');
  });

  it('tags the saved traveller that matches the signed-in user as their profile', async () => {
    const { el } = await setup({
      user: { ...USER, firstName: 'Lena', lastName: 'Hoffmann' },
      saved: [LENA, JONAS],
    });
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.tcard'));
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Your profile');
  });

  it('disables a traveller already selected for another passenger', async () => {
    const { fixture, el } = await setup({ passengers: [blankAdult(), blankAdult()] });
    const firstPicker = el.querySelectorAll('.pax')[0];
    (firstPicker.querySelector('.tcard') as HTMLButtonElement).click();
    await settle(fixture);

    const secondPicker = el.querySelectorAll('.pax')[1];
    const lenaCard = secondPicker.querySelector('.tcard') as HTMLButtonElement;
    expect(lenaCard.disabled).toBe(true);
    expect(lenaCard.textContent).toContain('Already selected for Adult 1');
  });

  it('renders only the profile card and keeps the form usable when there are no saved travellers', async () => {
    const { el } = await setup({ saved: [] });
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.tcard'));
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Your profile');
    expect(el.querySelector('#fn-0')).not.toBeNull();
  });

  it('shows a retryable error state when saved travellers fail to load', async () => {
    const { el, fixture } = await setup({ savedError: true });
    await settle(fixture);
    expect(el.textContent).toContain('Saved travellers unavailable');
    expect(el.querySelector('na-alert .alert__retry')).not.toBeNull();
    // The own-profile autofill is still available despite the saved-travellers failure.
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.tcard'));
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Your profile');
  });

  it('shows special assistance as coming soon, disabled, and keeps the form valid', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLInputElement>('#sa-0');
    expect(input).not.toBeNull();
    expect(input!.disabled).toBe(true);
    expect(el.querySelector('label[for="sa-0"]')?.textContent).toContain('Coming soon');

    cardFor(el, 'Lena Hoffmann').click();
    await settle(fixture);
    expect(fixture.componentInstance.passengersArray.at(0).valid).toBe(true);
  });
});

// `form` is protected on PassengersPage; reach it through a structural view
// so these tests keep asserting form state without changing expectations.
type ContactFormAccess = {
  form: {
    invalid: boolean;
    controls: {
      contactEmail: { untouched: boolean; valid: boolean };
      contactPhone: { invalid: boolean };
    };
  };
};

function formOf(fixture: ComponentFixture<PassengersPage>): ContactFormAccess['form'] {
  return (fixture.componentInstance as unknown as ContactFormAccess).form;
}

describe('PassengersPage contact details', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('prefills the contact email from the signed-in account while the field is untouched', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLInputElement>('#contact-email')!;
    expect(input.value).toBe('aya@example.com');
    expect(formOf(fixture).controls.contactEmail.untouched).toBe(true);
  });

  it('prefers the draft contact details over the account email on re-entry', async () => {
    const { el } = await setup({ contactEmail: 'family@example.com', contactPhone: '+49 170 0000000' });
    expect(el.querySelector<HTMLInputElement>('#contact-email')!.value).toBe('family@example.com');
    expect(el.querySelector<HTMLInputElement>('#contact-phone')!.value).toBe('+49 170 0000000');
  });

  it('requires a contact email and validates its format', async () => {
    const { fixture, el } = await setup({ user: null });
    submitForm(el);
    await settle(fixture);
    expect(el.querySelector('#contact-email-err')?.textContent).toContain('required');
    expect(formOf(fixture).invalid).toBe(true);

    setInput(el, '#contact-email', 'not-an-email');
    await settle(fixture);
    expect(el.querySelector('#contact-email-err')?.textContent).toContain('valid email');

    setInput(el, '#contact-email', 'guest@example.com');
    await settle(fixture);
    expect(formOf(fixture).controls.contactEmail.valid).toBe(true);
  });

  it('rejects a phone number longer than 50 characters', async () => {
    const { fixture, el } = await setup();
    setInput(el, '#contact-phone', '1'.repeat(51));
    submitForm(el);
    await settle(fixture);
    expect(el.querySelector('#contact-phone-err')).not.toBeNull();
    expect(formOf(fixture).controls.contactPhone.invalid).toBe(true);
  });

  it('writes passengers and contact details to the draft on continue', async () => {
    const { fixture, el, draftService, navigateSpy } = await setup();
    cardFor(el, 'Lena Hoffmann').click();
    await settle(fixture);
    setInput(el, '#contact-phone', '+49 170 1234567');
    await settle(fixture);

    submitForm(el);
    await settle(fixture);

    expect(draftService.setPassengers).toHaveBeenCalledOnce();
    const passengers = draftService.setPassengers.mock.calls[0][0] as PassengerForm[];
    expect(passengers[0].firstName).toBe('Lena');
    expect(draftService.setContact).toHaveBeenCalledWith('aya@example.com', '+49 170 1234567');
    expect(navigateSpy).toHaveBeenCalledWith('/booking/seats');
  });

  it('offers no saved-traveller autofill to guests but keeps the form usable', async () => {
    const { el, authService } = await setup({ user: null });
    expect(authService.savedPassengers).not.toHaveBeenCalled();
    expect(el.querySelector('.tcard')).toBeNull();
    expect(el.textContent).not.toContain('Autofill from saved travellers');
    // Guests still fill the form manually; login is only enforced at review.
    expect(el.querySelector('#fn-0')).not.toBeNull();
    expect(el.querySelector<HTMLInputElement>('#contact-email')!.value).toBe('');
  });
});
