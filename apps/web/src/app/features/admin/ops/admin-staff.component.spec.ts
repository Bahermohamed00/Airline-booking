import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminStaffPage } from './admin-staff.component';
import { UsersService, type ApiUser } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Role } from '../../../core/models/domain.model';

const ROLES: Role[] = [
  { id: 'r-sa', name: 'Super Admin', description: null, isSuperAdmin: true, permissions: [] },
  { id: 'r-support', name: 'Support Staff', description: null, isSuperAdmin: false, permissions: ['users:read'] },
  { id: 'r-customer', name: 'Customer', description: null, isSuperAdmin: false, permissions: [] },
];

const API_USERS: ApiUser[] = [
  {
    id: 'u1', email: 'ops@staff.test', firstName: 'Op', lastName: 'One', phone: null,
    emailVerified: true, mfaEnabled: false, status: 'ACTIVE',
    userRoles: [{ role: { id: 'r-support', name: 'Support Staff', isSuperAdmin: false } }],
  },
  {
    id: 'u2', email: 'pure@customer.test', firstName: 'Pure', lastName: 'Customer', phone: null,
    emailVerified: true, mfaEnabled: false, status: 'ACTIVE',
    userRoles: [{ role: { id: 'r-customer', name: 'Customer', isSuperAdmin: false } }],
  },
];

interface Mocks {
  users: { createStaff: ReturnType<typeof vi.fn>; listUsers: ReturnType<typeof vi.fn> };
  roles: { listRoles: ReturnType<typeof vi.fn> };
  auth: { hasPermission: (p: string) => boolean };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function makeMocks(canManage = true): Mocks {
  return {
    users: { createStaff: vi.fn(), listUsers: vi.fn().mockReturnValue(of(API_USERS)) },
    roles: { listRoles: vi.fn().mockReturnValue(of(ROLES)) },
    auth: { hasPermission: () => canManage },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

async function setup(m: Mocks): Promise<ComponentFixture<AdminStaffPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminStaffPage],
    providers: [
      provideRouter([]),
      { provide: UsersService, useValue: m.users },
      { provide: RolesService, useValue: m.roles },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminStaffPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function fillValidForm(c: AdminStaffPage): void {
  c.form.setValue({
    firstName: 'New',
    lastName: 'Staff',
    email: 'new@staff.test',
    password: 'StaffPassword123!',
    confirmPassword: 'StaffPassword123!',
    roleId: 'r-support',
  });
}

async function openAndSubmit(fixture: ComponentFixture<AdminStaffPage>): Promise<void> {
  fixture.componentInstance.openDrawer();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('AdminStaffPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists staff from the API and hides pure customer accounts', async () => {
    const m = makeMocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.users.listUsers).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('ops@staff.test');
    expect(el.textContent).toContain('Support Staff');
    expect(el.textContent).not.toContain('pure@customer.test');
  });

  it('requires all fields before submitting', async () => {
    const m = makeMocks();
    const fixture = await setup(m);

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.form.invalid).toBe(true);
    expect(m.users.createStaff).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const m = makeMocks();
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);
    fixture.componentInstance.form.controls.password.setValue('Short1!');
    fixture.componentInstance.form.controls.confirmPassword.setValue('Short1!');

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.form.controls.password.hasError('minlength')).toBe(true);
    expect(m.users.createStaff).not.toHaveBeenCalled();
  });

  it('requires the confirm password to match', async () => {
    const m = makeMocks();
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);
    fixture.componentInstance.form.controls.confirmPassword.setValue('Different123!');

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.form.hasError('passwordsMatch')).toBe(true);
    expect(m.users.createStaff).not.toHaveBeenCalled();
  });

  it('loads the role catalog from the API and excludes Customer from the dropdown', async () => {
    const m = makeMocks();
    const fixture = await setup(m);
    fixture.componentInstance.openDrawer();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const options = [...el.querySelectorAll<HTMLOptionElement>('#staff-role option')];
    const labels = options.map((o) => o.textContent?.trim());

    expect(m.roles.listRoles).toHaveBeenCalled();
    expect(labels).toContain('Support Staff');
    expect(labels).not.toContain('Customer');
    // Option values are role UUIDs, not names
    const support = options.find((o) => o.textContent?.trim() === 'Support Staff')!;
    expect(support.value).toBe('r-support');
  });

  it('submits the role UUID (never the name) to POST /users', async () => {
    const m = makeMocks();
    m.users.createStaff.mockReturnValue(of(API_USERS[0]));
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);

    await openAndSubmit(fixture);

    expect(m.users.createStaff).toHaveBeenCalledTimes(1);
    const payload = m.users.createStaff.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload['roleIds']).toEqual(['r-support']);
    expect(payload['email']).toBe('new@staff.test');
    expect(payload['password']).toBe('StaffPassword123!');
    expect(JSON.stringify(payload)).not.toContain('Support Staff');
  });

  it('closes the drawer and refreshes the list from the backend after creation', async () => {
    const m = makeMocks();
    m.users.createStaff.mockReturnValue(of(API_USERS[0]));
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.drawerOpen()).toBe(false);
    expect(m.users.listUsers).toHaveBeenCalledTimes(2); // initial load + refresh
    expect(m.toast.success).toHaveBeenCalled();
  });

  it('shows a duplicate-email message on 409', async () => {
    const m = makeMocks();
    m.users.createStaff.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.formError()).toBe('An account with this email already exists.');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('An account with this email already exists.');
  });

  it('shows an authorization message on 403', async () => {
    const m = makeMocks();
    m.users.createStaff.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.formError()).toBe('Only a Super Admin can create staff accounts.');
  });

  it('clears the password fields after successful creation', async () => {
    const m = makeMocks();
    m.users.createStaff.mockReturnValue(of(API_USERS[0]));
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(fixture.componentInstance.form.controls.confirmPassword.value).toBe('');
  });

  it('blocks the page and skips API calls without the staff:manage permission', async () => {
    const m = makeMocks(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Access restricted');
    expect(m.users.listUsers).not.toHaveBeenCalled();
    expect(m.roles.listRoles).not.toHaveBeenCalled();
  });
});
