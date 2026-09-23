import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { USER_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import { STAFF_USERS, ROLES } from '../../../core/mock/mock-data';
import type { User } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

@Component({
  selector: 'na-admin-staff',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Staff</h1>
        <p class="page__sub">Manage staff accounts and their assigned roles.</p>
      </header>

      @if (!canManage()) {
        <na-empty-state
          icon="🔒"
          title="Access restricted"
          message="You need the staff:manage permission to administer staff accounts. Contact a Super Admin."
        />
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else {
        <div class="toolbar">
          <na-button variant="cta" (clicked)="drawerOpen.set(true)">Add staff</na-button>
        </div>

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
                  <td data-label="Role">
                    <label class="na-visually-hidden" [attr.for]="'role-' + user.id">Role for {{ user.firstName }} {{ user.lastName }}</label>
                    <select
                      class="na-select role-select"
                      [id]="'role-' + user.id"
                      [ngModel]="user.roles[0]"
                      (ngModelChange)="changeRole(user, $event)"
                    >
                      @for (role of staffRoles; track role) {
                        <option [value]="role">{{ role }}</option>
                      }
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (drawerOpen()) {
        <div class="backdrop" (click)="drawerOpen.set(false)" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Add staff member"
          tabindex="-1"
          (keydown.escape)="drawerOpen.set(false)"
        >
          <header class="drawer__head">
            <h2>Add staff member</h2>
            <button type="button" class="drawer__close" aria-label="Close" (click)="drawerOpen.set(false)">×</button>
          </header>
          <form (ngSubmit)="addStaff()">
            <div class="na-field">
              <label class="na-label" for="staff-first">First name</label>
              <input id="staff-first" class="na-input" required [ngModel]="firstName()" (ngModelChange)="firstName.set($event)" name="firstName" />
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-last">Last name</label>
              <input id="staff-last" class="na-input" required [ngModel]="lastName()" (ngModelChange)="lastName.set($event)" name="lastName" />
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-email">Email</label>
              <input id="staff-email" class="na-input" type="email" required [ngModel]="email()" (ngModelChange)="email.set($event)" name="email" />
              <p class="na-hint">An invitation email with MFA setup instructions will be sent.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="staff-role">Role</label>
              <select id="staff-role" class="na-select" [ngModel]="role()" (ngModelChange)="role.set($event)" name="role">
                @for (r of staffRoles; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
            </div>
            @if (formError()) {
              <p class="na-error" role="alert">{{ formError() }}</p>
            }
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="drawerOpen.set(false)">Cancel</na-button>
              <na-button variant="primary" type="submit">Create account</na-button>
            </div>
          </form>
        </aside>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .toolbar { display: flex; justify-content: flex-end; margin-bottom: var(--na-space-4); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    .role-select { min-width: 180px; min-height: 40px; }
    .backdrop { position: fixed; inset: 0; background: rgba(8, 17, 32, 0.5); z-index: 90; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 95;
      width: min(440px, 100vw); background: var(--na-surface-raised);
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
  private readonly toast = inject(ToastService);

  readonly USER_STATUS_MAP = USER_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly crumbs = [
    { label: 'Admin', link: '/admin/dashboard' },
    { label: 'Staff' },
  ];

  readonly staffRoles = ROLES.filter((r) => r.name !== 'Customer').map((r) => r.name);

  readonly canManage = computed(() => this.auth.hasPermission('staff:manage'));
  readonly loading = signal(true);
  readonly staff = signal<User[]>([]);

  readonly drawerOpen = signal(false);
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly email = signal('');
  readonly role = signal(this.staffRoles[0] ?? 'Support Staff');
  readonly formError = signal<string | null>(null);

  constructor() {
    setTimeout(() => {
      this.staff.set(STAFF_USERS.map((u) => ({ ...u, roles: [...u.roles], permissions: [...u.permissions] })));
      this.loading.set(false);
    }, 300);
  }

  changeRole(user: User, roleName: string): void {
    const role = ROLES.find((r) => r.name === roleName);
    this.staff.update((list) =>
      list.map((u) =>
        u.id === user.id ? { ...u, roles: [roleName], permissions: role?.permissions ?? [] } : u,
      ),
    );
    this.toast.success(`${user.firstName} ${user.lastName} is now ${roleName}.`);
  }

  addStaff(): void {
    const email = this.email().trim().toLowerCase();
    if (!this.firstName().trim() || !this.lastName().trim() || !email) {
      this.formError.set('All fields are required.');
      return;
    }
    if (this.staff().some((u) => u.email.toLowerCase() === email)) {
      this.formError.set('A staff account with this email already exists.');
      return;
    }
    const role = ROLES.find((r) => r.name === this.role());
    const user: User = {
      id: crypto.randomUUID(),
      email,
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      emailVerified: false,
      mfaEnabled: false,
      status: 'PENDING_VERIFICATION',
      roles: [this.role()],
      permissions: role?.permissions ?? [],
    };
    this.staff.update((list) => [...list, user]);
    this.toast.success(`Invitation sent to ${email} (${this.role()}).`);
    this.drawerOpen.set(false);
    this.firstName.set('');
    this.lastName.set('');
    this.email.set('');
    this.formError.set(null);
  }
}
