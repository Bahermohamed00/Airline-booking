import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
 * Staff account creation by a Super Admin through POST /api/users:
 * real DB user, real role assignment, Argon2id hashing, sanitized responses,
 * and an audit trail that records role ids but never secrets.
 */
describe('Staff account creation (e2e)', () => {
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

    const usersRead = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'read' } },
      update: {},
      create: { resource: 'users', action: 'read' },
    });

    const role = async (
      name: string,
      isSuperAdmin: boolean,
      permissionIds: string[] = [],
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

    const superAdmin = await role('Super Admin', true);
    const administrator = await role('Administrator', false, [usersRead.id]);
    const support = await role('Support Staff', false, [usersRead.id]);

    roleIds = {
      'Super Admin': superAdmin.id,
      Administrator: administrator.id,
      'Support Staff': support.id,
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
      firstName: 'Staff',
      lastName: 'Actor',
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

  function createStaff(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  const validBody = () => ({
    email: 'new.staff@matrix.test',
    password: 'StaffPassword123!',
    firstName: 'New',
    lastName: 'Staffer',
    roleIds: [roleIds['Support Staff']!],
  });

  it('a Super Admin creates a real staff user persisted in PostgreSQL with the assigned role', async () => {
    const token = await loginAs('root@staff.test', 'Super Admin');

    const res = await createStaff(token, validBody()).expect(201);

    const dbUser = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'new.staff@matrix.test' },
      include: { userRoles: { include: { role: true } } },
    });
    expect(dbUser.id).toBe(res.body.id);
    expect(dbUser.status).toBe('ACTIVE');
    expect(dbUser.emailVerified).toBe(false);
    expect(dbUser.userRoles.map((ur) => ur.role.name)).toEqual([
      'Support Staff',
    ]);
  });

  it('stores an Argon2id hash and never exposes the password or hash anywhere', async () => {
    const token = await loginAs('root-hash@staff.test', 'Super Admin');

    const res = await createStaff(token, validBody()).expect(201);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('StaffPassword123!');

    const dbUser = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'new.staff@matrix.test' },
    });
    expect(dbUser.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(dbUser.passwordHash).not.toContain('StaffPassword123!');
  });

  it('the created staff member can log in immediately and /auth/me returns the real role', async () => {
    const token = await loginAs('root-login@staff.test', 'Super Admin');
    await createStaff(token, validBody()).expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'new.staff@matrix.test', password: 'StaffPassword123!' })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.roles).toContain('Support Staff');
    expect(me.body.permissions).toContain('users:read');
  });

  it('duplicate email returns 409 and creates nothing', async () => {
    const token = await loginAs('root-dup@staff.test', 'Super Admin');
    await createStaff(token, validBody()).expect(201);

    await createStaff(token, validBody()).expect(409);
    expect(
      await prismaTestClient.user.count({
        where: { email: 'new.staff@matrix.test' },
      }),
    ).toBe(1);
  });

  it('unknown role id returns 400 and creates nothing', async () => {
    const token = await loginAs('root-badrole@staff.test', 'Super Admin');

    await createStaff(token, {
      ...validBody(),
      roleIds: [randomUUID()],
    }).expect(400);
    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'new.staff@matrix.test' },
      }),
    ).toBeNull();
  });

  it('passwords shorter than 12 characters are rejected with 400', async () => {
    const token = await loginAs('root-short@staff.test', 'Super Admin');

    await createStaff(token, { ...validBody(), password: 'Short1!' }).expect(
      400,
    );
    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'new.staff@matrix.test' },
      }),
    ).toBeNull();
  });

  it('email is normalized to lowercase and names are trimmed', async () => {
    const token = await loginAs('root-norm@staff.test', 'Super Admin');

    const res = await createStaff(token, {
      ...validBody(),
      email: '  Mixed.Case@Matrix.TEST ',
      firstName: '  Padded  ',
      lastName: ' Name ',
    }).expect(201);

    expect(res.body.email).toBe('mixed.case@matrix.test');
    expect(res.body.firstName).toBe('Padded');
    expect(res.body.lastName).toBe('Name');
  });

  it('non-Super-Admins cannot create users through this endpoint', async () => {
    const adminToken = await loginAs(
      'admin-create@staff.test',
      'Administrator',
    );
    await createStaff(adminToken, validBody()).expect(403);

    const supportToken = await loginAs(
      'support-create@staff.test',
      'Support Staff',
    );
    await createStaff(supportToken, {
      ...validBody(),
      email: 'by-support@staff.test',
    }).expect(403);

    const customerToken = await loginAs('customer-create@staff.test');
    await createStaff(customerToken, {
      ...validBody(),
      email: 'by-customer@staff.test',
    }).expect(403);

    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'new.staff@matrix.test' },
      }),
    ).toBeNull();
    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'by-support@staff.test' },
      }),
    ).toBeNull();
    expect(
      await prismaTestClient.user.findUnique({
        where: { email: 'by-customer@staff.test' },
      }),
    ).toBeNull();
  });

  it('USER_CREATED audit records the assigned role ids but never secrets', async () => {
    const token = await loginAs('root-audit@staff.test', 'Super Admin');
    const res = await createStaff(token, validBody()).expect(201);

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'USER_CREATED', targetId: res.body.id },
    });
    const metadata = audit.metadata as { roleIds?: string[] };
    expect(metadata.roleIds).toEqual([roleIds['Support Staff']!]);

    const blob = JSON.stringify(audit);
    expect(blob).not.toContain('StaffPassword123!');
    expect(blob).not.toContain('passwordHash');
    expect(blob).not.toContain('$argon2id$');
    expect(blob).not.toContain('token');
  });

  it('a Super Admin may assign the Super Admin role; the invariant tests still guard removal', async () => {
    const token = await loginAs('root-sa@staff.test', 'Super Admin');

    const res = await createStaff(token, {
      ...validBody(),
      roleIds: [roleIds['Super Admin']!],
    }).expect(201);

    const dbUser = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: res.body.id },
      include: { userRoles: { include: { role: true } } },
    });
    expect(dbUser.userRoles.map((ur) => ur.role.name)).toContain('Super Admin');

    // The last-Super-Admin invariant now protects both active Super Admins equally:
    // deactivating the brand-new one is allowed while the creator remains,
    // but deactivating the creator afterwards (last one) must be blocked.
    await request(app.getHttpServer())
      .delete(`/api/users/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    const creator = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: 'root-sa@staff.test' },
    });
    await request(app.getHttpServer())
      .delete(`/api/users/${creator.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
