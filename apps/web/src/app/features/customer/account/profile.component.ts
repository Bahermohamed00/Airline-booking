import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import type { Passenger } from '../../../core/models/domain.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { SessionsPanel } from './sessions-panel.component';

type ProfileSection = 'profile' | 'passengers' | 'security' | 'sessions' | 'notifications' | 'privacy';

const SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'passengers', label: 'Saved passengers' },
  { id: 'security', label: 'Security & MFA' },
  { id: 'sessions', label: 'Sessions & devices' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
];

const NOTIF_KEY = 'na-notification-prefs';
const CHANNEL_GROUPS = [
  {
    label: 'Direct messages',
    description: 'Sent straight to you, even when you are not using the app.',
    channels: [
      { id: 'EMAIL', label: 'Email', description: 'Booking confirmations, receipts, and check-in reminders.' },
      { id: 'SMS', label: 'SMS', description: 'Text messages for time-sensitive updates, like gate changes.' },
    ],
  },
  {
    label: 'On your devices',
    description: 'Alerts delivered through the NovaAir app and your account.',
    channels: [
      { id: 'PUSH', label: 'Push notifications', description: 'Real-time alerts on your phone or tablet.' },
      { id: 'IN_APP', label: 'In-app messages', description: 'Updates inside your NovaAir account inbox.' },
    ],
  },
] as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaSkeleton, NaDialog, NaEmptyState, SessionsPanel],
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
              <header class="panel__head">
                <h2 id="profile-h" class="panel__title">Personal details</h2>
                <p class="panel__desc">Update the name and contact details we use for your bookings.</p>
              </header>

              @if (user(); as u) {
                <div class="account-strip">
                  <span class="account-strip__avatar" aria-hidden="true">{{ u.firstName.charAt(0) }}{{ u.lastName.charAt(0) }}</span>
                  <div class="account-strip__meta">
                    <p class="account-strip__name">{{ u.firstName }} {{ u.lastName }}</p>
                    <p class="account-strip__email">{{ u.email }}</p>
                  </div>
                  @if (u.emailVerified) {
                    <na-badge tone="success">Email verified</na-badge>
                  } @else {
                    <na-badge tone="neutral">Email not verified</na-badge>
                  }
                </div>
              }

              <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                @if (profileError()) {
                  <na-alert tone="danger" title="Could not save your profile">{{ profileError() }}</na-alert>
                }
                <div class="field-grid">
                  <div class="na-field">
                    <label class="na-label" for="firstName">First name</label>
                    <input id="firstName" class="na-input" type="text" formControlName="firstName" autocomplete="given-name" />
                  </div>
                  <div class="na-field">
                    <label class="na-label" for="lastName">Last name</label>
                    <input id="lastName" class="na-input" type="text" formControlName="lastName" autocomplete="family-name" />
                  </div>
                  <div class="na-field">
                    <label class="na-label" for="email">Email</label>
                    <input id="email" class="na-input" type="email" formControlName="email" autocomplete="email" aria-describedby="email-hint" />
                    <span id="email-hint" class="na-hint">Your sign-in email can&apos;t be changed here.</span>
                  </div>
                  <div class="na-field">
                    <label class="na-label" for="phone">Phone</label>
                    <input id="phone" class="na-input" type="tel" formControlName="phone" autocomplete="tel" aria-describedby="phone-hint" />
                    <span id="phone-hint" class="na-hint">Only used for urgent updates about your trips.</span>
                  </div>
                </div>
                <div class="form-actions">
                  <na-button variant="cta" type="submit" [loading]="profileLoading()" [disabled]="profileForm.invalid">Save changes</na-button>
                </div>
              </form>
            </section>
          }

          @if (section() === 'passengers') {
            <section class="na-card panel" aria-labelledby="pax-h">
              <header class="panel__head">
                <h2 id="pax-h" class="panel__title">Saved passengers</h2>
                <p class="panel__desc">Passengers stored on your account, ready for faster checkout.</p>
              </header>
              @if (paxError()) {
                <na-alert tone="danger" title="Could not load saved passengers" retryable (retry)="loadPassengers()">Please try again.</na-alert>
              } @else if (paxLoading()) {
                <na-skeleton [rows]="[1, 2]" height="4rem" />
              } @else if (passengers().length === 0) {
                <na-empty-state
                  icon="👤"
                  title="No saved passengers"
                  message="Passengers you add during booking will appear here for faster checkout."
                />
              } @else {
                <ul class="pax-list">
                  @for (p of passengers(); track p.id) {
                    <li class="pax-item">
                      <p class="pax-item__name">{{ p.firstName }} {{ p.lastName }}</p>
                      <p class="pax-item__meta">
                        @if (p.dateOfBirth) { Born {{ dateFmt(p.dateOfBirth) }} · }
                        {{ p.nationality ?? 'Nationality not set' }}
                        @if (p.passportNumber) { · <span class="na-text-mono">{{ p.passportNumber }}</span> }
                      </p>
                    </li>
                  }
                </ul>
              }
            </section>
          }

          @if (section() === 'security') {
            <section class="na-card panel" aria-labelledby="security-h">
              <header class="panel__head">
                <h2 id="security-h" class="panel__title">Security &amp; MFA</h2>
                <p class="panel__desc">Keep your account protected with a strong password and two-factor authentication.</p>
              </header>

              <div class="subsec" aria-labelledby="pwd-h">
                <h3 id="pwd-h" class="subsec__title">Change password</h3>
                <form class="form-narrow" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
                  @if (passwordError()) {
                    <na-alert tone="danger" title="Could not change your password">{{ passwordError() }}</na-alert>
                  }
                  <div class="na-field">
                    <label class="na-label" for="currentPassword">Current password</label>
                    <input id="currentPassword" class="na-input" type="password" formControlName="currentPassword" autocomplete="current-password" />
                  </div>
                  <div class="na-field">
                    <label class="na-label" for="newPassword">New password</label>
                    <input id="newPassword" class="na-input" type="password" formControlName="newPassword" autocomplete="new-password" aria-describedby="new-pwd-hint" [attr.aria-invalid]="passwordForm.controls.newPassword.touched && passwordForm.controls.newPassword.invalid" />
                    <span id="new-pwd-hint" class="na-hint">At least 12 characters.</span>
                    @if (passwordForm.controls.newPassword.touched && passwordForm.controls.newPassword.errors?.['minlength']) { <span class="na-error">Password must be at least 12 characters.</span> }
                  </div>
                  <div class="na-field">
                    <label class="na-label" for="confirmNewPassword">Confirm new password</label>
                    <input id="confirmNewPassword" class="na-input" type="password" formControlName="confirmNewPassword" autocomplete="new-password" [attr.aria-invalid]="passwordForm.controls.confirmNewPassword.touched && passwordForm.errors?.['passwordMismatch']" />
                    @if (passwordForm.controls.confirmNewPassword.touched && passwordForm.errors?.['passwordMismatch']) { <span class="na-error">Passwords do not match.</span> }
                  </div>
                  <div class="form-actions">
                    <na-button variant="primary" type="submit" [loading]="passwordLoading()" [disabled]="passwordForm.invalid">Update password</na-button>
                  </div>
                </form>
              </div>

              <div class="subsec" aria-labelledby="mfa-h">
                <div class="subsec__head">
                  <div class="subsec__intro">
                    <h3 id="mfa-h" class="subsec__title">Two-factor authentication</h3>
                    <p class="subsec__desc">Add an extra layer of security with an authenticator app (TOTP).</p>
                  </div>
                  @if (mfaEnabled()) {
                    <na-badge tone="success">Enabled</na-badge>
                  } @else {
                    <na-badge tone="neutral">Not enabled</na-badge>
                  }
                </div>
                @if (!mfaSecret()) {
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
              </div>

              <div class="subsec" aria-labelledby="reset-h">
                <h3 id="reset-h" class="subsec__title">Password reset</h3>
                <p class="subsec__desc">Send a password-reset link to your account email.</p>
                <na-button variant="secondary" [loading]="resetLoading()" (clicked)="requestReset()">Send reset link</na-button>
              </div>
            </section>
          }

          @if (section() === 'sessions') {
            <app-sessions-panel />
          }

          @if (section() === 'notifications') {
            <section class="na-card panel" aria-labelledby="notif-h">
              <header class="panel__head">
                <h2 id="notif-h" class="panel__title">Notifications</h2>
                <p class="panel__desc">Choose how NovaAir keeps you informed about your trips.</p>
              </header>

              @for (g of channelGroups; track g.label) {
                <fieldset class="pref-group">
                  <legend class="pref-group__legend">{{ g.label }}</legend>
                  <p class="pref-group__desc">{{ g.description }}</p>
                  <ul class="pref-list">
                    @for (ch of g.channels; track ch.id) {
                      <li class="pref-row">
                        <div class="pref-row__text">
                          <label class="pref-row__label" [for]="'ch-' + ch.id">{{ ch.label }}</label>
                          <p class="pref-row__desc">{{ ch.description }}</p>
                        </div>
                        <input
                          type="checkbox"
                          class="switch"
                          [id]="'ch-' + ch.id"
                          [checked]="notifPrefs()[ch.id]"
                          (change)="toggleChannel(ch.id)"
                        />
                      </li>
                    }
                  </ul>
                </fieldset>
              }
              <p class="na-text-muted na-text-small">Preferences are saved automatically on this device.</p>
            </section>
          }

          @if (section() === 'privacy') {
            <section class="na-card panel" aria-labelledby="privacy-h">
              <header class="panel__head">
                <h2 id="privacy-h" class="panel__title">Your data &amp; privacy</h2>
                <p class="panel__desc">Export or erase the personal data NovaAir holds about you.</p>
              </header>
              <p class="privacy-note">
                Under the GDPR you have the right to access, correct, export, or erase the personal data NovaAir holds
                about you. Exports include your profile, bookings, and loyalty activity.
              </p>
              <ul class="action-list">
                <li class="action-row">
                  <div class="action-row__text">
                    <p class="action-row__label">Data export</p>
                    <p class="action-row__desc">Request an archive of your personal data — we prepare it and email you a download link within 30 days.</p>
                  </div>
                  <na-button variant="secondary" (clicked)="exportOpen.set(true)">Request data export</na-button>
                </li>
                <li class="action-row">
                  <div class="action-row__text">
                    <p class="action-row__label">Account deletion</p>
                    <p class="action-row__desc">Permanently deletes your account, loyalty miles, and saved preferences. Active bookings must be cancelled first.</p>
                  </div>
                  <na-button variant="danger" (clicked)="deleteOpen.set(true)">Delete account</na-button>
                </li>
              </ul>
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

    .subnav {
      padding: var(--na-space-2); display: grid; gap: var(--na-space-1);
      position: sticky; top: var(--na-space-4);
    }
    .subnav__link {
      display: block; padding: var(--na-space-2) var(--na-space-3); border-radius: var(--na-radius-md);
      color: var(--na-ink-700); font-weight: var(--na-font-medium); min-height: 44px;
      transition: background var(--na-motion-fast) var(--na-ease), color var(--na-motion-fast) var(--na-ease);
    }
    .subnav__link:hover { background: var(--na-surface-sunken); text-decoration: none; }
    .subnav__link--active, .subnav__link--active:hover {
      background: var(--na-navy-600); color: var(--na-ink-900); font-weight: var(--na-font-semibold);
    }

    .content { display: grid; gap: var(--na-space-4); }
    .panel { padding: var(--na-space-6); }
    .panel__head {
      border-bottom: 1px solid var(--na-border);
      padding-bottom: var(--na-space-4); margin-bottom: var(--na-space-5);
    }
    .panel__title { font-size: var(--na-text-xl); margin-bottom: var(--na-space-1); }
    .panel__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); }

    .account-strip {
      display: flex; align-items: center; gap: var(--na-space-4);
      padding: var(--na-space-4); margin-bottom: var(--na-space-6);
      background: var(--na-surface-sunken); border: 1px solid var(--na-border);
      border-radius: var(--na-radius-lg);
    }
    .account-strip__avatar {
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--na-navy-600); color: var(--na-ink-900);
      font-size: var(--na-text-sm); font-weight: var(--na-font-semibold); text-transform: uppercase;
    }
    .account-strip__meta { flex: 1; min-width: 0; }
    .account-strip__name { font-weight: var(--na-font-semibold); }
    .account-strip__email { color: var(--na-ink-500); font-size: var(--na-text-sm); overflow-wrap: anywhere; }

    .field-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: var(--na-space-4); }
    .form-actions { display: flex; justify-content: flex-end; }
    .form-narrow { max-width: 26rem; }

    .pax-list { list-style: none; margin: 0; padding: 0; }
    .pax-item { padding: var(--na-space-4) 0; border-bottom: 1px solid var(--na-border); }
    .pax-item:first-child { padding-top: var(--na-space-1); }
    .pax-item:last-child { border-bottom: none; padding-bottom: 0; }
    .pax-item__name { font-weight: var(--na-font-semibold); margin-bottom: var(--na-space-1); }
    .pax-item__meta { color: var(--na-ink-500); font-size: var(--na-text-sm); }

    .subsec { padding: var(--na-space-5) 0; border-bottom: 1px solid var(--na-border); }
    .subsec:first-of-type { padding-top: 0; }
    .subsec:last-child { border-bottom: none; padding-bottom: 0; }
    .subsec__title { font-size: var(--na-text-base); margin-bottom: var(--na-space-1); }
    .subsec__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); margin-bottom: var(--na-space-4); }
    .subsec > form { margin-top: var(--na-space-3); }
    .subsec__head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--na-space-4); margin-bottom: var(--na-space-4);
    }
    .subsec__head .subsec__desc { margin-bottom: 0; }
    .subsec__head na-badge { flex-shrink: 0; margin-top: var(--na-space-1); }

    .mfa-setup { display: flex; gap: var(--na-space-6); align-items: flex-start; flex-wrap: wrap; }
    .qr { display: grid; grid-template-columns: repeat(12, 1fr); width: 132px; height: 132px; flex-shrink: 0; background: var(--na-cream); border: 1px solid var(--na-border); padding: 4px; }
    .qr__cell--on { background: var(--na-brown-900); }
    .secret { letter-spacing: 0.08em; margin: var(--na-space-2) 0 var(--na-space-4); }
    .mfa-code { max-width: 160px; letter-spacing: 0.3em; }

    .pref-group { border: none; margin: 0 0 var(--na-space-6); padding: 0; }
    .pref-group__legend {
      padding: 0; margin-bottom: var(--na-space-1);
      font-size: var(--na-text-base); font-weight: var(--na-font-semibold); color: var(--na-ink-900);
    }
    .pref-group__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); margin-bottom: var(--na-space-3); }
    .pref-list {
      list-style: none; margin: 0; padding: 0;
      border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); overflow: hidden;
    }
    .pref-row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-4);
      padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border);
    }
    .pref-row:last-child { border-bottom: none; }
    .pref-row__label { display: block; font-weight: var(--na-font-medium); cursor: pointer; margin-bottom: 2px; }
    .pref-row__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); }

    .switch {
      appearance: none; flex-shrink: 0; margin: 0; padding: 0; cursor: pointer;
      width: 44px; height: 24px; border-radius: var(--na-radius-full);
      background: var(--na-surface-sunken); border: 1px solid var(--na-border-strong);
      position: relative;
      transition: background var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease);
    }
    .switch::before {
      content: ''; position: absolute; top: 50%; left: 3px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--na-ink-300);
      transform: translateY(-50%);
      transition: transform var(--na-motion-base) var(--na-ease), background var(--na-motion-fast) var(--na-ease);
    }
    .switch:hover { border-color: var(--na-ink-300); }
    .switch:checked { background: var(--na-cta); border-color: var(--na-cta); }
    .switch:checked::before { transform: translate(20px, -50%); background: var(--na-cta-contrast); }
    .switch:disabled { opacity: 0.55; cursor: not-allowed; }

    .privacy-note {
      color: var(--na-ink-500); font-size: var(--na-text-sm);
      line-height: var(--na-leading-base); max-width: 68ch; margin-bottom: var(--na-space-5);
    }
    .action-list {
      list-style: none; margin: 0; padding: 0;
      border: 1px solid var(--na-border); border-radius: var(--na-radius-lg);
    }
    .action-row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--na-space-4);
      padding: var(--na-space-4); border-bottom: 1px solid var(--na-border);
    }
    .action-row:last-child { border-bottom: none; }
    .action-row__text { min-width: 0; }
    .action-row__label { font-weight: var(--na-font-semibold); margin-bottom: var(--na-space-1); }
    .action-row__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); max-width: 62ch; }
    .action-row na-button { flex-shrink: 0; }

    @media (prefers-reduced-motion: reduce) {
      .subnav__link, .switch, .switch::before { transition: none; }
    }

    @media (max-width: 639px) {
      .layout { grid-template-columns: 1fr; }
      .subnav {
        position: static; display: flex; gap: var(--na-space-2);
        overflow-x: auto; scrollbar-width: thin;
      }
      .subnav__link {
        white-space: nowrap; flex-shrink: 0;
        display: inline-flex; align-items: center; min-height: 40px;
      }
      .panel { padding: var(--na-space-5); }
      .field-grid { grid-template-columns: 1fr; }
      .account-strip { flex-wrap: wrap; }
      .action-row { flex-direction: column; align-items: stretch; }
      .action-row na-button { align-self: flex-start; }
    }
  `,
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly sections = SECTIONS;
  readonly channelGroups = CHANNEL_GROUPS;
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
  readonly profileLoading = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly passwordLoading = signal(false);
  readonly passwordError = signal<string | null>(null);
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
      newPassword: ['', [Validators.required, Validators.minLength(12)]],
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
      this.profileForm.controls.email.disable(); // email change is not supported here
      this.mfaEnabled.set(u.mfaEnabled);
    }

    this.loadPassengers();
    this.loadNotifPrefs();
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.profileLoading()) return;
    this.profileLoading.set(true);
    this.profileError.set(null);
    // Email is intentionally excluded: email change is not supported here.
    const { firstName, lastName, phone } = this.profileForm.getRawValue();
    this.auth.updateProfile({ firstName, lastName, phone }).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.toast.success('Profile updated.');
      },
      error: (err) => {
        this.profileLoading.set(false);
        this.profileError.set(err?.message ?? 'Could not update your profile. Please try again.');
      },
    });
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
    if (this.passwordForm.invalid || this.passwordLoading()) return;
    this.passwordLoading.set(true);
    this.passwordError.set(null);
    const { currentPassword, newPassword, confirmNewPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword({ currentPassword, newPassword, confirmPassword: confirmNewPassword }).subscribe({
      next: () => {
        this.passwordLoading.set(false);
        this.passwordForm.reset();
        this.toast.success('Password changed. Other devices have been signed out.');
      },
      error: (err) => {
        this.passwordLoading.set(false);
        this.passwordError.set(err?.message ?? 'Could not change your password. Please try again.');
      },
    });
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
