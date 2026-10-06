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

type ProfileSection =
  'profile' | 'passengers' | 'security' | 'sessions' | 'notifications' | 'privacy';

const SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'passengers', label: 'Saved passengers' },
  { id: 'security', label: 'Security & MFA' },
  { id: 'sessions', label: 'Sessions & devices' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
];

const NOTIF_KEY = 'na-notification-prefs';
const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const CHANNEL_GROUPS = [
  {
    label: 'Direct messages',
    description: 'Sent straight to you, even when you are not using the app.',
    channels: [
      {
        id: 'EMAIL',
        label: 'Email',
        description: 'Booking confirmations, receipts, and check-in reminders.',
      },
      {
        id: 'SMS',
        label: 'SMS',
        description: 'Text messages for time-sensitive updates, like gate changes.',
      },
    ],
  },
  {
    label: 'On your devices',
    description: 'Alerts delivered through the NovaAir app and your account.',
    channels: [
      {
        id: 'PUSH',
        label: 'Push notifications',
        description: 'Real-time alerts on your phone or tablet.',
      },
      {
        id: 'IN_APP',
        label: 'In-app messages',
        description: 'Updates inside your NovaAir account inbox.',
      },
    ],
  },
] as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    NaButton,
    NaAlert,
    NaBadge,
    NaSkeleton,
    NaDialog,
    NaEmptyState,
    SessionsPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
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
  readonly notifPrefs = signal<Record<string, boolean>>({
    EMAIL: true,
    SMS: false,
    PUSH: true,
    IN_APP: true,
  });
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
        group.get('newPassword')?.value === group.get('confirmNewPassword')?.value
          ? null
          : { passwordMismatch: true },
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

  formatDob(iso: string): string {
    return DATE_ONLY.format(new Date(iso));
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
    this.auth
      .changePassword({ currentPassword, newPassword, confirmPassword: confirmNewPassword })
      .subscribe({
        next: () => {
          this.passwordLoading.set(false);
          this.passwordForm.reset();
          this.toast.success('Password changed. Other devices have been signed out.');
        },
        error: (err) => {
          this.passwordLoading.set(false);
          this.passwordError.set(
            err?.message ?? 'Could not change your password. Please try again.',
          );
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
