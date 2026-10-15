import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MAIL_ADAPTER, type MailAdapter, type MailMessage } from '../src/mail/mail.adapter.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const TEST_USER = {
  email: 'mfa@test.com',
  password: 'Password123!',
  firstName: 'Mfa',
  lastName: 'Tester',
  dateOfBirth: '1990-01-01',
};

/**
 * Email-OTP MFA (e2e): enrollment, login challenge, disable — codes are read
 * from the fake mail outbox, never from logs or the database (hash-only there).
 */
describe('Email-OTP MFA (e2e)', () => {
  let app: INestApplication<App>;
  const outbox: MailMessage[] = [];
  const fakeAdapter: MailAdapter = {
    send: async (message) => {
      outbox.push(message);
    },
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .overrideProvider(MAIL_ADAPTER)
      .useValue(fakeAdapter)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
    outbox.length = 0;
    await registerVerifiedUser(app, TEST_USER);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  /** Extracts the 6-digit code from the most recent security-code email. */
  function latestCode(): string {
    const message = outbox.at(-1);
    expect(message, 'expected a security-code email in the outbox').toBeDefined();
    expect(message!.subject).toBe('Your NovaAir security code');
    const match = /\n\n(\d{6})\n\n/.exec(message!.text);
    expect(match, 'security-code email should contain a 6-digit code line').toBeTruthy();
    return match![1]!;
  }

  async function login(password = TEST_USER.password, mfaCode?: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password, ...(mfaCode ? { mfaCode } : {}) });
  }

  async function loginToken(): Promise<string> {
    const res = await login();
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  function authed(token: string, path: string) {
    return request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);
  }

  /** Enables MFA via the email-OTP enrollment flow. */
  async function enrollMfa(token: string): Promise<void> {
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const code = latestCode();
    await authed(token, '/api/auth/mfa/verify').send({ code }).expect(200);
  }

  it('enrollment: setup emails a code, verify enables MFA, audits never contain the code', async () => {
    const token = await loginToken();

    const setup = await authed(token, '/api/auth/mfa/setup').expect(200);
    expect(setup.body.message).toBeDefined();
    expect(setup.body.secret).toBeUndefined();
    expect(setup.body.qrCodeUrl).toBeUndefined();

    const code = latestCode();
    await authed(token, '/api/auth/mfa/verify').send({ code }).expect(200).expect((res) => {
      expect(res.body).toEqual({ enabled: true });
    });

    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
    expect(user.mfaEnabled).toBe(true);

    const audits = await prismaTestClient.auditLog.findMany({
      where: { action: { in: ['MFA_SETUP_INITIATED', 'MFA_CHALLENGE_SENT', 'MFA_ENABLED'] } },
    });
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['MFA_SETUP_INITIATED', 'MFA_CHALLENGE_SENT', 'MFA_ENABLED']),
    );
    const blob = JSON.stringify(audits);
    expect(blob).not.toContain(code);
  });

  it('rejects a wrong code, audits the failure without the code, and does not enable MFA', async () => {
    const token = await loginToken();
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const realCode = latestCode();

    await authed(token, '/api/auth/mfa/verify').send({ code: '000000' }).expect(400);

    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
    expect(user.mfaEnabled).toBe(false);
    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'MFA_VERIFICATION_FAILED', actorId: user.id },
    });
    const blob = JSON.stringify(audit.metadata);
    expect(blob).not.toContain('000000');
    expect(blob).not.toContain(realCode);
  });

  it('rejects expired and replayed codes', async () => {
    const token = await loginToken();
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const code = latestCode();

    // Expired
    await prismaTestClient.mfaEmailToken.updateMany({
      where: { purpose: 'ENABLE' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await authed(token, '/api/auth/mfa/verify').send({ code }).expect(400);

    // Fresh code: first use works, replay fails.
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const second = latestCode();
    await authed(token, '/api/auth/mfa/verify').send({ code: second }).expect(200);
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
    expect(user.mfaEnabled).toBe(true);
  });

  it('a replacement code invalidates the previous one', async () => {
    const token = await loginToken();
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const first = latestCode();
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const second = latestCode();
    expect(second).not.toBe(first);

    await authed(token, '/api/auth/mfa/verify').send({ code: first }).expect(400);
    await authed(token, '/api/auth/mfa/verify').send({ code: second }).expect(200);
  });

  it('locks the code out after five failed attempts', async () => {
    const token = await loginToken();
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const code = latestCode();

    for (let i = 0; i < 5; i++) {
      await authed(token, '/api/auth/mfa/verify').send({ code: '000000' }).expect(400);
    }
    // Sixth attempt — even the correct code is dead after lockout.
    await authed(token, '/api/auth/mfa/verify').send({ code }).expect(400);

    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
    expect(user.mfaEnabled).toBe(false);
  });

  it('concurrent verification of the same code succeeds exactly once', async () => {
    const token = await loginToken();
    await authed(token, '/api/auth/mfa/setup').expect(200);
    const code = latestCode();

    const [a, b] = await Promise.all([
      authed(token, '/api/auth/mfa/verify').send({ code }),
      authed(token, '/api/auth/mfa/verify').send({ code }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it('login challenge: no tokens before the code, full session after it', async () => {
    const token = await loginToken();
    await enrollMfa(token);

    // Password only → challenge, no session artifacts.
    const challenge = await login();
    expect(challenge.status).toBe(200);
    expect(challenge.body.mfaRequired).toBe(true);
    expect(challenge.body.accessToken).toBeUndefined();
    expect(challenge.headers['set-cookie']).toBeUndefined();

    const code = latestCode();
    const done = await login(TEST_USER.password, code);
    expect(done.status).toBe(200);
    expect(done.body.accessToken).toBeDefined();
    const cookies = done.headers['set-cookie'] as unknown as string[];
    expect(cookies?.some((c) => c.startsWith('refresh_token='))).toBe(true);

    // The session is real: /auth/me works and refresh rotation is intact.
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${done.body.accessToken}`)
      .expect(200);
  });

  it('a legacy (migrated TOTP) account with mfaEnabled=true is challenged by email and cannot bypass MFA', async () => {
    // Simulates a pre-migration TOTP account: mfaEnabled=true, no TOTP secret
    // (the migration destroyed the secrets). Login must challenge via email.
    await prismaTestClient.user.update({
      where: { email: TEST_USER.email },
      data: { mfaEnabled: true },
    });

    const challenge = await login();
    expect(challenge.body.mfaRequired).toBe(true);
    expect(challenge.body.accessToken).toBeUndefined();

    // A wrong code never completes login.
    const wrong = await login(TEST_USER.password, '000000');
    expect(wrong.status).toBe(401);

    const code = latestCode();
    const done = await login(TEST_USER.password, code);
    expect(done.status).toBe(200);
  });

  it('codes are purpose-bound: LOGIN codes cannot enable/disable, DISABLE codes cannot log in', async () => {
    const token = await loginToken();
    await enrollMfa(token);

    // A LOGIN-purpose code is rejected by the ENABLE endpoint…
    const challenge = await login();
    expect(challenge.body.mfaRequired).toBe(true);
    const loginCode = latestCode();
    await authed(token, '/api/auth/mfa/verify').send({ code: loginCode }).expect(400);

    // …but still works for its own purpose.
    const ownPurpose = await login(TEST_USER.password, loginCode);
    expect(ownPurpose.status).toBe(200);

    // A DISABLE-purpose code cannot complete a login challenge.
    await authed(token, '/api/auth/mfa/disable/request').expect(200);
    const disableCode = latestCode();
    const wrongPurpose = await login(TEST_USER.password, disableCode);
    expect(wrongPurpose.status).toBe(401);
  });

  it('disable requires a fresh DISABLE-purpose code', async () => {
    const token = await loginToken();
    await enrollMfa(token);

    // No code requested yet → any code fails.
    await authed(token, '/api/auth/mfa/disable').send({ code: '123456' }).expect(400);

    await authed(token, '/api/auth/mfa/disable/request').expect(200);
    const disableCode = latestCode();

    // A LOGIN code cannot disable: trigger a login challenge, then try it.
    const challenge = await login();
    expect(challenge.body.mfaRequired).toBe(true);
    const loginCode = latestCode();
    expect(loginCode).not.toBe(disableCode);
    await authed(token, '/api/auth/mfa/disable').send({ code: loginCode }).expect(400);

    // The DISABLE code works, exactly once.
    await authed(token, '/api/auth/mfa/disable').send({ code: disableCode }).expect(200).expect((res) => {
      expect(res.body).toEqual({ enabled: false });
    });
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
    expect(user.mfaEnabled).toBe(false);
    expect(await prismaTestClient.auditLog.count({ where: { action: 'MFA_DISABLED' } })).toBe(1);
  });

  it('mfa endpoints require authentication', async () => {
    await request(app.getHttpServer()).post('/api/auth/mfa/setup').expect(401);
    await request(app.getHttpServer()).post('/api/auth/mfa/verify').send({ code: '123456' }).expect(401);
    await request(app.getHttpServer()).post('/api/auth/mfa/disable/request').expect(401);
    await request(app.getHttpServer()).post('/api/auth/mfa/disable').send({ code: '123456' }).expect(401);
  });
});
