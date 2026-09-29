import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from './test-utils.js';
import * as speakeasy from 'speakeasy';
import { randomUUID } from 'crypto';
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
  email: 'login@test.com',
  password: 'Password123!',
  firstName: 'Login',
  lastName: 'Tester',
};

describe('Login & access token (e2e)', () => {
  let app: INestApplication<App>;
  let jwtSecret: string;

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

    // Read the secret through the app's own config seam so tests always sign
    // with whatever the running application actually uses.
    jwtSecret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
    await registerVerifiedUser(app, TEST_USER);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function login(user = TEST_USER, password = TEST_USER.password) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password });
  }

  function sign(
    payload: Record<string, unknown>,
    options: { secret?: string; expiresIn?: number } = {},
  ) {
    return new JwtService({
      secret: options.secret ?? jwtSecret,
      signOptions: { expiresIn: options.expiresIn ?? 900 },
    }).signAsync(payload);
  }

  it('issues a short-lived access token with minimal claims', async () => {
    const res = await login();
    expect(res.status).toBe(200);

    const payload = decodePayload(res.body.accessToken);
    expect(Object.keys(payload).sort()).toEqual([
      'email',
      'exp',
      'iat',
      'sid',
      'sub',
      'type',
    ]);
    expect(payload['type']).toBe('access');
    expect(res.body.expiresIn).toBe(900); // .env JWT_EXPIRES_IN=15m
    expect((payload['exp'] as number) - (payload['iat'] as number)).toBe(900);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    expect(payload['sub']).toBe(user.id);
    const session = await prismaTestClient.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(payload['sid']).toBe(session.id);
  });

  it('creates a session with device metadata, stores the refresh token hashed only, and audits the login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('User-Agent', 'phase4-probe/1.0')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const session = await prismaTestClient.session.findFirstOrThrow({
      where: { userId: user.id },
      include: { refreshTokens: true },
    });
    expect(session.userAgent).toBe('phase4-probe/1.0');
    expect(session.ipAddress).toBeTruthy();
    expect(session.revokedAt).toBeNull();

    expect(session.refreshTokens).toHaveLength(1);
    const stored = session.refreshTokens[0]!;
    expect(stored.tokenHash).toBe(hashToken(rawTokenOf(refreshCookieOf(res))));
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    const audit = await prismaTestClient.auditLog.findFirst({
      where: { action: 'USER_LOGGED_IN', actorId: user.id },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    const wrongPassword = await login(TEST_USER, 'WrongPassword99!');
    const unknownEmail = await login(
      { ...TEST_USER, email: 'nobody@test.com' },
      'Password123!',
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body.message).toBe('Invalid credentials');
  });

  it.each(['DEACTIVATED', 'SUSPENDED'] as const)(
    'rejects login for %s accounts even with the correct password',
    async (status) => {
      await prismaTestClient.user.update({
        where: { email: TEST_USER.email },
        data: { status },
      });

      const res = await login();
      expect(res.status).toBe(401);
      expect(res.body.accessToken).toBeUndefined();
    },
  );

  it('blocks a valid access token as soon as the user is deactivated', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    const token = res.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await prismaTestClient.user.update({
      where: { email: TEST_USER.email },
      data: { status: 'DEACTIVATED' },
    });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects an expired access token', async () => {
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const expired = await sign(
      { sub: user.id, email: user.email, sid: randomUUID(), type: 'access' },
      { expiresIn: -60 },
    );

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('rejects tampered signatures and garbage bearer strings', async () => {
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const forged = await sign(
      { sub: user.id, email: user.email, sid: randomUUID(), type: 'access' },
      { secret: 'wrong-secret' },
    );

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
  });

  it('rejects tokens that are not of type access', async () => {
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const wrongType = await sign({
      sub: user.id,
      email: user.email,
      sid: randomUUID(),
      type: 'refresh',
    });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${wrongType}`)
      .expect(401);
  });

  it('rejects tokens whose sid does not map to an active session', async () => {
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const danglingSid = await sign({
      sub: user.id,
      email: user.email,
      sid: randomUUID(),
      type: 'access',
    });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${danglingSid}`)
      .expect(401);
  });

  it('MFA-enabled account: login without a code returns mfaRequired without tokens; a wrong code is rejected', async () => {
    const secret = speakeasy.generateSecret({ length: 20 });
    await prismaTestClient.user.update({
      where: { email: TEST_USER.email },
      data: { mfaEnabled: true, mfaSecret: secret.base32 },
    });

    const noCode = await login();
    expect(noCode.status).toBe(200);
    expect(noCode.body).toEqual({ mfaRequired: true });
    expect(noCode.headers['set-cookie']).toBeUndefined();

    // Pick a code that is guaranteed not to match the valid TOTP in the ±1 window.
    const now = Math.floor(Date.now() / 1000);
    const validCodes = new Set(
      [-30, 0, 30].map((offset) =>
        speakeasy.totp({
          secret: secret.base32,
          encoding: 'base32',
          time: now + offset,
        }),
      ),
    );
    const wrongCode = [
      '000000',
      '123456',
      '654321',
      '111111',
      '999999',
      '222222',
    ].find((c) => !validCodes.has(c))!;
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password,
        mfaCode: wrongCode,
      });
    expect(res.status).toBe(401);
  });

  it('never logs credentials or tokens during login', async () => {
    const { result: res, output } = await captureLogs(() => login());

    expect(res.status).toBe(200);
    expect(output).not.toContain(TEST_USER.password);
    expect(output).not.toContain(rawTokenOf(refreshCookieOf(res)));
    expect(output).not.toContain(
      (res.body as { accessToken: string }).accessToken,
    );
  });
});
