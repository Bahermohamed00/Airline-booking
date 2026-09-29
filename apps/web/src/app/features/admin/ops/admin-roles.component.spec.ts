import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminRolesPage } from './admin-roles.component';
import { RolesService } from '../../../core/services/roles.service';
import type { Role } from '../../../core/models/domain.model';

const ROLES: Role[] = [
  { id: 'r1', name: 'Super Admin', description: 'Full access', isSuperAdmin: true, permissions: [], userCount: 1 },
  { id: 'r2', name: 'Support Staff', description: 'Support', isSuperAdmin: false, permissions: ['bookings:read', 'users:read'], userCount: 4 },
];

async function setup(listRoles: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [AdminRolesPage],
    providers: [provideRouter([]), { provide: RolesService, useValue: { listRoles } }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminRolesPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('AdminRolesPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders roles with permissions from the API and marks the super admin', async () => {
    const listRoles = vi.fn().mockReturnValue(of(ROLES));
    const fixture = await setup(listRoles);
    const el = fixture.nativeElement as HTMLElement;

    expect(listRoles).toHaveBeenCalled();
    expect(el.textContent).toContain('Super Admin');
    expect(el.textContent).toContain('Support Staff');
    expect(el.textContent).toContain('users:read');
    expect(el.textContent).toContain('4 assigned');
    expect(el.querySelectorAll('.role-card')).toHaveLength(2);
    // Matrix marks super admin as having every permission
    expect(el.querySelectorAll('.matrix__check').length).toBeGreaterThan(0);
  });

  it('shows an error state and retries', async () => {
    const listRoles = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500, message: 'x' })))
      .mockReturnValue(of(ROLES));
    const fixture = await setup(listRoles);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.alert--danger')).not.toBeNull();

    el.querySelector<HTMLElement>('.alert__retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listRoles).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('.role-card')).toHaveLength(2);
  });
});
