import { UserStatus, Role, Permission, User } from '@prisma/client';
import { prisma, hash } from './shared.js';

const PERMISSIONS: Array<Pick<Permission, 'resource' | 'action' | 'description'>> = [
  { resource: 'users', action: 'read', description: 'View user accounts' },
  { resource: 'users', action: 'create', description: 'Create user accounts' },
  { resource: 'users', action: 'update', description: 'Update user accounts' },
  { resource: 'users', action: 'delete', description: 'Deactivate user accounts' },
  { resource: 'staff', action: 'manage', description: 'Manage staff accounts' },
  { resource: 'roles', action: 'manage', description: 'Manage roles and permissions' },
  { resource: 'flights', action: 'read', description: 'View flights' },
  { resource: 'flights', action: 'manage', description: 'Create/update flights' },
  { resource: 'airports', action: 'manage', description: 'Manage airports' },
  { resource: 'aircraft', action: 'manage', description: 'Manage aircraft' },
  { resource: 'routes', action: 'manage', description: 'Manage routes' },
  { resource: 'bookings', action: 'read', description: 'View bookings' },
  { resource: 'bookings', action: 'manage', description: 'Manage bookings' },
  { resource: 'payments', action: 'read', description: 'View payments' },
  { resource: 'payments', action: 'refund', description: 'Process refunds' },
  { resource: 'baggage', action: 'manage', description: 'Manage baggage records' },
  { resource: 'checkin', action: 'manage', description: 'Manage check-in and boarding' },
  { resource: 'loyalty', action: 'manage', description: 'Manage loyalty accounts' },
  { resource: 'notifications', action: 'manage', description: 'Manage notifications' },
  { resource: 'reports', action: 'read', description: 'View and export reports' },
  { resource: 'audit', action: 'read', description: 'View audit logs' },
  { resource: 'dashboard', action: 'read', description: 'View operations dashboard' },
  { resource: 'settings', action: 'manage', description: 'Manage system settings' },
  { resource: 'offers', action: 'read', description: 'View offer catalog' },
  { resource: 'offers', action: 'manage', description: 'Manage offers' },
];

const ROLE_DEFS: Array<{
  name: string;
  description: string;
  permissions: Array<{ resource: string; action: string }>;
  isSuperAdmin?: boolean;
}> = [
  {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: [],
    isSuperAdmin: true,
  },
  {
    name: 'Administrator',
    description: 'Access to assigned administrative modules',
    permissions: [
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'update' },
      { resource: 'users', action: 'delete' },
      { resource: 'bookings', action: 'read' },
      { resource: 'bookings', action: 'manage' },
      { resource: 'reports', action: 'read' },
      { resource: 'audit', action: 'read' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Flight Manager',
    description: 'Manages flight operations',
    permissions: [
      { resource: 'flights', action: 'read' },
      { resource: 'flights', action: 'manage' },
      { resource: 'airports', action: 'manage' },
      { resource: 'aircraft', action: 'manage' },
      { resource: 'routes', action: 'manage' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Booking Manager',
    description: 'Manages reservations',
    permissions: [
      { resource: 'bookings', action: 'read' },
      { resource: 'bookings', action: 'manage' },
      { resource: 'users', action: 'read' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Finance Staff',
    description: 'Views payments and refunds',
    permissions: [
      { resource: 'payments', action: 'read' },
      { resource: 'payments', action: 'refund' },
      { resource: 'reports', action: 'read' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
  {
    name: 'Support Staff',
    description: 'Customer and booking support',
    permissions: [
      { resource: 'users', action: 'read' },
      { resource: 'bookings', action: 'read' },
      { resource: 'baggage', action: 'manage' },
      { resource: 'checkin', action: 'manage' },
      { resource: 'dashboard', action: 'read' },
    ],
  },
];

async function seedPermissions(): Promise<Permission[]> {
  const created: Permission[] = [];
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: {},
      create: p,
    });
    created.push(perm);
  }
  return created;
}

async function seedRoles(allPermissions: Permission[]): Promise<Role[]> {
  const created: Role[] = [];
  for (const def of ROLE_DEFS) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: {
        description: def.description,
        isSuperAdmin: def.isSuperAdmin ?? false,
      },
      create: {
        name: def.name,
        description: def.description,
        isSuperAdmin: def.isSuperAdmin ?? false,
      },
    });

    if (!def.isSuperAdmin) {
      for (const wanted of def.permissions) {
        const perm = allPermissions.find(
          (p) => p.resource === wanted.resource && p.action === wanted.action,
        );
        if (perm) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
            update: {},
            create: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }
    created.push(role);
  }
  return created;
}

async function seedUsers(superAdminRole: Role): Promise<{ admin: User; customer: User }> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@airline.local' },
    update: {},
    create: {
      email: 'admin@airline.local',
      passwordHash: await hash('Admin123!'),
      firstName: 'System',
      lastName: 'Administrator',
      emailVerified: true,
      status: UserStatus.ACTIVE,
      userRoles: {
        create: { roleId: superAdminRole.id },
      },
    },
  });

  const customerRole = await prisma.role.upsert({
    where: { name: 'Customer' },
    update: {},
    create: { name: 'Customer', description: 'Default customer role' },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: await hash('Customer123!'),
      firstName: 'Demo',
      lastName: 'Customer',
      emailVerified: true,
      status: UserStatus.ACTIVE,
      userRoles: {
        create: { roleId: customerRole.id },
      },
    },
  });

  return { admin, customer };
}

export interface IdentitySeedResult {
  permissions: Permission[];
  roles: Role[];
  admin: User;
  customer: User;
}

/** Identity & RBAC: permissions, roles, and the admin + demo customer users. */
export async function seedIdentity(): Promise<IdentitySeedResult> {
  const permissions = await seedPermissions();
  const roles = await seedRoles(permissions);
  const superAdminRole = roles.find((r) => r.name === 'Super Admin')!;
  const { admin, customer } = await seedUsers(superAdminRole);
  return { permissions, roles, admin, customer };
}
