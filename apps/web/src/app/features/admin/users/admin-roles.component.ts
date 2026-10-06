import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import type { Role } from '../../../core/models/domain.model';
import { RolesService } from './roles.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';

@Component({
  selector: 'na-admin-roles',
  standalone: true,
  imports: [NaBreadcrumbs, NaBadge, NaAlert, NaSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-roles.component.html',
  styleUrl: './admin-roles.component.css',
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
