import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from './test-utils.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { randomUUID } from 'crypto';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * RBAC matrix per SRS section 6: every seeded role x the /api/users endpoints,
 * verified through HTTP with real guards, real DB-resolved permissions.
 */
describe('RBAC guards & role matrix (e2e)', () => {
  let app: INestApplication<App>;
  let roleIds: Record<string, string>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const perm = async (resource: string, action: string) =>
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
    const [usersRead, usersCreate, usersUpdate, usersDelete] =
      await Promise.all([
        perm('users', 'read'),
        perm('users', 'create'),
        perm('users', 'update'),
        perm('users', 'delete'),
      ]);

    const role = async (
      name: string,
      isSuperAdmin: boolean,
      permissionIds: string[],
    ) => {
      const r = await prismaTestClient.role.upsert({
        where: { name },
        update: { isSuperAdmin },
        create: { name, isSuperAdmin },
      });
      for (const permissionId of permissionIds) {
        await prismaTestClient.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: r.id, permissionId } },
          update: {},
          create: { roleId: r.id, permissionId },
        });
      }
      return r;
    };

    const superAdmin = await role('Super Admin', true, []);
    const administrator = await role(
      'Administrator',
      false,
      [usersRead, usersCreate, usersUpdate, usersDelete].map((p) => p.id),
    );
    const support = await role('Support Staff', false, [usersRead.id]);
    const flightManager = await role('Flight Manager', false, []);

    roleIds = {
      'Super Admin': superAdmin.id,
      Administrator: administrator.id,
      'Support Staff': support.id,
      'Flight Manager': flightManager.id,
    };
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function loginAs(email: string, roleName?: string): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Role',
      lastName: 'Test',
    });
    if (roleName) {
      const user = await prismaTestClient.user.findUniqueOrThrow({
        where: { email },
      });
      await prismaTestClient.userRole.create({
        data: { userId: user.id, roleId: roleIds[roleName]! },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  it('401 without a token, 403 for a Customer without staff role', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);

    const customerToken = await loginAs('customer@matrix.test');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('Super Admin reaches every /users endpoint', async () => {
    const token = await loginAs('root@matrix.test', 'Super Admin');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'made@matrix.test',
        password: 'Password123!',
        firstName: 'Made',
        lastName: 'User',
        roleIds: [roleIds['Support Staff']!],
      })
      .expect(201);
    const target = created.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/users/${target}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Renamed' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/users/${target}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('Administrator can read users but cannot create them (staff creation is Super Admin only)', async () => {
    const token = await loginAs('admin@matrix.test', 'Administrator');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'staffer@matrix.test',
        password: 'Password123!',
        firstName: 'Staff',
        lastName: 'Er',
      })
      .expect(403);
    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'staffer@matrix.test' },
      }),
    ).toBeNull();
  });

  it('Support Staff can read users but not create them', async () => {
    const token = await loginAs('support@matrix.test', 'Support Staff');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nope@matrix.test',
        password: 'Password123!',
        firstName: 'No',
        lastName: 'Pe',
      })
      .expect(403);
  });

  it('Flight Manager has no access to user management at all', async () => {
    const token = await loginAs('flight@matrix.test', 'Flight Manager');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('removing a role revokes the access immediately (no re-login needed)', async () => {
    const token = await loginAs('support-revoke@matrix.test', 'Support Staff');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'support-revoke@matrix.test' },
    });
    await prismaTestClient.userRole.deleteMany({ where: { userId: user.id } });

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('removing a permission from a role revokes the access immediately', async () => {
    const token = await loginAs('support-perm@matrix.test', 'Support Staff');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await prismaTestClient.rolePermission.deleteMany({
      where: {
        roleId: roleIds['Support Staff']!,
        permission: { resource: 'users', action: 'read' },
      },
    });

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('a customer cannot escalate their own roles through the users endpoint', async () => {
    const customerToken = await loginAs('escalate@matrix.test');
    const me = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'escalate@matrix.test' },
    });

    await request(app.getHttpServer())
      .patch(`/api/users/${me.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ roleIds: [roleIds['Super Admin']!] })
      .expect(403);

    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: me.id },
      include: { userRoles: { include: { role: true } } },
    });
    expect(after.userRoles.map((ur) => ur.role.name)).not.toContain(
      'Super Admin',
    ); // still just Customer
  });

  it('an Administrator cannot assign the Super Admin role (privilege-escalation guard)', async () => {
    const adminToken = await loginAs('admin-esc@matrix.test', 'Administrator');
    const target = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'admin-esc@matrix.test' },
    });

    await request(app.getHttpServer())
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [roleIds['Super Admin']!] })
      .expect(403);

    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: target.id },
      include: { userRoles: { include: { role: true } } },
    });
    expect(after.userRoles.map((ur) => ur.role.name)).not.toContain(
      'Super Admin',
    );
  });

  it('a Super Admin can assign the Super Admin role', async () => {
    await registerVerifiedUser(app, {
      email: 'target-esc@matrix.test',
      password: PASSWORD,
      firstName: 'Target',
      lastName: 'User',
    });
    const target = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'target-esc@matrix.test' },
    });
    const rootToken = await loginAs('root-esc@matrix.test', 'Super Admin');

    await request(app.getHttpServer())
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ roleIds: [roleIds['Super Admin']!] })
      .expect(200);
  });

  it('rejects unknown role ids with 400 instead of leaking a 500', async () => {
    const adminToken = await loginAs(
      'admin-badids@matrix.test',
      'Administrator',
    );
    const target = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'admin-badids@matrix.test' },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [randomUUID()] });
    expect(res.status).toBe(400);
  });

  it('GET /api/roles: 401 unauthenticated, 403 without roles:manage, 200 with role+permission data for Super Admin', async () => {
    await request(app.getHttpServer()).get('/api/roles').expect(401);

    const customerToken = await loginAs('roles-customer@matrix.test');
    await request(app.getHttpServer())
      .get('/api/roles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    // Administrator has users:* but not roles:manage
    const adminToken = await loginAs(
      'roles-admin@matrix.test',
      'Administrator',
    );
    await request(app.getHttpServer())
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    const rootToken = await loginAs('roles-root@matrix.test', 'Super Admin');
    const res = await request(app.getHttpServer())
      .get('/api/roles')
      .set('Authorization', `Bearer ${rootToken}`)
      .expect(200);

    const roles = res.body as Array<{
      name: string;
      isSuperAdmin: boolean;
      permissions: string[];
      userCount: number;
    }>;
    const superAdmin = roles.find((r) => r.name === 'Super Admin')!;
    expect(superAdmin.isSuperAdmin).toBe(true);
    const support = roles.find((r) => r.name === 'Support Staff')!;
    expect(support.permissions).toContain('users:read');
    expect(typeof support.userCount).toBe('number');
    // No sensitive fields leak
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('@Public endpoints stay reachable without a token while protected ones reject', async () => {
    // Public: register validates input (400), never 401
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({});
    expect(res.status).toBe(400);

    // Protected: no token → 401
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('user endpoints never expose password hashes or MFA secrets', async () => {
    const token = await loginAs('shape@matrix.test', 'Super Admin');

    const list = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listRaw = JSON.stringify(list.body);
    expect(listRaw).not.toContain('passwordHash');
    expect(listRaw).not.toContain('mfaSecret');
    expect(listRaw).not.toContain('mfaBackupCodes');

    const target = (list.body as Array<{ id: string }>)[0]!;
    const one = await request(app.getHttpServer())
      .get(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(JSON.stringify(one.body)).not.toContain('passwordHash');

    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'safe@matrix.test',
        password: 'Password123!',
        firstName: 'Safe',
        lastName: 'Shape',
      })
      .expect(201);
    const createdRaw = JSON.stringify(created.body);
    expect(createdRaw).not.toContain('passwordHash');
    expect(createdRaw).not.toContain('Password123!');

    const updated = await request(app.getHttpServer())
      .patch(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Safer' })
      .expect(200);
    expect(JSON.stringify(updated.body)).not.toContain('passwordHash');
  });

  it('an Administrator cannot create a user holding the Super Admin role', async () => {
    const adminToken = await loginAs(
      'admin-create-esc@matrix.test',
      'Administrator',
    );

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'made-esc@matrix.test',
        password: 'Password123!',
        firstName: 'Made',
        lastName: 'Esc',
        roleIds: [roleIds['Super Admin']!],
      })
      .expect(403);

    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'made-esc@matrix.test' },
      }),
    ).toBeNull();
  });

  it('an Administrator cannot strip or deactivate a Super Admin', async () => {
    await registerVerifiedUser(app, {
      email: 'victim@matrix.test',
      password: PASSWORD,
      firstName: 'Vic',
      lastName: 'Tim',
    });
    const victim = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'victim@matrix.test' },
    });
    await prismaTestClient.userRole.create({
      data: { userId: victim.id, roleId: roleIds['Super Admin']! },
    });

    const adminToken = await loginAs(
      'admin-strip@matrix.test',
      'Administrator',
    );

    await request(app.getHttpServer())
      .patch(`/api/users/${victim.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [] })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/users/${victim.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: victim.id },
      include: { userRoles: { include: { role: true } } },
    });
    expect(after.userRoles.map((ur) => ur.role.name)).toContain('Super Admin');
    expect(after.status).not.toBe('DEACTIVATED');
  });

  it('a Super Admin can reassign and deactivate any account', async () => {
    await registerVerifiedUser(app, {
      email: 'target-root@matrix.test',
      password: PASSWORD,
      firstName: 'Tar',
      lastName: 'Get',
    });
    const target = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'target-root@matrix.test' },
    });
    await prismaTestClient.userRole.create({
      data: { userId: target.id, roleId: roleIds['Super Admin']! },
    });

    const rootToken = await loginAs('root-strip@matrix.test', 'Super Admin');

    await request(app.getHttpServer())
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ roleIds: [roleIds['Support Staff']!] })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .expect(204);
  });

  it('granting a role takes effect immediately, without re-login', async () => {
    const token = await loginAs('grant@matrix.test'); // Customer only
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'grant@matrix.test' },
    });
    await prismaTestClient.userRole.create({
      data: { userId: user.id, roleId: roleIds['Support Staff']! },
    });

    // Same access token, new authorization — roles/permissions are DB-resolved per request
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('permissions come only from the database — token claims for roles/permissions are ignored', async () => {
    const token = await loginAs('forged@matrix.test'); // Customer with no staff role
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'forged@matrix.test' },
    });
    const session = await prismaTestClient.session.findFirstOrThrow({
      where: { userId: user.id },
    });

    // A VALIDLY SIGNED token with injected privilege claims — worst-case "browser says I'm admin"
    const forged = await app.get(JwtService).signAsync({
      sub: user.id,
      email: user.email,
      sid: session.id,
      type: 'access',
      roles: ['Super Admin'],
      permissions: ['super_admin'],
    });

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${forged}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/roles')
      .set('Authorization', `Bearer ${forged}`)
      .expect(403);
  });

  it('duplicate role assignments are rejected by the database constraint', async () => {
    await registerVerifiedUser(app, {
      email: 'dup@matrix.test',
      password: PASSWORD,
      firstName: 'Dupe',
      lastName: 'Test',
    });
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'dup@matrix.test' },
    });

    await prismaTestClient.userRole.create({
      data: { userId: user.id, roleId: roleIds['Support Staff']! },
    });
    await expect(
      prismaTestClient.userRole.create({
        data: { userId: user.id, roleId: roleIds['Support Staff']! },
      }),
    ).rejects.toThrow(/Unique constraint failed/); // @@unique([userId, roleId])

    // And the effective grant is still singular
    const grants = await prismaTestClient.userRole.count({
      where: { userId: user.id, roleId: roleIds['Support Staff']! },
    });
    expect(grants).toBe(1);
  });

  it('403 responses do not reveal which role or permission was missing', async () => {
    const token = await loginAs('leak@matrix.test', 'Flight Manager');
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('users:read');
    expect(body).not.toContain('Super Admin');
    expect(body).not.toContain('Support Staff');
  });

  it('403 from the permissions guard does not reveal the missing permission either', async () => {
    const token = await loginAs('leak2@matrix.test', 'Support Staff');
    // Strip the role's permission: RolesGuard passes (role name matches), PermissionsGuard fails
    await prismaTestClient.rolePermission.deleteMany({
      where: {
        roleId: roleIds['Support Staff']!,
        permission: { resource: 'users', action: 'read' },
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(JSON.stringify(res.body)).not.toContain('users:read');
  });

  it('the last active Super Admin cannot be role-stripped, deactivated, or suspended — even by a Super Admin', async () => {
    const rootToken = await loginAs('root-last@matrix.test', 'Super Admin');
    const me = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'root-last@matrix.test' },
    });

    await request(app.getHttpServer())
      .patch(`/api/users/${me.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ roleIds: [] })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/users/${me.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/users/${me.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(409);

    // Untouched
    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: me.id },
      include: { userRoles: { include: { role: true } } },
    });
    expect(after.status).toBe('ACTIVE');
    expect(after.userRoles.map((ur) => ur.role.name)).toContain('Super Admin');

    // The blocked attempts are audited without sensitive data
    const audit = await prismaTestClient.auditLog.findFirst({
      where: { action: 'SUPER_ADMIN_INVARIANT_BLOCKED' },
    });
    expect(audit).not.toBeNull();
  });

  it('with two active Super Admins, removing one is allowed; removing the last is then blocked', async () => {
    await registerVerifiedUser(app, {
      email: 'second-sa@matrix.test',
      password: PASSWORD,
      firstName: 'Second',
      lastName: 'Admin',
    });
    const second = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'second-sa@matrix.test' },
    });
    await prismaTestClient.userRole.create({
      data: { userId: second.id, roleId: roleIds['Super Admin']! },
    });

    const rootToken = await loginAs('root-two-sa@matrix.test', 'Super Admin');
    const root = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'root-two-sa@matrix.test' },
    });

    // Two active Super Admins: stripping the second is fine (root remains)
    await request(app.getHttpServer())
      .patch(`/api/users/${second.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ roleIds: [] })
      .expect(200);

    // Now root is the last one — stripping is blocked
    await request(app.getHttpServer())
      .patch(`/api/users/${root.id}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ roleIds: [] })
      .expect(409);
  });

  it("an Administrator cannot change a Super Admin's status at all", async () => {
    await registerVerifiedUser(app, {
      email: 'target-sa@matrix.test',
      password: PASSWORD,
      firstName: 'Target',
      lastName: 'Admin',
    });
    const target = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'target-sa@matrix.test' },
    });
    await prismaTestClient.userRole.create({
      data: { userId: target.id, roleId: roleIds['Super Admin']! },
    });

    const adminToken = await loginAs(
      'admin-sa-status@matrix.test',
      'Administrator',
    );
    await request(app.getHttpServer())
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(403);

    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(after.status).toBe('ACTIVE');
  });

  it('two Super Admins cannot concurrently remove each other (row-lock serialization)', async () => {
    const aToken = await loginAs('sa-a@matrix.test', 'Super Admin');
    const bToken = await loginAs('sa-b@matrix.test', 'Super Admin');
    const a = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'sa-a@matrix.test' },
    });
    const b = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'sa-b@matrix.test' },
    });

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/users/${a.id}`)
        .set('Authorization', `Bearer ${bToken}`)
        .send({ roleIds: [] }),
      request(app.getHttpServer())
        .patch(`/api/users/${b.id}`)
        .set('Authorization', `Bearer ${aToken}`)
        .send({ roleIds: [] }),
    ]);

    // Exactly one succeeds; the other is rejected — either by the invariant
    // (409) or by the guard because its own Super Admin grant just vanished
    // (403). Both are fail-safe: one Super Admin must remain.
    const statuses = [resA.status, resB.status].sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    const remaining = await prismaTestClient.userRole.count({
      where: { role: { isSuperAdmin: true }, user: { status: 'ACTIVE' } },
    });
    expect(remaining).toBe(1);
  });
});
