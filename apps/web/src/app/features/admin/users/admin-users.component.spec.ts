import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminUsersPage } from './admin-users.component';
import { UsersService, type ApiUser } from './users.service';
import { ToastService } from '../../../shared/ui/toast.service';

function apiUser(id: string, email: string, roleNames: string[], superAdmin = false): ApiUser {
  return {
    id,
    email,
    firstName: 'Test',
    lastName: id,
    phone: null,
    emailVerified: true,
    mfaEnabled: false,
    status: 'ACTIVE',
    userRoles: roleNames.map((name) => ({
      role: { id: `role-${name}`, name, isSuperAdmin: superAdmin, rolePermissions: [] },
    })),
  };
}

function mocks(users: ApiUser[]) {
  return {
    users: {
      listUsers: vi.fn().mockReturnValue(of(users)),
      updateUser: vi.fn(),
    },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminUsersPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminUsersPage],
    providers: [
      provideRouter([]),
      { provide: UsersService, useValue: m.users },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminUsersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('AdminUsersPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows customer accounts and excludes staff/admin roles', async () => {
    const m = mocks([
      apiUser('cust-1', 'anna@example.com', ['Customer']),
      apiUser('admin-1', 'root@example.com', ['Super Admin'], true),
      apiUser('staff-1', 'support@example.com', ['Support Staff']),
      apiUser('mixed-1', 'mixed@example.com', ['Customer', 'Booking Manager']),
      apiUser('norole-1', 'norole@example.com', []),
    ]);
    const fixture = await setup(m);
    const text = (fixture.nativeElement as HTMLElement).textContent!;

    expect(text).toContain('anna@example.com');
    expect(text).toContain('norole@example.com'); // no staff role → customer
    expect(text).not.toContain('root@example.com');
    expect(text).not.toContain('support@example.com');
    expect(text).not.toContain('mixed@example.com'); // any staff role → excluded
  });

  it('links booking history to the selected customer email', async () => {
    const m = mocks([apiUser('cust-1', 'anna@example.com', ['Customer'])]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();

    const link = el.querySelector<HTMLAnchorElement>('.panel a')!;
    expect(link.getAttribute('href')).toContain('/admin/bookings');
    expect(link.getAttribute('href')).toContain('email=anna@example.com');
  });

  it('shows the empty state when no customer accounts exist', async () => {
    const m = mocks([apiUser('admin-1', 'root@example.com', ['Super Admin'], true)]);
    const fixture = await setup(m);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No users');
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks([]);
    m.users.listUsers.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load users');

    m.users.listUsers.mockReturnValue(of([apiUser('cust-1', 'anna@example.com', ['Customer'])]));
    el.querySelector<HTMLElement>('.alert__retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('anna@example.com');
  });
});
