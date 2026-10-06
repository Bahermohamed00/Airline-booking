import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase, refreshCookieOf } from './test-utils.js';

const TEST_USER = {
  email: 'profile@test.com',
  password: 'Password123!',
  firstName: 'Pro',
  lastName: 'File',
  dateOfBirth: '1990-01-01',
};

describe('Profile & change password (e2e)', () => {
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
    await registerVerifiedUser(app, TEST_USER);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function login(email = TEST_USER.email, password = TEST_USER.password) {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res;
  }

  describe('GET /api/auth/me', () => {
    it('returns only safe user fields', async () => {
      const token = (await login()).body.accessToken as string;
      const res = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

      expect(Object.keys(res.body).sort()).toEqual([
        'email',
        'emailVerified',
        'firstName',
        'lastName',
        'mfaEnabled',
        'permissions',
        'roles',
        'userId',
      ]);
      const raw = JSON.stringify(res.body);
      for (const forbidden of ['passwordHash', 'mfaSecret', 'mfaBackupCodes', 'refreshToken', 'tokenHash', 'resetToken']) {
        expect(raw).not.toContain(forbidden);
      }
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('updates allowed profile fields', async () => {
      const token = (await login()).body.accessToken as string;
      const res = await request(app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Renamed', lastName: 'Person', phone: '+49 170 1234567' })
        .expect(200);

      expect(res.body.firstName).toBe('Renamed');
      expect(res.body.lastName).toBe('Person');
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
      expect(user.phone).toBe('+49 170 1234567');
    });

    it('rejects mass-assignment of protected fields (email, status, roles, emailVerified)', async () => {
      const token = (await login()).body.accessToken as string;

      for (const body of [
        { email: 'hijack@test.com' },
        { status: 'SUSPENDED' },
        { roleIds: ['some-role'] },
        { emailVerified: false },
        { isSuperAdmin: true },
      ]) {
        await request(app.getHttpServer()).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send(body).expect(400);
      }

      const after = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
      expect(after.status).toBe('ACTIVE');
      expect(after.emailVerified).toBe(true);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).patch('/api/auth/me').send({ firstName: 'X' }).expect(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    function changePassword(token: string, body: Record<string, unknown>) {
      return request(app.getHttpServer()).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);
    }

    it('changes the password with valid input: Argon2id stored, old password dead, new password works', async () => {
      const token = (await login()).body.accessToken as string;

      await changePassword(token, {
        currentPassword: TEST_USER.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(200);

      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
      expect(user.passwordHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
      expect(user.passwordHash).not.toContain('NewPassword123!');

      const oldLogin = await request(app.getHttpServer()).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
      expect(oldLogin.status).toBe(401);
      await login(TEST_USER.email, 'NewPassword123!');
    });

    it('rejects a wrong current password without changing anything', async () => {
      const token = (await login()).body.accessToken as string;

      await changePassword(token, {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(400);

      await login(); // original password still works
    });

    it('rejects a confirm-password mismatch', async () => {
      const token = (await login()).body.accessToken as string;
      await changePassword(token, {
        currentPassword: TEST_USER.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'Different123!',
      }).expect(400);
    });

    it('rejects reusing the current password as the new password', async () => {
      const token = (await login()).body.accessToken as string;
      await changePassword(token, {
        currentPassword: TEST_USER.password,
        newPassword: TEST_USER.password,
        confirmPassword: TEST_USER.password,
      }).expect(400);
    });

    it('enforces the 12-character policy on the new password', async () => {
      const token = (await login()).body.accessToken as string;
      await changePassword(token, {
        currentPassword: TEST_USER.password,
        newPassword: 'Short1!',
        confirmPassword: 'Short1!',
      }).expect(400);
    });

    it('requires authentication and ignores any client-supplied userId', async () => {
      await changePassword('not-a-token', {
        currentPassword: TEST_USER.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(401);

      const token = (await login()).body.accessToken as string;
      const other = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
      await changePassword(token, {
        userId: other.id, // whitelist: rejected as an unknown property
        currentPassword: TEST_USER.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(400);
    });

    it('keeps the current session but revokes all other sessions; unrelated users untouched', async () => {
      const first = await login();
      const second = await login();
      const token1 = first.body.accessToken as string;

      await registerVerifiedUser(app, { email: 'bystander@test.com', password: 'Bystander123!', firstName: 'By', lastName: 'Stander' });
      const bystanderLogin = await login('bystander@test.com', 'Bystander123!');

      await changePassword(token1, {
        currentPassword: TEST_USER.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(200);

      // Current session survives: access token works, refresh still rotates
      await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token1}`).expect(200);
      await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', refreshCookieOf(first)).expect(200);

      // The other session is fully dead
      await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${second.body.accessToken}`).expect(401);
      await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', refreshCookieOf(second)).expect(401);

      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
      const sessions = await prismaTestClient.session.findMany({ where: { userId: user.id } });
      expect(sessions.filter((s) => s.revokedAt !== null)).toHaveLength(1);
      expect(sessions.find((s) => s.revokedAt !== null)?.revokeReason).toBe('password_changed');

      // Unrelated user's session unaffected
      await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${bystanderLogin.body.accessToken}`).expect(200);
    });

    it('audits PASSWORD_CHANGED and failed attempts without ever storing credentials', async () => {
      const token = (await login()).body.accessToken as string;

      await changePassword(token, {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(400);
      await changePassword(token, {
        currentPassword: TEST_USER.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }).expect(200);

      const entries = await prismaTestClient.auditLog.findMany({
        where: { action: { in: ['PASSWORD_CHANGED', 'PASSWORD_CHANGE_FAILED'] } },
      });
      const actions = entries.map((e) => e.action);
      expect(actions).toContain('PASSWORD_CHANGED');
      expect(actions).toContain('PASSWORD_CHANGE_FAILED');

      const blob = JSON.stringify(entries);
      for (const secret of ['Password123!', 'NewPassword123!', 'WrongPassword123!', 'passwordHash']) {
        expect(blob).not.toContain(secret);
      }
    });
  });
});
