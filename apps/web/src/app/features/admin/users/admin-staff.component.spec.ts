import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';
import { AdminStaffPage } from './admin-staff.component';
import { UsersService, type ApiUser } from './users.service';
import { RolesService } from './roles.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Role } from '../../../core/models/domain.model';

const ROLES: Role[] = [
  { id: 'r-sa', name: 'Super Admin', description: null, isSuperAdmin: true, permissions: [] },
  {
    id: 'r-support',
    name: 'Support Staff',
    description: null,
    isSuperAdmin: false,
    permissions: ['users:read'],
  },
  { id: 'r-customer', name: 'Customer', description: null, isSuperAdmin: false, permissions: [] },
];

const API_USERS: ApiUser[] = [
  {
    id: 'u1',
    email: 'ops@staff.test',
    firstName: 'Op',
    lastName: 'One',
    phone: null,
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    userRoles: [{ role: { id: 'r-support', name: 'Support Staff', isSuperAdmin: false } }],
  },
  {
    id: 'u2',
    email: 'pure@customer.test',
    firstName: 'Pure',
    lastName: 'Customer',
    phone: null,
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    userRoles: [{ role: { id: 'r-customer', name: 'Customer', isSuperAdmin: false } }],
  },
];

interface Mocks {
  users: {
    createStaff: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
  roles: { listRoles: ReturnType<typeof vi.fn> };
  auth: { hasPermission: (p: string) => boolean; user: () => { id: string } | null };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function makeMocks(canManage = true, selfId = 'self-admin'): Mocks {
  return {
    users: {
      createStaff: vi.fn(),
      listUsers: vi.fn().mockReturnValue(of(API_USERS)),
      updateUser: vi.fn(),
    },
    roles: { listRoles: vi.fn().mockReturnValue(of(ROLES)) },
    auth: { hasPermission: () => canManage, user: () => ({ id: selfId }) },
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
    phone: '',
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

/** Opens the drawer in edit mode for the first staff row and submits the form. */
async function openEditAndSubmit(fixture: ComponentFixture<AdminStaffPage>): Promise<void> {
  const row = fixture.componentInstance.staff()[0]!;
  fixture.componentInstance.openEdit(row);
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

    expect(fixture.componentInstance.formError()).toBe(
      'An account with this email already exists.',
    );
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('An account with this email already exists.');
  });

  it('shows an authorization message on 403', async () => {
    const m = makeMocks();
    m.users.createStaff.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    fillValidForm(fixture.componentInstance);

    await openAndSubmit(fixture);

    expect(fixture.componentInstance.formError()).toBe(
      'Only a Super Admin can create staff accounts.',
    );
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

  it('opens Edit with the staff member’s current data and no password fields', async () => {
    const m = makeMocks();
    const fixture = await setup(m);
    const row = fixture.componentInstance.staff()[0]!;

    fixture.componentInstance.openEdit(row);
    fixture.detectChanges();

    const form = fixture.componentInstance.form;
    expect(fixture.componentInstance.drawerOpen()).toBe(true);
    expect(form.controls.firstName.value).toBe('Op');
    expect(form.controls.lastName.value).toBe('One');
    expect(form.controls.email.value).toBe('ops@staff.test');
    expect(form.controls.phone.value).toBe('');
    expect(form.controls.roleId.value).toBe('r-support');
    expect(form.controls.password.disabled).toBe(true);
    expect(form.controls.confirmPassword.disabled).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#staff-password')).toBeNull();
    expect(el.querySelector('#staff-confirm')).toBeNull();
    expect(el.textContent).toContain('Edit staff member');
    expect(el.textContent).toContain('Save changes');
  });

  it('submits the staff id and editable fields (never a password) to PATCH /users/:id', async () => {
    const m = makeMocks();
    m.users.updateUser.mockReturnValue(of(API_USERS[0]));
    const fixture = await setup(m);

    await openEditAndSubmit(fixture);

    expect(m.users.updateUser).toHaveBeenCalledTimes(1);
    const [id, payload] = m.users.updateUser.mock.calls[0]! as [string, Record<string, unknown>];
    expect(id).toBe('u1');
    expect(payload).toEqual({
      firstName: 'Op',
      lastName: 'One',
      email: 'ops@staff.test',
      phone: null,
      roleIds: ['r-support'],
    });
    expect(JSON.stringify(payload)).not.toContain('password');
    expect(m.users.createStaff).not.toHaveBeenCalled();
  });

  it('closes the drawer, confirms, and refreshes the list after a successful update', async () => {
    const m = makeMocks();
    m.users.updateUser.mockReturnValue(of(API_USERS[0]));
    const fixture = await setup(m);

    await openEditAndSubmit(fixture);

    expect(fixture.componentInstance.drawerOpen()).toBe(false);
    expect(fixture.componentInstance.editing()).toBeNull();
    expect(m.toast.success).toHaveBeenCalled();
    expect(m.users.listUsers).toHaveBeenCalledTimes(2); // initial load + refresh
  });

  it('keeps the drawer open and shows the error when the update fails', async () => {
    const m = makeMocks();
    m.users.updateUser.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);

    await openEditAndSubmit(fixture);

    expect(fixture.componentInstance.drawerOpen()).toBe(true);
    expect(fixture.componentInstance.formError()).toBe(
      'An account with this email already exists.',
    );
    expect(m.users.listUsers).toHaveBeenCalledTimes(1); // no refresh on failure
  });

  it('prevents duplicate submissions while an update is in progress', async () => {
    const m = makeMocks();
    m.users.updateUser.mockReturnValue(new Observable(() => {})); // never completes
    const fixture = await setup(m);

    await openEditAndSubmit(fixture);
    expect(fixture.componentInstance.submitting()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(m.users.updateUser).toHaveBeenCalledTimes(1);
  });

  it('switches back to an empty create form with password fields re-enabled', async () => {
    const m = makeMocks();
    const fixture = await setup(m);
    const row = fixture.componentInstance.staff()[0]!;

    fixture.componentInstance.openEdit(row);
    fixture.detectChanges();
    fixture.componentInstance.closeDrawer();
    fixture.componentInstance.openDrawer();
    fixture.detectChanges();

    const form = fixture.componentInstance.form;
    expect(fixture.componentInstance.editing()).toBeNull();
    expect(form.controls.password.enabled).toBe(true);
    expect(form.controls.confirmPassword.enabled).toBe(true);
    expect(form.controls.firstName.value).toBe('');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Add staff member');
  });

  it('deactivates a staff account after confirmation, preserving roles', async () => {
    const m = makeMocks();
    m.users.updateUser.mockReturnValue(of({ ...API_USERS[0]!, status: 'DEACTIVATED' as const }));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const deactivate = [...el.querySelectorAll<HTMLElement>('td[data-label="Actions"] na-button button')].find(
      (b) => b.textContent?.trim() === 'Deactivate',
    )!;
    deactivate.click();
    fixture.detectChanges();

    // Confirmation dialog states exactly what happens.
    expect(el.textContent).toContain('Deactivate the staff account of');
    expect(el.textContent).toContain('ops@staff.test');
    const confirm = [...el.querySelectorAll<HTMLElement>('.dialog__actions na-button button')].find(
      (b) => b.textContent?.trim() === 'Deactivate',
    )!;
    confirm.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.users.updateUser).toHaveBeenCalledWith('u1', { status: 'DEACTIVATED' });
    expect(m.toast.success).toHaveBeenCalled();
    // Row updated in place, role intact.
    expect(el.textContent).toContain('Deactivated');
    expect(el.textContent).toContain('Support Staff');
  });

  it('reactivates a deactivated staff account after confirmation', async () => {
    const m = makeMocks();
    m.users.listUsers.mockReturnValue(of([{ ...API_USERS[0]!, status: 'DEACTIVATED' as const }]));
    m.users.updateUser.mockReturnValue(of(API_USERS[0]!));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    // Precondition: the row shows the deactivated badge.
    const statusCell = () => el.querySelector<HTMLElement>('tbody tr td[data-label="Status"]')!;
    expect(statusCell().textContent?.trim()).toBe('Deactivated');

    const reactivate = [...el.querySelectorAll<HTMLElement>('td[data-label="Actions"] na-button button')].find(
      (b) => b.textContent?.trim() === 'Reactivate',
    )!;
    reactivate.click();
    fixture.detectChanges();
    const confirm = [...el.querySelectorAll<HTMLElement>('.dialog__actions na-button button')].find(
      (b) => b.textContent?.trim() === 'Reactivate',
    )!;
    confirm.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.users.updateUser).toHaveBeenCalledWith('u1', { status: 'ACTIVE' });
    // The same row's badge — not just any 'Active' text on the page.
    expect(statusCell().textContent?.trim()).toBe('Active');
    expect(statusCell().textContent).not.toContain('Deactivated');
  });

  it('never offers the status action on your own account row', async () => {
    const m = makeMocks(true, 'u1'); // the signed-in admin IS the listed staff member
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const actions = [...el.querySelectorAll<HTMLElement>('td[data-label="Actions"] na-button button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(actions).toContain('Edit');
    expect(actions).not.toContain('Deactivate');
    expect(actions).not.toContain('Reactivate');
  });

  it('shows an error toast and closes the dialog when the status change fails', async () => {
    const m = makeMocks();
    m.users.updateUser.mockReturnValue(throwError(() => ({ status: 403 })));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    [...el.querySelectorAll<HTMLElement>('td[data-label="Actions"] na-button button')]
      .find((b) => b.textContent?.trim() === 'Deactivate')!
      .click();
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLElement>('.dialog__actions na-button button')]
      .find((b) => b.textContent?.trim() === 'Deactivate')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.toast.error).toHaveBeenCalled();
    expect(fixture.componentInstance.pendingStatusUser()).toBeNull();
    expect(fixture.componentInstance.statusSaving()).toBe(false);
  });
});
