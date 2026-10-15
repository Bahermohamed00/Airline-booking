import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { RolesService } from './roles.service';
import { UsersService, type ApiUser } from './users.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { USER_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import type { Role, UserStatus } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaDialog } from '../../../shared/ui/dialog.component';

interface StaffRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  mfaEnabled: boolean;
  roles: string[];
  roleIds: string[];
}

@Component({
  selector: 'na-admin-staff',
  imports: [ReactiveFormsModule, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState, NaDialog],
  templateUrl: './admin-staff.component.html',
  styleUrl: './admin-staff.component.css',
})
export class AdminStaffPage {
  private readonly auth = inject(AuthService);
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly USER_STATUS_MAP = USER_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Staff' }];

  readonly canManage = computed(() => this.auth.hasPermission('staff:manage'));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly staff = signal<StaffRow[]>([]);
  readonly roles = signal<Role[]>([]);
  /** Display filter only — the backend remains the authority on role assignment. */
  readonly staffRoles = computed(() => this.roles().filter((r) => r.name !== 'Customer'));

  readonly drawerOpen = signal(false);
  readonly editing = signal<StaffRow | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly confirmTouched = signal(false);

  /** Status-change flow: the dialog target and an in-flight guard. */
  readonly pendingStatusUser = signal<StaffRow | null>(null);
  readonly statusSaving = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
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
    this.editing.set(null);
    this.form.controls.password.enable();
    this.form.controls.confirmPassword.enable();
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(user: StaffRow): void {
    this.editing.set(user);
    this.formError.set(null);
    // Passwords are never exposed or validated while editing.
    this.form.controls.password.disable();
    this.form.controls.confirmPassword.disable();
    this.form.reset();
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
      roleId: user.roleIds[0] ?? '',
    });
    this.confirmTouched.set(false);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
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
        this.staff.set(
          users
            .map((u) => this.toRow(u))
            .filter((u) => u.roles.length > 0 && u.roles.some((r) => r !== 'Customer')),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load staff accounts.');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.editing()) {
      this.saveEdit();
    } else {
      this.addStaff();
    }
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
      .createStaff({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        roleIds: [roleId],
      })
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
          this.formError.set(this.toErrorMessage(err, 'create'));
        },
      });
  }

  saveEdit(): void {
    const editing = this.editing();
    if (!editing) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { firstName, lastName, email, phone, roleId } = this.form.getRawValue();
    const trimmedPhone = phone.trim();
    this.submitting.set(true);
    this.formError.set(null);
    this.usersService
      .updateUser(editing.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: trimmedPhone === '' ? null : trimmedPhone,
        roleIds: [roleId],
      })
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.toast.success(`Staff account updated for ${updated.email}.`);
          this.drawerOpen.set(false);
          this.editing.set(null);
          this.resetForm();
          this.loadStaff();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.formError.set(this.toErrorMessage(err, 'update'));
        },
      });
  }

  /** The status action is hidden on the administrator's own row (UI-level; the API also rejects it). */
  isSelf(user: StaffRow): boolean {
    return this.auth.user()?.id === user.id;
  }

  askStatusChange(user: StaffRow): void {
    this.pendingStatusUser.set(user);
  }

  confirmStatusChange(): void {
    const user = this.pendingStatusUser();
    if (!user || this.statusSaving()) return;
    const next: UserStatus = user.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    this.statusSaving.set(true);
    // Status-only PATCH: roles and permissions are untouched by the backend
    // when roleIds is absent, and the response carries them for the row.
    this.usersService.updateUser(user.id, { status: next }).subscribe({
      next: (updated) => {
        const row = this.toRow(updated);
        this.staff.update((list) => list.map((u) => (u.id === row.id ? row : u)));
        this.statusSaving.set(false);
        this.pendingStatusUser.set(null);
        this.toast.success(
          next === 'DEACTIVATED'
            ? `${user.firstName} ${user.lastName}'s account deactivated.`
            : `${user.firstName} ${user.lastName}'s account reactivated.`,
        );
      },
      error: (err: unknown) => {
        this.statusSaving.set(false);
        this.pendingStatusUser.set(null);
        this.toast.error(toErrorMessage(err, 'Could not update the account status.'));
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
      phone: user.phone,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      roles: user.userRoles.map((ur) => ur.role.name),
      roleIds: user.userRoles.map((ur) => ur.role.id),
    };
  }

  private toErrorMessage(err: unknown, mode: 'create' | 'update'): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 409) {
      return 'An account with this email already exists.';
    }
    if (status === 403) {
      return mode === 'create'
        ? 'Only a Super Admin can create staff accounts.'
        : 'Only a Super Admin can update staff accounts.';
    }
    if (status === 400) {
      const message = (err as { error?: { message?: string | string[] } }).error?.message;
      return Array.isArray(message)
        ? message.join(' ')
        : (message ?? 'The submitted data is invalid.');
    }
    return mode === 'create'
      ? 'Something went wrong while creating the account. Please try again.'
      : 'Something went wrong while updating the account. Please try again.';
  }
}
