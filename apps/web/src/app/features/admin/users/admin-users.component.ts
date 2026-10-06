import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/ui/toast.service';
import { USER_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { UsersService, type ApiUser } from './users.service';
import type { User, UserStatus } from '../../../core/models/domain.model';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaAlert } from '../../../shared/ui/alert.component';

@Component({
  selector: 'na-admin-users',
  standalone: true,
  imports: [
    RouterLink,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaDialog,
    NaSkeleton,
    NaEmptyState,
    NaAlert,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersPage {
  private readonly toast = inject(ToastService);
  private readonly usersService = inject(UsersService);
  readonly USER_STATUS_MAP = USER_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Users & Passengers' },
  ];

  readonly loading = signal(true);
  readonly users = signal<User[]>([]);
  readonly selected = signal<User | null>(null);
  readonly pendingUser = signal<User | null>(null);
  readonly loadError = signal<string | null>(null);
  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.usersService.listUsers().subscribe({
      next: (users) => {
        this.users.set(users.map((u) => this.toRow(u)));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load users.');
        this.loading.set(false);
      },
    });
  }

  private toRow(u: ApiUser): User {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      emailVerified: u.emailVerified,
      mfaEnabled: u.mfaEnabled,
      status: u.status,
      roles: u.userRoles.map((ur) => ur.role.name),
      permissions: this.flattenPermissions(u),
    };
  }

  private flattenPermissions(u: ApiUser): string[] {
    const perms = new Set<string>();
    for (const ur of u.userRoles) {
      if (ur.role.isSuperAdmin) perms.add('super_admin');
      for (const rp of ur.role.rolePermissions ?? []) {
        perms.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }
    return [...perms].sort();
  }

  select(user: User): void {
    this.selected.set(this.selected()?.id === user.id ? null : user);
  }

  effectivePermissions(user: User): string[] {
    if (user.permissions.includes('super_admin')) return ['super_admin (all permissions)'];
    return user.permissions;
  }

  askToggle(user: User): void {
    this.pendingUser.set(user);
  }

  confirmToggle(): void {
    const user = this.pendingUser();
    if (!user) return;
    const next: UserStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.usersService.updateUser(user.id, { status: next }).subscribe({
      next: (updated) => {
        // PATCH response embeds roles but not their permissions; a status
        // toggle never changes them, so carry the prior row's over.
        const row = { ...this.toRow(updated), permissions: user.permissions };
        this.users.update((list) => list.map((u) => (u.id === row.id ? row : u)));
        this.selected.set(row);
        this.toast.success(
          next === 'SUSPENDED'
            ? `${user.firstName} ${user.lastName}'s account suspended.`
            : `${user.firstName} ${user.lastName}'s account activated.`,
        );
        this.pendingUser.set(null);
      },
      error: (err) => {
        this.toast.error(toErrorMessage(err, 'Could not update the account status.'));
        this.pendingUser.set(null);
        this.loadUsers();
      },
    });
  }
}
