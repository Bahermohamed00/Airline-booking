import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
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
  user?: User | null;
  saved?: Passenger[];
  savedError?: boolean;
  passengers?: PassengerForm[];
}

async function setup(opts: SetupOptions = {}) {
  const draftStub = { passengers: opts.passengers ?? [blankAdult()] } as unknown as BookingDraft;
  const draftService = { draft: () => draftStub, outbound: () => null, setPassengers: vi.fn() };
  const authService = {
    user: signal(opts.user ?? null),
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

  const fixture: ComponentFixture<PassengersPage> = TestBed.createComponent(PassengersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement, draftService };
}

async function settle(fixture: ComponentFixture<PassengersPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('PassengersPage saved-traveller autofill', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists saved travellers as selectable cards without exposing document numbers', async () => {
    const { el } = await setup();
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.tcard'));
    expect(el.querySelector('.travellers__title')?.textContent).toContain('Autofill from saved travellers');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Lena Hoffmann');
    expect(cards[0].textContent).toContain('Germany');
    expect(cards[0].textContent).not.toContain('C01X00T47');
  });

  it('fills the form on selection, collapses to a summary and keeps fields editable', async () => {
    const { fixture, el } = await setup();
    (el.querySelector('.tcard') as HTMLButtonElement).click();
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

    (el.querySelector('.tcard') as HTMLButtonElement).click();
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

  it('renders no picker and keeps the form usable when there are no saved travellers', async () => {
    const { el } = await setup({ saved: [] });
    expect(el.querySelector('.tcard')).toBeNull();
    expect(el.querySelector('#fn-0')).not.toBeNull();
  });

  it('shows a retryable error state when saved travellers fail to load', async () => {
    const { el, fixture } = await setup({ savedError: true });
    await settle(fixture);
    expect(el.textContent).toContain('Saved travellers unavailable');
    expect(el.querySelector('.tcard')).toBeNull();
    expect(el.querySelector('na-alert .alert__retry')).not.toBeNull();
  });
});
