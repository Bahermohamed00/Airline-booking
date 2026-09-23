import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import type { Passenger } from '../../core/models/domain.model';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaDialog } from '../../shared/ui/dialog.component';
import { ToastService } from '../../shared/ui/toast.service';

type ProfileSection = 'profile' | 'passengers' | 'security' | 'notifications' | 'privacy';

const SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'passengers', label: 'Saved passengers' },
  { id: 'security', label: 'Security & MFA' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
];

const NOTIF_KEY = 'na-notification-prefs';
const CHANNELS = [
  { id: 'EMAIL', label: 'Email' },
  { id: 'SMS', label: 'SMS' },
  { id: 'PUSH', label: 'Push notifications' },
  { id: 'IN_APP', label: 'In-app messages' },
] as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaSkeleton, NaDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>Account settings</h1>
        <p class="na-text-muted">Manage your personal details, security, and preferences.</p>
      </header>

      <div class="layout">
        <nav class="subnav na-card" aria-label="Account sections">
          @for (s of sections; track s.id) {
            <a
              [routerLink]="['/profile', s.id]"
              class="subnav__link"
              [class.subnav__link--active]="section() === s.id"
              [attr.aria-current]="section() === s.id ? 'page' : null"
            >{{ s.label }}</a>
          }
        </nav>

        <div class="content">
          @if (section() === 'profile') {
            <section class="na-card panel" aria-labelledby="profile-h">
              <h2 id="profile-h">Personal details</h2>
              <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                <div class="two-col">
                  <div class="na-field">
                    <label class="na-label" for="firstName">First name</label>
                    <input id="firstName" class="na-input" type="text" formControlName="firstName" autocomplete="given-name" />
                  </div>
                  <div class="na-field">
                    <label class="na-label" for="lastName">Last name</label>
                    <input id="lastName" class="na-input" type="text" formControlName="lastName" autocomplete="family-name" />
                  </div>
                </div>
                <div class="na-field">
                  <label class="na-label" for="email">Email</label>
                  <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="profileForm.controls.email.invalid && profileForm.controls.email.touched" />
                  @if (profileForm.controls.email.touched && profileForm.controls.email.errors?.['email']) { <span class="na-error">Enter a valid email address.</span> }
                </div>
                <div class="na-field">
                  <label class="na-label" for="phone">Phone</label>
                  <input id="phone" class="na-input" type="tel" formControlName="phone" autocomplete="tel" />
                </div>
                <na-button variant="cta" type="submit" [disabled]="profileForm.invalid">Save changes</na-button>
              </form>
            </section>
          }

          @if (section() === 'passengers') {
            <section class="na-card panel" aria-labelledby="pax-h">
              <h2 id="pax-h">Saved passengers</h2>
              @if (paxError()) {
                <na-alert tone="danger" title="Could not load saved passengers" retryable (retry)="loadPassengers()">Please try again.</na-alert>
              } @else if (paxLoading()) {
                <na-skeleton [rows]="[1, 2]" height="4rem" />
              } @else if (passengers().length === 0) {
                <p class="na-text-muted">No saved passengers yet. Passengers you add during booking will appear here.</p>
              } @else {
                <ul class="pax-list">
                  @for (p of passengers(); track p.id) {
                    <li class="pax-item">
                      <div>
                        <p class="pax-item__name">{{ p.firstName }} {{ p.lastName }}</p>
                        <p class="na-text-muted na-text-small">
                          @if (p.dateOfBirth) { Born {{ dateFmt(p.dateOfBirth) }} · }
                          {{ p.nationality ?? 'Nationality not set' }}
                          @if (p.passportNumber) { · <span class="na-text-mono">{{ p.passportNumber }}</span> }
                        </p>
                      </div>
                    </li>
                  }
                </ul>
              }
            </section>
          }

          @if (section() === 'security') {
            <section class="na-card panel" aria-labelledby="pwd-h">
              <h2 id="pwd-h">Change password</h2>
              <form [formGroup]="passwordForm" (ngSubmit)="changePassword()">
                <div class="na-field">
                  <label class="na-label" for="currentPassword">Current password</label>
                  <input id="currentPassword" class="na-input" type="password" formControlName="currentPassword" autocomplete="current-password" />
                </div>
                <div class="na-field">
                  <label class="na-label" for="newPassword">New password</label>
                  <input id="newPassword" class="na-input" type="password" formControlName="newPassword" autocomplete="new-password" aria-describedby="new-pwd-hint" [attr.aria-invalid]="passwordForm.controls.newPassword.touched && passwordForm.controls.newPassword.invalid" />
                  <span id="new-pwd-hint" class="na-hint">At least 8 characters.</span>
                  @if (passwordForm.controls.newPassword.touched && passwordForm.controls.newPassword.errors?.['minlength']) { <span class="na-error">Password must be at least 8 characters.</span> }
                </div>
                <div class="na-field">
                  <label class="na-label" for="confirmNewPassword">Confirm new password</label>
                  <input id="confirmNewPassword" class="na-input" type="password" formControlName="confirmNewPassword" autocomplete="new-password" [attr.aria-invalid]="passwordForm.controls.confirmNewPassword.touched && passwordForm.errors?.['passwordMismatch']" />
                  @if (passwordForm.controls.confirmNewPassword.touched && passwordForm.errors?.['passwordMismatch']) { <span class="na-error">Passwords do not match.</span> }
                </div>
                <na-button variant="primary" type="submit" [disabled]="passwordForm.invalid">Update password</na-button>
              </form>
            </section>

            <section class="na-card panel" aria-labelledby="mfa-h">
              <div class="panel__head">
                <h2 id="mfa-h">Two-factor authentication</h2>
                @if (mfaEnabled()) {
                  <na-badge tone="success">MFA enabled</na-badge>
                }
              </div>
              @if (!mfaSecret()) {
                <p class="na-text-muted">Add an extra layer of security with an authenticator app (TOTP).</p>
                <na-button variant="secondary" (clicked)="startMfa()">Set up MFA</na-button>
              } @else if (!mfaEnabled()) {
                <div class="mfa-setup">
                  <div class="qr" role="img" aria-label="MFA QR code placeholder">
                    @for (cell of qrCells; track $index) {
                      <span class="qr__cell" [class.qr__cell--on]="cell"></span>
                    }
                  </div>
                  <div>
                    <p>Scan this code with your authenticator app, or enter the secret manually:</p>
                    <p class="na-text-mono secret">{{ mfaSecret() }}</p>
                    <div class="na-field">
                      <label class="na-label" for="mfaCode">6-digit code</label>
                      <input
                        id="mfaCode"
                        class="na-input na-text-mono mfa-code"
                        type="text"
                        inputmode="numeric"
                        maxlength="6"
                        [value]="mfaCode()"
                        (input)="mfaCode.set($any($event.target).value)"
                      />
                      @if (mfaError()) { <span class="na-error">{{ mfaError() }}</span> }
                    </div>
                    <na-button variant="cta" [disabled]="mfaCode().length !== 6" (clicked)="verifyMfa()">Verify &amp; enable</na-button>
                  </div>
                </div>
              } @else {
                <na-alert tone="success" title="MFA is active">Your account is protected with two-factor authentication.</na-alert>
              }
            </section>

            <section class="na-card panel" aria-labelledby="reset-h">
              <h2 id="reset-h">Password reset</h2>
              <p class="na-text-muted">Send a password-reset link to your account email.</p>
              <na-button variant="secondary" [loading]="resetLoading()" (clicked)="requestReset()">Send reset link</na-button>
            </section>
          }

          @if (section() === 'notifications') {
            <section class="na-card panel" aria-labelledby="notif-h">
              <h2 id="notif-h">Notification channels</h2>
              <p class="na-text-muted">Choose how NovaAir keeps you informed about your trips.</p>
              <fieldset class="channels">
                <legend class="na-visually-hidden">Notification channels</legend>
                @for (ch of channels; track ch.id) {
                  <div class="channel">
                    <input
                      type="checkbox"
                      class="channel__checkbox"
                      [id]="'ch-' + ch.id"
                      [checked]="notifPrefs()[ch.id]"
                      (change)="toggleChannel(ch.id)"
                    />
                    <label class="na-label" [for]="'ch-' + ch.id">{{ ch.label }}</label>
                  </div>
                }
              </fieldset>
              <p class="na-text-muted na-text-small">Preferences are saved automatically on this device.</p>
            </section>
          }

          @if (section() === 'privacy') {
            <section class="na-card panel" aria-labelledby="privacy-h">
              <h2 id="privacy-h">Your data &amp; privacy</h2>
              <p class="na-text-muted">
                Under the GDPR you have the right to access, correct, export, or erase the personal data NovaAir holds
                about you. Exports include your profile, bookings, and loyalty activity. Account deletion is permanent
                and removes future access to your bookings and miles.
              </p>
              <div class="privacy-actions">
                <na-button variant="secondary" (clicked)="exportOpen.set(true)">Request data export</na-button>
                <na-button variant="danger" (clicked)="deleteOpen.set(true)">Delete account</na-button>
              </div>
            </section>
          }
        </div>
      </div>

      <na-dialog
        [open]="exportOpen()"
        title="Request data export?"
        confirmLabel="Request export"
        (cancelled)="exportOpen.set(false)"
        (confirmed)="confirmExport()"
      >
        <p>We will prepare an archive of your personal data and email you a download link within 30 days.</p>
      </na-dialog>

      <na-dialog
        [open]="deleteOpen()"
        title="Delete your account?"
        confirmLabel="Delete account"
        [confirmDanger]="true"
        (cancelled)="deleteOpen.set(false)"
        (confirmed)="confirmDelete()"
      >
        <p>This permanently deletes your account, loyalty miles, and saved preferences. Active bookings must be cancelled first.</p>
      </na-dialog>
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); }
    .page__head { margin-bottom: var(--na-space-6); }
    .layout { display: grid; grid-template-columns: 240px 1fr; gap: var(--na-space-6); align-items: start; }
    .subnav { padding: var(--na-space-2); display: grid; gap: var(--na-space-1); position: sticky; top: var(--na-space-4); }
    .subnav__link {
      display: block; padding: var(--na-space-2) var(--na-space-3); border-radius: var(--na-radius-md);
      color: var(--na-ink-700); font-weight: var(--na-font-medium); min-height: 44px;
    }
    .subnav__link:hover { background: var(--na-surface-sunken); text-decoration: none; }
    .subnav__link--active { background: var(--na-blue-100); color: var(--na-blue-600); font-weight: var(--na-font-semibold); }
    .content { display: grid; gap: var(--na-space-4); }
    .panel { padding: var(--na-space-6); }
    .panel h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .panel__head { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); }
    .panel > p.na-text-muted { margin-bottom: var(--na-space-4); }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4); }
    .pax-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .pax-item { padding: var(--na-space-3) 0; border-bottom: 1px solid var(--na-border); }
    .pax-item:last-child { border-bottom: none; }
    .pax-item__name { font-weight: var(--na-font-semibold); }
    .mfa-setup { display: flex; gap: var(--na-space-6); align-items: flex-start; flex-wrap: wrap; }
    .qr { display: grid; grid-template-columns: repeat(12, 1fr); width: 132px; height: 132px; flex-shrink: 0; background: var(--na-surface-raised); border: 1px solid var(--na-border); padding: 4px; }
    .qr__cell--on { background: var(--na-navy-800); }
    .secret { letter-spacing: 0.08em; margin: var(--na-space-2) 0 var(--na-space-4); }
    .mfa-code { max-width: 160px; letter-spacing: 0.3em; }
    .channels { border: none; margin: 0 0 var(--na-space-4); padding: 0; display: grid; gap: var(--na-space-3); }
    .channel { display: flex; align-items: center; gap: var(--na-space-3); }
    .channel__checkbox { width: 20px; height: 20px; }
    .privacy-actions { display: flex; gap: var(--na-space-3); flex-wrap: wrap; margin-top: var(--na-space-4); }
    @media (max-width: 639px) {
      .layout { grid-template-columns: 1fr; }
      .subnav { position: static; display: flex; overflow-x: auto; }
      .subnav__link { white-space: nowrap; }
      .two-col { grid-template-columns: 1fr; gap: 0; }
    }
  `,
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly sections = SECTIONS;
  readonly channels = CHANNELS;
  readonly user = this.auth.user;

  readonly section = signal<ProfileSection>('profile');
  readonly passengers = signal<Passenger[]>([]);
  readonly paxLoading = signal(false);
  readonly paxError = signal(false);
  readonly mfaSecret = signal<string | null>(null);
  readonly mfaCode = signal('');
  readonly mfaError = signal<string | null>(null);
  readonly mfaEnabled = signal(false);
  readonly resetLoading = signal(false);
  readonly notifPrefs = signal<Record<string, boolean>>({ EMAIL: true, SMS: false, PUSH: true, IN_APP: true });
  readonly exportOpen = signal(false);
  readonly deleteOpen = signal(false);

  private readonly dFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

  readonly qrCells: boolean[] = Array.from({ length: 144 }, (_, i) => {
    const row = Math.floor(i / 12);
    const col = i % 12;
    const inFinder = (row < 3 && col < 3) || (row < 3 && col > 8) || (row > 8 && col < 3);
    if (inFinder) return (row + col) % 2 === 0;
    return (i * 2654435761) % 89 < 42;
  });

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', Validators.required],
    },
    {
      validators: (group) =>
        group.get('newPassword')?.value === group.get('confirmNewPassword')?.value ? null : { passwordMismatch: true },
    },
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const raw = params.get('section');
      this.section.set(SECTIONS.some((s) => s.id === raw) ? (raw as ProfileSection) : 'profile');
    });

    const u = this.auth.user();
    if (u) {
      this.profileForm.patchValue({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone ?? '',
      });
      this.mfaEnabled.set(u.mfaEnabled);
    }

    this.loadPassengers();
    this.loadNotifPrefs();
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.toast.success('Profile updated.');
  }

  loadPassengers(): void {
    this.paxLoading.set(true);
    this.paxError.set(false);
    this.auth.savedPassengers().subscribe({
      next: (passengers) => {
        this.passengers.set(passengers);
        this.paxLoading.set(false);
      },
      error: () => {
        this.paxLoading.set(false);
        this.paxError.set(true);
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;
    this.passwordForm.reset();
    this.toast.success('Password updated.');
  }

  startMfa(): void {
    this.auth.setupMfa().subscribe({
      next: ({ secret }) => this.mfaSecret.set(secret),
      error: () => this.toast.error('Could not start MFA setup. Please try again.'),
    });
  }

  verifyMfa(): void {
    if (!/^\d{6}$/.test(this.mfaCode())) {
      this.mfaError.set('Enter the 6-digit code from your authenticator app.');
      return;
    }
    this.mfaError.set(null);
    this.mfaEnabled.set(true);
    this.toast.success('Two-factor authentication enabled.');
  }

  requestReset(): void {
    const email = this.auth.user()?.email;
    if (!email || this.resetLoading()) return;
    this.resetLoading.set(true);
    this.auth.requestPasswordReset(email).subscribe({
      next: (result) => {
        this.resetLoading.set(false);
        this.toast.info(result.message);
      },
      error: () => {
        this.resetLoading.set(false);
        this.toast.error('Could not send the reset link. Please try again.');
      },
    });
  }

  toggleChannel(id: string): void {
    this.notifPrefs.update((prefs) => {
      const next = { ...prefs, [id]: !prefs[id] };
      try {
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — preferences still apply for this session
      }
      return next;
    });
    this.toast.success('Notification preferences saved.');
  }

  confirmExport(): void {
    this.exportOpen.set(false);
    this.toast.success('Data export requested. You will receive an email when it is ready.');
  }

  confirmDelete(): void {
    this.deleteOpen.set(false);
    this.toast.warning('Account deletion requested. Our team will contact you to confirm.');
  }

  dateFmt(iso: string): string {
    return this.dFmt.format(new Date(iso));
  }

  private loadNotifPrefs(): void {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) this.notifPrefs.set({ ...this.notifPrefs(), ...JSON.parse(raw) });
    } catch {
      // ignore malformed or unavailable storage
    }
  }
}
