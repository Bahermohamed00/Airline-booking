import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { RolesService } from '../../../core/services/roles.service';
import { UsersService, type ApiUser } from '../../../core/services/users.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { USER_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { Role, UserStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

interface StaffRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  mfaEnabled: boolean;
  roles: string[];
}

@Component({
  selector: 'na-admin-staff',
  imports: [ReactiveFormsModule, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState],
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <div>
          <h1>Staff</h1>
          <p class="page__sub">Manage staff accounts and their assigned roles.</p>
        </div>
        @if (canManage() && !loading()) {
          <na-button variant="cta" (clicked)="openDrawer()">Add staff</na-button>
        }
      </header>

      @if (!canManage()) {
        <na-empty-state
          icon="🔒"
          title="Access restricted"
          message="You need the staff:manage permission to administer staff accounts. Contact a Super Admin."
        />
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="loadStaff()">Retry</na-button>
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>MFA</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              @for (user of staff(); track user.id) {
                <tr>
                  <td data-label="Name">{{ user.firstName }} {{ user.lastName }}</td>
                  <td data-label="Email">{{ user.email }}</td>
                  <td data-label="Status">
                    <na-badge [tone]="statusLabel(USER_STATUS_MAP, user.status).tone">
                      {{ statusLabel(USER_STATUS_MAP, user.status).label }}
                    </na-badge>
                  </td>
                  <td data-label="MFA">{{ user.mfaEnabled ? '✓' : '—' }}</td>
                  <td data-label="Role">{{ user.roles.join(', ') || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (drawerOpen()) {
        <div class="backdrop" (click)="closeDrawer()" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Add staff member"
          tabindex="-1"
          (keydown.escape)="closeDrawer()"
        >
          <header class="drawer__head">
            <h2>Add staff member</h2>
            <button type="button" class="drawer__close" aria-label="Close" (click)="closeDrawer()">×</button>
          </header>
          <form [formGroup]="form" (ngSubmit)="addStaff()">
            <div class="na-field">
              <label class="na-label" for="staff-first">First name</label>
              <input id="staff-first" class="na-input" formControlName="firstName" autocomplete="given-name" />
              @if (showError('firstName')) {
                <p class="na-error">First name is required.</p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-last">Last name</label>
              <input id="staff-last" class="na-input" formControlName="lastName" autocomplete="family-name" />
              @if (showError('lastName')) {
                <p class="na-error">Last name is required.</p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-email">Email</label>
              <input id="staff-email" class="na-input" type="email" formControlName="email" autocomplete="email" />
              @if (showError('email')) {
                <p class="na-error">A valid email address is required.</p>
              }
              <p class="na-hint">The account is active immediately — share the password with the staff member through a secure channel.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-password">Password</label>
              <input id="staff-password" class="na-input" type="password" formControlName="password" autocomplete="new-password" />
              @if (showError('password')) {
                <p class="na-error">Password must be at least 12 characters.</p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-confirm">Confirm password</label>
              <input id="staff-confirm" class="na-input" type="password" formControlName="confirmPassword" autocomplete="new-password" />
              @if (confirmTouched() && form.hasError('passwordsMatch')) {
                <p class="na-error">Passwords do not match.</p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-role">Role</label>
              <select id="staff-role" class="na-select" formControlName="roleId">
                <option value="" disabled>Select a role…</option>
                @for (r of staffRoles(); track r.id) {
                  <option [value]="r.id">{{ r.name }}</option>
                }
              </select>
              @if (roleTouched() && form.controls.roleId.invalid) {
                <p class="na-error">Please select a role.</p>
              }
            </div>
            @if (formError()) {
              <p class="na-error" role="alert">{{ formError() }}</p>
            }
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="closeDrawer()">Cancel</na-button>
              <na-button variant="primary" type="submit" [disabled]="submitting()" [loading]="submitting()">Create account</na-button>
            </div>
          </form>
        </aside>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    .list-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    .list-error p { margin: 0; color: var(--na-ink-500); }
    .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 99; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 100;
      width: min(480px, 100vw); background: var(--na-surface-raised);
      border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg); padding: var(--na-space-6); overflow-y: auto;
    }
    .drawer__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--na-space-5); }
    .drawer__close { background: none; border: none; font-size: 1.5rem; color: var(--na-ink-500); min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md); }
    .drawer__close:hover { background: var(--na-surface-sunken); color: var(--na-ink-900); }
    .drawer__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); margin-top: var(--na-space-5); }
    @media (max-width: 639px) {
      .drawer { width: 100vw; padding: var(--na-space-4); }
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminStaffPage {
  private readonly auth = inject(AuthService);
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly USER_STATUS_MAP = USER_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Staff' },
  ];

  readonly canManage = computed(() => this.auth.hasPermission('staff:manage'));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly staff = signal<StaffRow[]>([]);
  readonly roles = signal<Role[]>([]);
  /** Display filter only — the backend remains the authority on role assignment. */
  readonly staffRoles = computed(() => this.roles().filter((r) => r.name !== 'Customer'));

  readonly drawerOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly confirmTouched = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', Validators.required],
      roleId: ['', Validators.required],
    },
    {
      validators: (group) => {
        const password = group.get('password')?.value as string;
        const confirm = group.get('confirmPassword')?.value as string;
        return password === confirm ? null : { passwordsMatch: true };
      },
    },
  );

  constructor() {
    this.form.controls.confirmPassword.statusChanges.subscribe(() => {
      if (this.form.controls.confirmPassword.touched) {
        this.confirmTouched.set(true);
      }
    });
    if (this.canManage()) {
      this.loadRoles();
      this.loadStaff();
    } else {
      this.loading.set(false);
    }
  }

  showError(control: 'firstName' | 'lastName' | 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  roleTouched(): boolean {
    return this.form.controls.roleId.touched;
  }

  openDrawer(): void {
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.formError.set(null);
    this.resetForm();
  }

  loadRoles(): void {
    this.rolesService.listRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => this.toast.error('Could not load the role catalog.'),
    });
  }

  loadStaff(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.usersService.listUsers().subscribe({
      next: (users) => {
        this.staff.set(users.map((u) => this.toRow(u)).filter((u) => u.roles.length > 0 && u.roles.some((r) => r !== 'Customer')));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load staff accounts.');
        this.loading.set(false);
      },
    });
  }

  addStaff(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.confirmTouched.set(true);
      return;
    }
    const { firstName, lastName, email, password, roleId } = this.form.getRawValue();
    this.submitting.set(true);
    this.formError.set(null);
    this.usersService
      .createStaff({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, roleIds: [roleId] })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.toast.success(`Staff account created for ${created.email}.`);
          this.drawerOpen.set(false);
          this.resetForm();
          this.loadStaff();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.formError.set(this.toErrorMessage(err));
        },
      });
  }

  private resetForm(): void {
    this.form.reset();
    this.confirmTouched.set(false);
  }

  private toRow(user: ApiUser): StaffRow {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  private toErrorMessage(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 409) {
      return 'An account with this email already exists.';
    }
    if (status === 403) {
      return 'Only a Super Admin can create staff accounts.';
    }
    if (status === 400) {
      const message = (err as { error?: { message?: string | string[] } }).error?.message;
      return Array.isArray(message) ? message.join(' ') : (message ?? 'The submitted data is invalid.');
    }
    return 'Something went wrong while creating the account. Please try again.';
  }
}
