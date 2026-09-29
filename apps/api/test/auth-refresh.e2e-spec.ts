import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from './test-utils.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashToken } from '../src/auth/utils/token-crypto.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
  refreshCookieOf,
  rawTokenOf,
  decodePayload,
  captureLogs,
} from './test-utils.js';

const TEST_USER = {
  email: 'refresh@test.com',
  password: 'Password123!',
  firstName: 'Refresh',
  lastName: 'Tester',
};

describe('Auth refresh flow (e2e)', () => {
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

  async function login(): Promise<request.Response> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(res.status).toBe(200);
    return res;
  }

  it('login sets an httpOnly SameSite=Strict refresh cookie and no refresh token in the body', async () => {
    const res = await login();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('refresh rotates the token: new access token, new cookie, old cookie rejected', async () => {
    const loginRes = await login();
    const firstCookie = refreshCookieOf(loginRes);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);

    expect(refreshRes.body.accessToken).toBeDefined();
    const secondCookie = refreshCookieOf(refreshRes);
    expect(secondCookie).not.toBe(firstCookie);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);
  });

  it('reuse of a rotated token revokes the whole session, including a fresh access token', async () => {
    const loginRes = await login();
    const firstCookie = refreshCookieOf(loginRes);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    const secondCookie = refreshCookieOf(refreshRes);
    const freshAccessToken = refreshRes.body.accessToken as string;

    // Attacker replays the stolen old token
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);

    // The legitimate follow-up token is now dead too (session revoked)
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie)
      .expect(401);

    // And even the freshly minted access token is rejected because its session is revoked
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshAccessToken}`)
      .expect(401);
  });

  it('refresh without a cookie or with a garbage cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=garbage')
      .expect(401);
  });

  it('rotation links the chain, stores only the new token hash, and keeps the same session', async () => {
    const loginRes = await login();
    const cookieA = refreshCookieOf(loginRes);
    const before = Date.now();

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieA)
      .expect(200);
    const cookieB = refreshCookieOf(refreshRes);
    expect(refreshRes.body.refreshToken).toBeUndefined(); // refresh tokens only ever travel via cookie

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const sessions = await prismaTestClient.session.findMany({
      where: { userId: user.id },
      include: { refreshTokens: true },
    });
    expect(sessions).toHaveLength(1); // refreshing must not create a new session/device
    const session = sessions[0]!;
    expect(session.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(session.refreshTokens).toHaveLength(2);

    const oldToken = session.refreshTokens.find((t) => t.rotatedAt !== null)!;
    const newToken = session.refreshTokens.find((t) => t.rotatedAt === null)!;
    expect(oldToken.replacedById).toBe(newToken.id);
    expect(newToken.tokenHash).toBe(hashToken(rawTokenOf(cookieB)));
    expect(newToken.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // The new access token keeps the same minimal claims and the same sid
    const payload = decodePayload(refreshRes.body.accessToken);
    expect(Object.keys(payload).sort()).toEqual([
      'email',
      'exp',
      'iat',
      'sid',
      'sub',
      'type',
    ]);
    expect(payload['type']).toBe('access');
    expect(payload['sid']).toBe(session.id);
    expect((payload['exp'] as number) - (payload['iat'] as number)).toBe(900); // .env JWT_EXPIRES_IN=15m
  });

  it('reuse detection audits TOKEN_REUSE_DETECTED without storing or leaking the raw token', async () => {
    const cookieA = refreshCookieOf(await login());

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieA)
      .expect(200);
    const cookieB = refreshCookieOf(refreshRes);

    // Replay the stolen original token
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieA)
      .expect(401);

    const session = await prismaTestClient.session.findFirstOrThrow();
    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'TOKEN_REUSE_DETECTED' },
    });
    expect(audit.targetType).toBe('Session');
    expect(audit.targetId).toBe(session.id);
    const auditBlob = JSON.stringify(audit.metadata) + (audit.targetId ?? '');
    expect(auditBlob).not.toContain(rawTokenOf(cookieA));
    expect(auditBlob).not.toContain(rawTokenOf(cookieB));
  });

  it("reuse revokes only that session family — the user's other session survives", async () => {
    const first = await login();
    const second = await login();
    const cookieA = refreshCookieOf(first);
    const cookieB = refreshCookieOf(second);

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieA)
      .expect(200);
    const cookieA2 = refreshCookieOf(rotated);

    // Replay the stolen original token of session A
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieA)
      .expect(401);

    // Session A's whole family is dead
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieA2)
      .expect(401);
    const sessionA = await prismaTestClient.session.findFirstOrThrow({
      where: {
        refreshTokens: { some: { tokenHash: hashToken(rawTokenOf(cookieA)) } },
      },
    });
    expect(sessionA.revokedAt).not.toBeNull();
    expect(sessionA.revokeReason).toBe('reuse_detected');

    // Session B (same user) is unaffected
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieB)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
  });

  it("one user's token reuse does not affect another user's session", async () => {
    await registerVerifiedUser(app, {
      email: 'other@test.com',
      password: 'Password123!',
      firstName: 'Other',
      lastName: 'User',
    });

    const mine = await login();
    const others = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'other@test.com', password: 'Password123!' })
      .expect(200);
    const otherCookie = refreshCookieOf(others);

    const myCookie = refreshCookieOf(mine);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', myCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', myCookie)
      .expect(401); // replay

    // The other user's session still refreshes and authenticates
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', otherCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${others.body.accessToken}`)
      .expect(200);
  });

  it('rejects an expired refresh token without revoking the session', async () => {
    const cookie = refreshCookieOf(await login());

    await prismaTestClient.refreshToken.update({
      where: { tokenHash: hashToken(rawTokenOf(cookie)) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);

    const session = await prismaTestClient.session.findFirstOrThrow();
    expect(session.revokedAt).toBeNull();
  });

  it('rejects refresh after logout-all', async () => {
    const first = await login();
    const second = await login();

    await request(app.getHttpServer())
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .set('Cookie', refreshCookieOf(first))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookieOf(first))
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookieOf(second))
      .expect(401);
  });

  it.each(['DEACTIVATED', 'SUSPENDED'] as const)(
    'rejects refresh when the user is %s',
    async (status) => {
      const cookie = refreshCookieOf(await login());

      await prismaTestClient.user.update({
        where: { email: TEST_USER.email },
        data: { status },
      });

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    },
  );

  it('never logs raw tokens during refresh or reuse handling', async () => {
    const loginRes = await login();
    const cookieA = refreshCookieOf(loginRes);
    const accessA = loginRes.body.accessToken as string;

    let cookieB = '';
    let accessB = '';
    const { output } = await captureLogs(async () => {
      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookieA)
        .expect(200);
      cookieB = refreshCookieOf(refreshRes);
      accessB = refreshRes.body.accessToken as string;
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookieA)
        .expect(401);
    });

    for (const secret of [
      rawTokenOf(cookieA),
      rawTokenOf(cookieB),
      accessA,
      accessB,
    ]) {
      expect(output).not.toContain(secret);
    }
  });
});
