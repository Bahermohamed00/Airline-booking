import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Audit verification for the admin user-management mutations (USER_UPDATED,
 * USER_DEACTIVATED). USER_CREATED and SUPER_ADMIN_INVARIANT_BLOCKED are covered
 * in users-create.e2e-spec.ts and rbac.e2e-spec.ts respectively.
 */
describe('User management audit (e2e)', () => {
  let app: INestApplication<App>;
  let supportRoleId: string;
  let adminToken: string;
  let adminId: string;

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

    const superAdminRole = await prismaTestClient.role.create({
      data: { name: 'Super Admin', isSuperAdmin: true },
    });
    const supportRole = await prismaTestClient.role.create({
      data: { name: 'Support Staff', isSuperAdmin: false },
    });
    supportRoleId = supportRole.id;

    await registerVerifiedUser(app, { email: 'root@audit.test', password: PASSWORD, firstName: 'Root', lastName: 'Admin' });
    const admin = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'root@audit.test' } });
    adminId = admin.id;
    await prismaTestClient.userRole.create({ data: { userId: admin.id, roleId: superAdminRole.id } });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'root@audit.test', password: PASSWORD })
      .expect(200);
    adminToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function createTarget(email = 'target@audit.test'): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Target', lastName: 'User' });
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
    return user.id;
  }

  it('PATCH /users/:id persists USER_UPDATED with actor, target, and changed fields', async () => {
    const targetId = await createTarget();

    await request(app.getHttpServer())
      .patch(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Renamed', phone: '+49 123 456' })
      .expect(200);

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'USER_UPDATED', targetId },
    });
    expect(audit.actorId).toBe(adminId);
    expect(audit.actorType).toBe('Staff');
    expect(audit.targetType).toBe('User');
    const metadata = audit.metadata as Record<string, unknown>;
    expect(metadata['changedFields']).toEqual(expect.arrayContaining(['firstName', 'phone']));

    // No credentials anywhere in the audit entry.
    const blob = JSON.stringify(audit.metadata);
    for (const forbidden of ['password', 'passwordHash', PASSWORD, 'tokenHash', 'mfaSecret']) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it('PATCH /users/:id role change records the new role ids', async () => {
    const targetId = await createTarget();

    await request(app.getHttpServer())
      .patch(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [supportRoleId] })
      .expect(200);

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'USER_UPDATED', targetId },
    });
    const metadata = audit.metadata as Record<string, unknown>;
    expect(metadata['changedFields']).toEqual(['roleIds']);
    expect(metadata['roleIds']).toEqual([supportRoleId]);
  });

  it('PATCH /users/:id status changes (suspend and reactivate) are each audited', async () => {
    const targetId = await createTarget();

    await request(app.getHttpServer())
      .patch(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    const audits = await prismaTestClient.auditLog.findMany({
      where: { action: 'USER_UPDATED', targetId },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits).toHaveLength(2);
    for (const audit of audits) {
      expect((audit.metadata as Record<string, unknown>)['changedFields']).toEqual(['status']);
    }
  });

  it('DELETE /users/:id persists USER_DEACTIVATED and deactivates the account', async () => {
    const targetId = await createTarget();

    await request(app.getHttpServer())
      .delete(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'USER_DEACTIVATED', targetId },
    });
    expect(audit.actorId).toBe(adminId);
    expect(audit.actorType).toBe('Staff');
    expect(audit.targetType).toBe('User');

    const target = await prismaTestClient.user.findUniqueOrThrow({ where: { id: targetId } });
    expect(target.status).toBe('DEACTIVATED');
  });

  it('writes no USER_UPDATED audit when the state change fails', async () => {
    const missingId = '00000000-0000-4000-8000-000000000000';

    await request(app.getHttpServer())
      .patch(`/api/users/${missingId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Ghost' })
      .expect(404);

    const count = await prismaTestClient.auditLog.count({ where: { action: 'USER_UPDATED' } });
    expect(count).toBe(0);
  });

  it('PATCH /users/:id rejects self-deactivation with no write and no audit', async () => {
    // Use a non-Super-Admin administrator so the self-guard (400) is what fires;
    // the last-Super-Admin invariant (409) covers the root self-deactivation case.
    const usersUpdate = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'update' } },
      update: {},
      create: { resource: 'users', action: 'update' },
    });
    const adminRole = await prismaTestClient.role.create({
      data: { name: 'Administrator', isSuperAdmin: false },
    });
    await prismaTestClient.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: usersUpdate.id },
    });
    await registerVerifiedUser(app, { email: 'admin2@audit.test', password: PASSWORD, firstName: 'Second', lastName: 'Admin' });
    const secondAdmin = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'admin2@audit.test' } });
    await prismaTestClient.userRole.create({ data: { userId: secondAdmin.id, roleId: adminRole.id } });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin2@audit.test', password: PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/users/${secondAdmin.id}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ status: 'DEACTIVATED' })
      .expect(400);

    const after = await prismaTestClient.user.findUniqueOrThrow({ where: { id: secondAdmin.id } });
    expect(after.status).toBe('ACTIVE');
    expect(await prismaTestClient.auditLog.count({ where: { action: 'USER_UPDATED' } })).toBe(0);
  });
});
