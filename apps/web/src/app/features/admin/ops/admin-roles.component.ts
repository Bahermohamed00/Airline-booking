import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import type { Role } from '../../../core/models/domain.model';
import { RolesService } from '../services/roles.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

@Component({
  selector: 'na-admin-roles',
  standalone: true,
  imports: [NaBreadcrumbs, NaBadge, NaAlert, NaSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Roles &amp; Permissions</h1>
        <p class="page__sub">What each staff role may do across the admin console.</p>
      </header>

      @if (error()) {
        <na-alert tone="danger" title="Could not load roles" retryable (retry)="load()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="6rem" />
      } @else {
        <na-alert tone="info" icon="⚿">
          The <strong>Super Admin</strong> role bypasses every permission check in the system and cannot be restricted.
        </na-alert>

        <div class="cards">
          @for (role of roles(); track role.id) {
            <article class="role-card na-card" [class.role-card--super]="role.isSuperAdmin">
              <header class="role-card__head">
                <h2 class="role-card__name">{{ role.name }}</h2>
                @if (role.isSuperAdmin) {
                  <na-badge tone="warning">Super Admin</na-badge>
                }
              </header>
              <p class="na-text-muted na-text-small">{{ role.description ?? 'No description' }}{{ role.userCount !== undefined ? ' · ' + role.userCount + ' assigned' : '' }}</p>
              <div class="chips">
                @for (perm of role.permissions; track perm) {
                  <span class="chip na-text-mono">{{ perm }}</span>
                }
              </div>
            </article>
          }
        </div>

        <h2 class="matrix__title">Role × permission matrix</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Permission</th>
                @for (role of roles(); track role.id) {
                  <th [class.col--super]="role.isSuperAdmin">{{ role.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (perm of allPermissions(); track perm) {
                <tr>
                  <td class="na-text-mono" data-label="Permission">{{ perm }}</td>
                  @for (role of roles(); track role.id) {
                    <td [attr.data-label]="role.name" class="matrix__cell">
                      @if (hasPermission(role, perm)) {
                        <span class="matrix__check" role="img" [attr.aria-label]="role.name + ' has ' + perm">✓</span>
                      } @else {
                        <span class="matrix__dash" aria-hidden="true">—</span>
                        <span class="na-visually-hidden">{{ role.name }} does not have {{ perm }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--na-space-4); margin: var(--na-space-5) 0 var(--na-space-8); }
    .role-card { padding: var(--na-space-5); }
    .role-card--super { border-color: var(--na-warning); background: var(--na-warning-bg); }
    .role-card--super .chip { background: var(--na-surface-raised); }
    .role-card__head { display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-2); margin-bottom: var(--na-space-2); }
    .role-card__name { font-size: var(--na-text-lg); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--na-space-2); margin-top: var(--na-space-3); }
    .chip { background: var(--na-surface-sunken); border: 1px solid var(--na-border); border-radius: var(--na-radius-full); padding: 0.15rem 0.55rem; font-size: var(--na-text-xs); }
    .matrix__title { font-size: var(--na-text-xl); margin-bottom: var(--na-space-4); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    .col--super { color: var(--na-warning); }
    .matrix__cell { text-align: center; }
    .matrix__check { color: var(--na-success); font-weight: var(--na-font-bold); }
    .matrix__dash { color: var(--na-ink-300); }
  `,
})
export class AdminRolesPage implements OnInit {
  private readonly rolesService = inject(RolesService);

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'Roles & Permissions' },
  ];

  readonly roles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly allPermissions = computed(() => {
    const set = new Set<string>();
    for (const role of this.roles()) {
      for (const perm of role.permissions) set.add(perm);
    }
    return [...set].sort();
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.rolesService.listRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  hasPermission(role: Role, permission: string): boolean {
    return role.isSuperAdmin || role.permissions.includes(permission);
  }
}
