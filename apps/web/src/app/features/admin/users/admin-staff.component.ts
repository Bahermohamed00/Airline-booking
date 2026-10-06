import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { RolesService } from './roles.service';
import { UsersService, type ApiUser } from './users.service';
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
      return Array.isArray(message)
        ? message.join(' ')
        : (message ?? 'The submitted data is invalid.');
    }
    return 'Something went wrong while creating the account. Please try again.';
  }
}
