import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/ui/toast.service';
import { USER_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { DEMO_CUSTOMER, STAFF_USERS } from '../../../core/mock/mock-data';
import type { User } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

@Component({
  selector: 'na-admin-users',
  standalone: true,
  imports: [RouterLink, NaBreadcrumbs, NaButton, NaBadge, NaDialog, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Users &amp; Passengers</h1>
        <p class="page__sub">Customer and staff accounts, their roles and security posture.</p>
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4, 5]" height="2.5rem" />
      } @else if (users().length === 0) {
        <na-empty-state icon="◔" title="No users" message="There are no accounts to display." />
      } @else {
        <div class="layout">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th><span class="na-visually-hidden">MFA enabled</span>MFA</th>
                </tr>
              </thead>
              <tbody>
                @for (user of users(); track user.id) {
                  <tr
                    tabindex="0"
                    [class.row--active]="selected()?.id === user.id"
                    (click)="select(user)"
                    (keydown.enter)="select(user)"
                  >
                    <td data-label="Name">{{ user.firstName }} {{ user.lastName }}</td>
                    <td data-label="Email">{{ user.email }}</td>
                    <td data-label="Roles">{{ user.roles.join(', ') }}</td>
                    <td data-label="Status">
                      <na-badge [tone]="statusLabel(USER_STATUS_MAP, user.status).tone">
                        {{ statusLabel(USER_STATUS_MAP, user.status).label }}
                      </na-badge>
                    </td>
                    <td data-label="MFA">
                      @if (user.mfaEnabled) {
                        <span class="mfa mfa--on" role="img" aria-label="MFA enabled" title="MFA enabled">✓</span>
                      } @else {
                        <span class="mfa" role="img" aria-label="MFA not enabled" title="MFA not enabled">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (selected(); as user) {
            <aside class="panel na-card" aria-label="User details">
              <header class="panel__head">
                <h2 class="panel__title">{{ user.firstName }} {{ user.lastName }}</h2>
                <button type="button" class="panel__close" aria-label="Close user details" (click)="selected.set(null)">×</button>
              </header>
              <p class="na-text-muted na-text-small">{{ user.email }}</p>
              <p class="na-text-small">
                {{ user.emailVerified ? 'Email verified' : 'Email not verified' }} ·
                {{ user.mfaEnabled ? 'MFA enabled' : 'MFA not enabled' }}
              </p>

              <h3 class="panel__section">Roles</h3>
              <div class="chips">
                @for (role of user.roles; track role) {
                  <na-badge [tone]="role === 'Super Admin' ? 'warning' : 'info'">{{ role }}</na-badge>
                }
              </div>

              <h3 class="panel__section">Permissions</h3>
              @if (effectivePermissions(user).length) {
                <div class="chips">
                  @for (perm of effectivePermissions(user); track perm) {
                    <span class="chip na-text-mono">{{ perm }}</span>
                  }
                </div>
              } @else {
                <p class="na-text-muted na-text-small">No staff permissions — customer account.</p>
              }

              <h3 class="panel__section">Activity</h3>
              <p class="na-text-small">
                <a [routerLink]="['/admin/bookings']">View booking history →</a>
              </p>

              <div class="panel__actions">
                @if (user.status === 'ACTIVE') {
                  <na-button variant="danger" size="sm" (clicked)="askToggle(user)">Suspend account</na-button>
                } @else {
                  <na-button variant="primary" size="sm" (clicked)="askToggle(user)">Activate account</na-button>
                }
              </div>
            </aside>
          }
        </div>
      }

      <na-dialog
        [open]="pendingUser() !== null"
        [title]="pendingUser()?.status === 'ACTIVE' ? 'Suspend account' : 'Activate account'"
        [confirmLabel]="pendingUser()?.status === 'ACTIVE' ? 'Suspend' : 'Activate'"
        [confirmDanger]="pendingUser()?.status === 'ACTIVE'"
        (confirmed)="confirmToggle()"
        (cancelled)="pendingUser.set(null)"
      >
        @if (pendingUser(); as user) {
          <p>
            {{ user.status === 'ACTIVE' ? 'Suspend' : 'Activate' }} the account of
            <strong>{{ user.firstName }} {{ user.lastName }}</strong> ({{ user.email }})?
          </p>
          <p class="na-text-muted na-text-small">
            {{ user.status === 'ACTIVE'
              ? 'A suspended user cannot sign in. Active sessions are revoked.'
              : 'The user will be able to sign in again immediately.' }}
          </p>
        }
      </na-dialog>
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .layout { display: grid; grid-template-columns: 1fr 340px; gap: var(--na-space-5); align-items: start; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    tbody tr { cursor: pointer; transition: background var(--na-motion-fast); }
    tbody tr:hover { background: var(--na-blue-100); }
    tbody tr:focus-visible { outline: 2px solid var(--na-blue-600); outline-offset: -2px; }
    .row--active { background: var(--na-blue-100); }
    .mfa--on { color: var(--na-success); font-weight: var(--na-font-bold); }
    .mfa { color: var(--na-ink-300); }
    .panel { padding: var(--na-space-5); position: sticky; top: var(--na-space-4); }
    .panel__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-2); }
    .panel__title { font-size: var(--na-text-xl); }
    .panel__close { background: none; border: none; font-size: 1.4rem; color: var(--na-ink-500); min-width: 44px; min-height: 44px; border-radius: var(--na-radius-md); }
    .panel__close:hover { background: var(--na-surface-sunken); color: var(--na-ink-900); }
    .panel__section { font-size: var(--na-text-base); margin: var(--na-space-4) 0 var(--na-space-2); }
    .panel__actions { margin-top: var(--na-space-5); border-top: 1px solid var(--na-border); padding-top: var(--na-space-4); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--na-space-2); }
    .chip {
      background: var(--na-surface-sunken); border: 1px solid var(--na-border);
      border-radius: var(--na-radius-full); padding: 0.15rem 0.55rem; font-size: var(--na-text-xs);
    }
    @media (max-width: 1023px) {
      .layout { grid-template-columns: 1fr; }
      .panel { position: static; }
    }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminUsersPage {
  private readonly toast = inject(ToastService);

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

  constructor() {
    setTimeout(() => {
      this.users.set([DEMO_CUSTOMER, ...STAFF_USERS].map((u) => ({ ...u, roles: [...u.roles], permissions: [...u.permissions] })));
      this.loading.set(false);
    }, 300);
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
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, status: next } : u)));
    this.selected.set({ ...user, status: next });
    this.toast.success(
      next === 'SUSPENDED'
        ? `${user.firstName} ${user.lastName}'s account suspended.`
        : `${user.firstName} ${user.lastName}'s account activated.`,
    );
    this.pendingUser.set(null);
  }
}
