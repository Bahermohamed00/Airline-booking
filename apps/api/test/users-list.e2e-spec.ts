import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

/**
 * GET /api/users optional pagination: legacy bare array without page/limit,
 * flights-style envelope with them, deterministic ordering, same-where count,
 * and unchanged role-based redaction in both modes.
 */
describe('GET /api/users pagination (e2e)', () => {
  let app: INestApplication<App>;

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

    // Sortable email set: alice01..alice04 match the email filter, bob/carol do not.
    for (const email of ['alice01@page.test', 'alice02@page.test', 'alice03@page.test', 'alice04@page.test', 'bob@page.test', 'carol@page.test']) {
      await registerVerifiedUser(app, { email, password: 'Password123!', firstName: 'Page', lastName: 'User' });
    }
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function login(email: string, password = 'Password123!'): Promise<string> {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  /** Registers a staff member, assigns the named role with users:<action> grants, and returns their token. */
  async function grantStaffAccess(email: string, roleName: string, actions: string[]): Promise<string> {
    const role = await prismaTestClient.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    for (const action of actions) {
      const permission = await prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'users', action } },
        update: {},
        create: { resource: 'users', action },
      });
      await prismaTestClient.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    await registerVerifiedUser(app, { email, password: 'Password123!', firstName: 'Staff', lastName: 'Member' });
    const staff = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
    await prismaTestClient.userRole.create({ data: { userId: staff.id, roleId: role.id } });
    return login(email);
  }

  it('returns the legacy bare array when no page/limit is provided', async () => {
    const token = await grantStaffAccess('admin@list.test', 'Administrator', ['read']);

    const res = await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(7); // 6 page users + the admin
    expect(res.body[0]).toHaveProperty('email');
    expect(res.body[0]).toHaveProperty('userRoles');
  });

  it('returns the paginated envelope; page 2 has no overlap with page 1', async () => {
    const token = await grantStaffAccess('admin@list.test', 'Administrator', ['read']);

    const page1 = await request(app.getHttpServer()).get('/api/users?page=1&limit=3').set('Authorization', `Bearer ${token}`).expect(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 3, total: 7, totalPages: 3 });
    expect(page1.body.items).toHaveLength(3);
    expect(Array.isArray(page1.body)).toBe(false);

    const page2 = await request(app.getHttpServer()).get('/api/users?page=2&limit=3').set('Authorization', `Bearer ${token}`).expect(200);
    expect(page2.body.items).toHaveLength(3);

    const ids1 = page1.body.items.map((u: { id: string }) => u.id);
    const ids2 = page2.body.items.map((u: { id: string }) => u.id);
    expect(ids2.some((id: string) => ids1.includes(id))).toBe(false);

    // Deterministic ordering: email ascending across page boundaries.
    const emails = [...page1.body.items, ...page2.body.items].map((u: { email: string }) => u.email);
    const sorted = [...emails].sort();
    expect(emails).toEqual(sorted);

    // A lone limit defaults page to 1; a lone page defaults limit to 20.
    const onlyLimit = await request(app.getHttpServer()).get('/api/users?limit=2').set('Authorization', `Bearer ${token}`).expect(200);
    expect(onlyLimit.body.page).toBe(1);
    expect(onlyLimit.body.items).toHaveLength(2);
    const onlyPage = await request(app.getHttpServer()).get('/api/users?page=1').set('Authorization', `Bearer ${token}`).expect(200);
    expect(onlyPage.body.limit).toBe(20);
    expect(onlyPage.body.items).toHaveLength(7);

    // Past-the-end page → empty items, totals still reported.
    const empty = await request(app.getHttpServer()).get('/api/users?page=9&limit=5').set('Authorization', `Bearer ${token}`).expect(200);
    expect(empty.body).toMatchObject({ page: 9, limit: 5, total: 7, totalPages: 2 });
    expect(empty.body.items).toHaveLength(0);
  });

  it('combines the email filter with pagination: total counts only matches', async () => {
    const token = await grantStaffAccess('admin@list.test', 'Administrator', ['read']);

    const res = await request(app.getHttpServer()).get('/api/users?email=alice&page=1&limit=3').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.every((u: { email: string }) => u.email.includes('alice'))).toBe(true);

    const page2 = await request(app.getHttpServer()).get('/api/users?email=alice&page=2&limit=3').set('Authorization', `Bearer ${token}`).expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].email).toContain('alice');

    // The bare-array path keeps honoring the email filter unchanged.
    const legacy = await request(app.getHttpServer()).get('/api/users?email=alice').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(legacy.body)).toBe(true);
    expect(legacy.body).toHaveLength(4);
  });

  it('rejects invalid pagination values with 400 and caps limit at 100', async () => {
    const token = await grantStaffAccess('admin@list.test', 'Administrator', ['read']);

    await request(app.getHttpServer()).get('/api/users?page=0').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app.getHttpServer()).get('/api/users?page=abc').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app.getHttpServer()).get('/api/users?page=1.5').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app.getHttpServer()).get('/api/users?limit=0').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app.getHttpServer()).get('/api/users?limit=101').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app.getHttpServer()).get('/api/users?limit=-3').set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('returns 401 unauthenticated and 403 for a user without users:read', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
    await request(app.getHttpServer()).get('/api/users?page=1&limit=5').expect(401);

    const customerToken = await login('bob@page.test');
    await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${customerToken}`).expect(403);
    await request(app.getHttpServer()).get('/api/users?page=1&limit=5').set('Authorization', `Bearer ${customerToken}`).expect(403);
  });

  it('keeps role-based redaction in both bare-array and paginated modes', async () => {
    const supportToken = await grantStaffAccess('support@list.test', 'Support Staff', ['read']);
    const adminToken = await grantStaffAccess('admin@list.test', 'Administrator', ['read']);

    // Support Staff: contact details only, in both response modes.
    for (const url of ['/api/users?email=alice', '/api/users?email=alice&page=1&limit=2']) {
      const res = await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${supportToken}`).expect(200);
      const rows = Array.isArray(res.body) ? res.body : res.body.items;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows as Record<string, unknown>[]) {
        expect(row['phone']).toBeDefined();
        expect(row['streetAddress']).toBeUndefined();
        expect(row['dateOfBirth']).toBeUndefined();
      }
      expect(JSON.stringify(res.body)).not.toContain('nationalId');
    }

    // Administrator: full profile minus secrets, in both response modes.
    for (const url of ['/api/users?email=alice', '/api/users?email=alice&page=1&limit=2']) {
      const res = await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${adminToken}`).expect(200);
      const rows = Array.isArray(res.body) ? res.body : res.body.items;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows as Record<string, unknown>[]) {
        expect(row['streetAddress']).toBeDefined();
        expect(row['dateOfBirth']).toBeDefined();
      }
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('nationalId');
      expect(raw).not.toContain('passwordHash');
      expect(raw).not.toContain('mfaSecret');
    }
  });
});
