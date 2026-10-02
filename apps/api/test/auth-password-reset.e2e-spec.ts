import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashToken } from '../src/auth/token-crypto.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase, refreshCookieOf } from './test-utils.js';

describe('Password reset (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function seedUser(email: string, password: string) {
    await registerVerifiedUser(app, { email, password, firstName: 'Test', lastName: 'User' });
    return prismaTestClient.user.findUniqueOrThrow({ where: { email } });
  }

  async function plantResetToken(userId: string, rawToken: string, expiresInMs = 3_600_000) {
    await prismaTestClient.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + expiresInMs) },
    });
  }

  it('resets the password of the user owning the token, even when other users have outstanding tokens', async () => {
    const alice = await seedUser('alice@test.com', 'OldPassword123!');
    const bob = await seedUser('bob@test.com', 'BobPassword123!');
    await plantResetToken(alice.id, 'alice-token');
    await plantResetToken(bob.id, 'bob-token');

    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'bob-token', newPassword: 'NewPassword123!' })
      .expect(200);

    // Bob: old password dead, new password works
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'bob@test.com', password: 'BobPassword123!' }).expect(401);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'bob@test.com', password: 'NewPassword123!' }).expect(200);
    // Alice's account is untouched by Bob's reset
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'alice@test.com', password: 'OldPassword123!' }).expect(200);
  });

  it('marks the token used — a second attempt with the same token fails', async () => {
    const user = await seedUser('reuse@test.com', 'OldPassword123!');
    await plantResetToken(user.id, 'one-time-token');

    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'one-time-token', newPassword: 'NewPassword123!' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'one-time-token', newPassword: 'AnotherPass123!' })
      .expect(400);
  });

  it('rejects unknown and expired tokens', async () => {
    const user = await seedUser('expired@test.com', 'OldPassword123!');
    await plantResetToken(user.id, 'expired-token', -1000);

    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'no-such-token', newPassword: 'NewPassword123!' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'expired-token', newPassword: 'NewPassword123!' })
      .expect(400);
  });

  it('requesting a new reset link invalidates previous unused tokens', async () => {
    const user = await seedUser('invalidate@test.com', 'OldPassword123!');
    await plantResetToken(user.id, 'old-link-token');

    await request(app.getHttpServer())
      .post('/api/auth/password-reset-request')
      .send({ email: 'invalidate@test.com' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'old-link-token', newPassword: 'NewPassword123!' })
      .expect(400);
  });

  it('answers existing and unknown emails identically, and normalizes the email', async () => {
    const user = await seedUser('norm@test.com', 'Password123!');

    const existing = await request(app.getHttpServer())
      .post('/api/auth/password-reset-request')
      .send({ email: '  Norm@Test.com  ' })
      .expect(200);
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/password-reset-request')
      .send({ email: 'ghost@test.com' })
      .expect(200);

    expect(unknown.body).toEqual(existing.body);
    expect(existing.body).toEqual({ message: 'If the email exists, a reset link has been sent' });
    // The token was created for the normalized address's owner
    expect(await prismaTestClient.passwordResetToken.count({ where: { userId: user.id, usedAt: null } })).toBe(1);
  });

  it('expires reset tokens per RESET_TOKEN_EXPIRES_IN (default: 1 hour)', async () => {
    const user = await seedUser('ttl@test.com', 'Password123!');
    const before = Date.now();

    await request(app.getHttpServer()).post('/api/auth/password-reset-request').send({ email: 'ttl@test.com' }).expect(200);

    const token = await prismaTestClient.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    const ttlMs = token.expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(3_500_000);
    expect(ttlMs).toBeLessThanOrEqual(3_700_000);
  });

  it('enforces the 12-character password policy without consuming the token', async () => {
    const user = await seedUser('policy@test.com', 'Password123!');
    await plantResetToken(user.id, 'policy-token');

    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'policy-token', newPassword: 'Pass123!' }) // 8 chars: passes the old reset DTO, fails the 12-char policy
      .expect(400);

    const row = await prismaTestClient.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.usedAt).toBeNull();
  });

  it('revokes all sessions on successful reset — other users are untouched', async () => {
    const user = await seedUser('revoke-reset@test.com', 'OldPassword123!');
    const login1 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'revoke-reset@test.com', password: 'OldPassword123!' })
      .expect(200);
    const login2 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'revoke-reset@test.com', password: 'OldPassword123!' })
      .expect(200);
    await seedUser('other-reset@test.com', 'OtherPassword123!');
    const otherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'other-reset@test.com', password: 'OtherPassword123!' })
      .expect(200);

    await plantResetToken(user.id, 'revoke-token');
    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'revoke-token', newPassword: 'NewPassword123!' })
      .expect(200);

    // Both sessions of the reset user are dead — access tokens and refresh cookies
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${login1.body.accessToken}`).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${login2.body.accessToken}`).expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', refreshCookieOf(login1)).expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', refreshCookieOf(login2)).expect(401);

    const sessions = await prismaTestClient.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.revokedAt !== null && s.revokeReason === 'password_reset')).toBe(true);

    // The unrelated user's session is untouched
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${otherLogin.body.accessToken}`).expect(200);

    // And the new password works
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'revoke-reset@test.com', password: 'NewPassword123!' })
      .expect(200);
  });

  it('audits request, failure, and completion without ever storing the raw token', async () => {
    const user = await seedUser('audit-reset@test.com', 'Password123!');

    await request(app.getHttpServer()).post('/api/auth/password-reset-request').send({ email: 'audit-reset@test.com' }).expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'wrong-token', newPassword: 'NewPassword123!' })
      .expect(400);

    await plantResetToken(user.id, 'audit-raw-token');
    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'audit-raw-token', newPassword: 'NewPassword123!' })
      .expect(200);

    const entries = await prismaTestClient.auditLog.findMany({
      where: { action: { startsWith: 'PASSWORD_RESET' } },
      orderBy: { createdAt: 'asc' },
    });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('PASSWORD_RESET_REQUESTED');
    expect(actions).toContain('PASSWORD_RESET_FAILED');
    expect(actions).toContain('PASSWORD_RESET_COMPLETED');

    const blob = JSON.stringify(entries);
    expect(blob).not.toContain('audit-raw-token');
    expect(blob).not.toContain('NewPassword123!');
    expect(blob).not.toContain('wrong-token');
  });

  it('stores the new password only as an Argon2id hash', async () => {
    const user = await seedUser('hashcheck@test.com', 'OldPassword123!');
    await plantResetToken(user.id, 'hash-token');

    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'hash-token', newPassword: 'NewPassword123!' })
      .expect(200);

    const after = await prismaTestClient.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(after.passwordHash).not.toContain('NewPassword123!');
  });
});
