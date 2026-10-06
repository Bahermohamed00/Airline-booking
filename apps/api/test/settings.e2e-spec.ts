import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';

describe('System settings API (e2e)', () => {
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

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const superAdmin = await prismaTestClient.role.upsert({
      where: { name: 'Super Admin' },
      update: { isSuperAdmin: true },
      create: { name: 'Super Admin', isSuperAdmin: true },
    });
    const flightManager = await prismaTestClient.role.upsert({
      where: { name: 'Flight Manager' },
      update: { isSuperAdmin: false },
      create: { name: 'Flight Manager', isSuperAdmin: false },
    });
    roleIds = {
      'Super Admin': superAdmin.id,
      'Flight Manager': flightManager.id,
    };

    await prismaTestClient.systemSetting.createMany({
      data: [
        {
          key: 'seat_hold_minutes',
          value: '15',
          category: 'Booking',
          isPublic: true,
        },
        {
          key: 'default_currency',
          value: 'EUR',
          category: 'Pricing',
          isPublic: true,
        },
      ],
    });
  });

  async function loginAs(email: string, roleName?: string): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Settings',
      lastName: 'Tester',
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

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/settings');
    expect(res.status).toBe(401);
  });

  it('rejects staff without settings:manage with 403', async () => {
    const token = await loginAs('fm@settings.test', 'Flight Manager');
    const res = await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists settings for a Super Admin, ordered by key', async () => {
    const token = await loginAs('admin@settings.test', 'Super Admin');
    const res = await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((s: { key: string }) => s.key)).toEqual([
      'default_currency',
      'seat_hold_minutes',
    ]);
  });

  it('updates a value, persists it, and writes a SETTING_UPDATED audit row', async () => {
    const token = await loginAs('admin@settings.test', 'Super Admin');

    const patch = await request(app.getHttpServer())
      .patch('/api/settings/seat_hold_minutes')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '20' });
    expect(patch.status).toBe(200);
    expect(patch.body.value).toBe('20');

    const stored = await prismaTestClient.systemSetting.findUniqueOrThrow({
      where: { key: 'seat_hold_minutes' },
    });
    expect(stored.value).toBe('20');

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'SETTING_UPDATED' },
    });
    expect(audit.actorType).toBe('Staff');
    expect(audit.metadata).toMatchObject({
      key: 'seat_hold_minutes',
      oldValue: '15',
      newValue: '20',
    });
  });

  it('returns 404 for an unknown key', async () => {
    const token = await loginAs('admin@settings.test', 'Super Admin');
    const res = await request(app.getHttpServer())
      .patch('/api/settings/no_such_key')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an empty value', async () => {
    const token = await loginAs('admin@settings.test', 'Super Admin');
    const res = await request(app.getHttpServer())
      .patch('/api/settings/seat_hold_minutes')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '' });
    expect(res.status).toBe(400);
  });
});
