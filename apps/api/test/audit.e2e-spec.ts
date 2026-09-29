import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

describe('Audit log API (e2e)', () => {
  let app: INestApplication<App>;
  let roleIds: Record<string, string>;
  let realActorId: string;

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

    const auditRead = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'audit', action: 'read' } },
      update: {},
      create: { resource: 'audit', action: 'read' },
    });

    const role = async (name: string, isSuperAdmin: boolean, permissionIds: string[]) => {
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
    const administrator = await role('Administrator', false, [auditRead.id]);
    const flightManager = await role('Flight Manager', false, []);
    const bookingManager = await role('Booking Manager', false, []);
    const financeStaff = await role('Finance Staff', false, []);
    const support = await role('Support Staff', false, []);
    const auditIntern = await role('Audit Intern', false, [auditRead.id]);

    roleIds = {
      'Super Admin': superAdmin.id,
      Administrator: administrator.id,
      'Flight Manager': flightManager.id,
      'Booking Manager': bookingManager.id,
      'Finance Staff': financeStaff.id,
      'Support Staff': support.id,
      'Audit Intern': auditIntern.id,
    };

    // 25 deterministic audit rows + 1 poisoned-metadata row
    // (actor_id has an FK to users — use one real actor plus nulls)
    await registerVerifiedUser(app, { email: 'actor@audit.test', password: PASSWORD, firstName: 'Real', lastName: 'Actor' });
    const realActor = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'actor@audit.test' } });
    realActorId = realActor.id;
    const rows = Array.from({ length: 25 }, (_, i) => ({
      actorId: i % 2 === 0 ? realActor.id : null,
      actorType: i % 3 === 0 ? 'User' : 'Staff',
      action: i % 2 === 0 ? 'PASSWORD_CHANGED' : 'TOKEN_REUSE_DETECTED',
      targetType: i % 2 === 0 ? 'User' : 'Session',
      targetId: `target-${String(i).padStart(2, '0')}`,
      ipAddress: `203.0.113.${i}`,
      metadata: { reason: `reason-${i}` },
      createdAt: new Date(Date.UTC(2026, 8, 10 + i, 12, 0, 0)),
    }));
    await prismaTestClient.auditLog.createMany({ data: rows });
    await prismaTestClient.auditLog.create({
      data: {
        actorType: 'Guest',
        action: 'PASSWORD_RESET_FAILED',
        targetType: 'PasswordResetToken',
        metadata: {
          password: 'fake-password',
          passwordHash: 'fake-hash',
          accessToken: 'fake-access',
          refreshToken: 'fake-refresh',
          mfaSecret: 'fake-mfa',
          mfaBackupCodes: 'fake-codes',
          apiKey: 'fake-key',
          smtpPassword: 'fake-smtp',
          databasePassword: 'fake-db',
          reason: 'invalid_or_expired',
        },
        createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, 0)),
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function loginAs(email: string, roleName?: string): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Audit', lastName: 'Tester' });
    if (roleName) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: roleIds[roleName]! } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  function getAudit(token: string | null, query = '') {
    const req = request(app.getHttpServer()).get(`/api/audit${query}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  describe('authorization (permission-driven)', () => {
    it('401 unauthenticated', async () => {
      await getAudit(null).expect(401);
    });

    it.each(['Customer', 'Flight Manager', 'Booking Manager', 'Finance Staff', 'Support Staff'])(
      '403 for %s (no audit:read in the catalog)',
      async (roleName) => {
        const email = `${roleName.replace(/\s+/g, '-').toLowerCase()}@audit.test`;
        const token = roleName === 'Customer' ? await loginAs(email) : await loginAs(email, roleName);
        await getAudit(token).expect(403);
      },
    );

    it('200 for Administrator (has audit:read) and Super Admin (bypass)', async () => {
      const adminToken = await loginAs('admin@audit.test', 'Administrator');
      await getAudit(adminToken).expect(200);
      const rootToken = await loginAs('root@audit.test', 'Super Admin');
      await getAudit(rootToken).expect(200);
    });

    it('200 for any role granted audit:read — the permission decides, not the name', async () => {
      const token = await loginAs('intern@audit.test', 'Audit Intern');
      await getAudit(token).expect(200);
    });
  });

  describe('pagination', () => {
    it('defaults to page 1 with 20 items and correct totals', async () => {
      const token = await loginAs('admin-pag@audit.test', 'Administrator');
      const dbTotal = await prismaTestClient.auditLog.count();

      const res = await getAudit(token).expect(200);
      expect(res.body.items).toHaveLength(20);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.total).toBe(dbTotal);
      expect(res.body.totalPages).toBe(Math.ceil(dbTotal / 20));
    });

    it('serves later pages and custom limits', async () => {
      const token = await loginAs('admin-pag2@audit.test', 'Administrator');
      const dbTotal = await prismaTestClient.auditLog.count();

      const res = await getAudit(token, '?page=2&limit=20').expect(200);
      expect(res.body.items).toHaveLength(dbTotal - 20);
      const limited = await getAudit(token, '?limit=5').expect(200);
      expect(limited.body.items).toHaveLength(5);
      expect(limited.body.totalPages).toBe(Math.ceil(dbTotal / 5));
    });

    it.each(['page=0', 'limit=0', 'limit=101', 'page=abc', 'limit=-3'])('rejects invalid pagination %s', async (q) => {
      const token = await loginAs('admin-badpage@audit.test', 'Administrator');
      await getAudit(token, `?${q}`).expect(400);
    });
  });

  describe('filters, sorting, search', () => {
    it('filters by event, actorType, targetId, and combinations', async () => {
      const token = await loginAs('admin-filter@audit.test', 'Administrator');

      const byEvent = await getAudit(token, '?event=PASSWORD_CHANGED').expect(200);
      const eventDbCount = await prismaTestClient.auditLog.count({ where: { action: 'PASSWORD_CHANGED' } });
      expect(byEvent.body.total).toBe(eventDbCount);
      expect((byEvent.body.items as Array<{ event: string }>).every((i) => i.event === 'PASSWORD_CHANGED')).toBe(true);

      const byActorType = await getAudit(token, '?actorType=Guest').expect(200);
      expect(byActorType.body.total).toBe(1);

      const byTarget = await getAudit(token, '?targetId=target-04').expect(200);
      expect(byTarget.body.total).toBe(1);

      const byActor = await getAudit(token, `?actorId=${realActorId}`).expect(200);
      const actorDbCount = await prismaTestClient.auditLog.count({ where: { actorId: realActorId } });
      expect(byActor.body.total).toBe(actorDbCount);
      expect((byActor.body.items as Array<{ actorId: string }>).every((i) => i.actorId === realActorId)).toBe(true);

      const combo = await getAudit(token, '?event=TOKEN_REUSE_DETECTED&actorType=Staff').expect(200);
      expect(combo.body.total).toBeGreaterThan(0);
      expect((combo.body.items as Array<{ event: string; actorType: string }>).every((i) => i.event === 'TOKEN_REUSE_DETECTED' && i.actorType === 'Staff')).toBe(true);
    });

    it('filters by date range and rejects invalid dates', async () => {
      const token = await loginAs('admin-dates@audit.test', 'Administrator');

      const ranged = await getAudit(token, '?from=2026-09-15T00:00:00Z&to=2026-09-20T23:59:59Z').expect(200);
      expect(ranged.body.total).toBe(6);

      await getAudit(token, '?from=not-a-date').expect(400);
      await getAudit(token, '?to=32/13/2026').expect(400);
    });

    it('rejects invalid actorId UUIDs and unknown actorType values', async () => {
      const token = await loginAs('admin-badids@audit.test', 'Administrator');
      await getAudit(token, '?actorId=not-a-uuid').expect(400);
      await getAudit(token, '?actorType=Superuser').expect(400);
    });

    it('sorts by event asc and createdAt asc/desc, defaulting to createdAt desc', async () => {
      const token = await loginAs('admin-sort@audit.test', 'Administrator');

      const defaultRes = await getAudit(token).expect(200);
      const defaultDates = (defaultRes.body.items as Array<{ createdAt: string }>).map((i) => i.createdAt);
      expect([...defaultDates].sort().reverse()).toEqual(defaultDates);

      const byEvent = await getAudit(token, '?sortBy=event&sortOrder=asc&limit=5').expect(200);
      const events = (byEvent.body.items as Array<{ event: string }>).map((i) => i.event);
      expect([...events].sort()).toEqual(events);

      const byDateAsc = await getAudit(token, '?sortBy=createdAt&sortOrder=asc&limit=5').expect(200);
      const datesAsc = (byDateAsc.body.items as Array<{ createdAt: string }>).map((i) => i.createdAt);
      expect([...datesAsc].sort()).toEqual(datesAsc);
    });

    it('rejects unsupported sort fields and directions', async () => {
      const token = await loginAs('admin-badsort@audit.test', 'Administrator');
      await getAudit(token, '?sortBy=metadata').expect(400);
      await getAudit(token, '?sortOrder=sideways').expect(400);
    });

    it('searches safe columns only — never metadata content', async () => {
      const token = await loginAs('admin-search@audit.test', 'Administrator');

      const byEventText = await getAudit(token, '?search=reuse').expect(200);
      expect(byEventText.body.total).toBe(12);

      const byIp = await getAudit(token, '?search=203.0.113.7').expect(200);
      expect(byIp.body.total).toBe(1);

      // 'invalid_or_expired' exists ONLY inside the poisoned row's metadata
      const noMetadata = await getAudit(token, '?search=invalid_or_expired').expect(200);
      expect(noMetadata.body.total).toBe(0);
    });

    it('rejects unexpected query parameters', async () => {
      const token = await loginAs('admin-extra@audit.test', 'Administrator');
      await getAudit(token, '?admin=true').expect(400);
    });
  });

  describe('response security', () => {
    it('returns the safe projection shape and strips sensitive metadata keys', async () => {
      const token = await loginAs('admin-safe@audit.test', 'Administrator');
      const res = await getAudit(token, '?actorType=Guest').expect(200);

      const item = (res.body.items as Array<Record<string, unknown>>)[0]!;
      expect(Object.keys(item).sort()).toEqual(['actorId', 'actorType', 'createdAt', 'event', 'id', 'ipAddress', 'metadata', 'targetId', 'targetType']);
      expect(item['metadata']).toEqual({ reason: 'invalid_or_expired' });

      const raw = JSON.stringify(res.body);
      for (const forbidden of ['fake-password', 'fake-hash', 'fake-access', 'fake-refresh', 'fake-mfa', 'fake-codes', 'fake-key', 'fake-smtp', 'fake-db', 'passwordHash', 'mfaSecret', 'refreshToken', 'accessToken']) {
        expect(raw).not.toContain(forbidden);
      }
    });
  });

  describe('immutability', () => {
    it('exposes no write paths on the audit resource', async () => {
      const token = await loginAs('admin-immutable@audit.test', 'Administrator');
      await request(app.getHttpServer()).post('/api/audit').set('Authorization', `Bearer ${token}`).send({}).expect(404);
      await request(app.getHttpServer()).patch(`/api/audit/${randomUUID()}`).set('Authorization', `Bearer ${token}`).send({}).expect(404);
      await request(app.getHttpServer()).delete(`/api/audit/${randomUUID()}`).set('Authorization', `Bearer ${token}`).expect(404);
    });
  });
});
