import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from './test-utils.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  MAIL_ADAPTER,
  type MailAdapter,
  type MailMessage,
} from '../src/mail/mail.adapter.js';
import { hashToken, generateOpaqueToken } from '../src/auth/utils/token-crypto.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

const TEST_USER = {
  email: 'verify@test.com',
  password: 'Password123!',
  firstName: 'Vera',
  lastName: 'Fication',
};

describe('Email verification (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  function latestVerificationToken(): string {
    const message = outbox.at(-1);
    expect(
      message,
      'expected a verification email in the outbox',
    ).toBeDefined();
    const match = /token=([A-Za-z0-9\-_]+)/.exec(message!.text);
    expect(
      match,
      'verification email should contain a token link',
    ).toBeTruthy();
    return match![1]!;
  }

  it('register → login blocked until verified → verify → login works', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(403);
    expect(loginRes.body.code).toBe('EMAIL_NOT_VERIFIED');

    const token = latestVerificationToken();
    expect(outbox[0]!.to).toBe(TEST_USER.email);

    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.emailVerified).toBe(true);
  });

  it('rejects garbage and reused verification tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    const token = latestVerificationToken();

    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: 'not-a-real-token' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token })
      .expect(400);
  });

  it('verification-request always answers 200 and only emails unverified accounts', async () => {
    // Unknown email: same response, no email sent
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: 'ghost@test.com' })
      .expect(200);
    expect(outbox).toHaveLength(0);
    expect(unknown.body.message).toBeDefined();

    // Unverified account: email sent
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    const afterRegister = outbox.length;
    await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);
    expect(outbox.length).toBe(afterRegister + 1);

    // Already-verified account: same 200, no new email
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: latestVerificationToken() })
      .expect(200);
    const afterVerify = outbox.length;
    const res = await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);
    expect(outbox.length).toBe(afterVerify);
    expect(res.body.message).toBe(unknown.body.message);
  });

  it('stores only the hash of the emailed token, and the link points at the Angular verify route', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    const raw = latestVerificationToken();
    const message = outbox.at(-1)!;
    expect(message.text).toContain('/verify-email?token=');

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const row = await prismaTestClient.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.tokenHash).toBe(hashToken(raw));
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).not.toBe(raw);
  });

  it('resend invalidates the previous link and only the newest token verifies', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    const firstToken = latestVerificationToken();

    await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);
    const secondToken = latestVerificationToken();
    expect(secondToken).not.toBe(firstToken);

    // The first link is dead, the second works, and it is single-use
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: firstToken })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: secondToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: secondToken })
      .expect(400);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const rows = await prismaTestClient.emailVerificationToken.findMany({
      where: { userId: user.id },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.usedAt !== null)).toBe(true); // no usable token remains
    expect(user.emailVerified).toBe(true);
    expect(user.status).toBe('ACTIVE');
  });

  it('an expired verification token fails safely and leaves the account unverified', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    const raw = latestVerificationToken();

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    await prismaTestClient.emailVerificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: raw })
      .expect(400);

    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.emailVerified).toBe(false);
    expect(after.status).toBe('PENDING_VERIFICATION');
  });

  it("verification verifies a suspended account's email but never un-suspends it", async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    const raw = latestVerificationToken();
    await prismaTestClient.user.update({
      where: { email: TEST_USER.email },
      data: { status: 'SUSPENDED' },
    });

    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: raw })
      .expect(200);

    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    expect(after.emailVerified).toBe(true);
    expect(after.status).toBe('SUSPENDED');

    // Suspended accounts still cannot log in
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(401);
  });

  it('an already-verified account creates no new usable token and is not altered', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: latestVerificationToken() })
      .expect(200);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const before = await prismaTestClient.emailVerificationToken.findMany({
      where: { userId: user.id },
    });

    const res = await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);

    const afterRows = await prismaTestClient.emailVerificationToken.findMany({
      where: { userId: user.id },
    });
    expect(afterRows).toHaveLength(before.length); // no new token
    expect(afterRows.every((r) => r.usedAt !== null)).toBe(true); // no usable token
    const after = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.emailVerified).toBe(true);
    expect(after.status).toBe('ACTIVE');
    expect(res.body.message).toBeDefined();
  });

  it('an unknown email creates nothing and answers identically', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    const known = await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);
    const tokensBefore = await prismaTestClient.emailVerificationToken.count();
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: 'ghost@test.com' })
      .expect(200);

    expect(unknown.body).toEqual(known.body);
    expect(await prismaTestClient.emailVerificationToken.count()).toBe(
      tokensBefore,
    );
  });

  it('verification tokens expire per EMAIL_VERIFICATION_EXPIRES_IN (default: 24 hours)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    const before = Date.now();
    await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);

    const row = await prismaTestClient.emailVerificationToken.findFirstOrThrow({
      where: { usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const ttlMs = row.expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(86_000_000); // ~24h with slack
    expect(ttlMs).toBeLessThanOrEqual(86_500_000);
  });

  it('audits request, failure, and completion without ever storing the raw token', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: TEST_USER.email })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: 'wellformed-but-unknown-token-0000' })
      .expect(400);
    const raw = latestVerificationToken();
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: raw })
      .expect(200);

    const entries = await prismaTestClient.auditLog.findMany({
      where: {
        action: {
          in: [
            'EMAIL_VERIFICATION_REQUESTED',
            'EMAIL_VERIFICATION_FAILED',
            'EMAIL_VERIFIED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('EMAIL_VERIFICATION_REQUESTED');
    expect(actions).toContain('EMAIL_VERIFICATION_FAILED');
    expect(actions).toContain('EMAIL_VERIFIED');

    const blob = JSON.stringify(entries);
    expect(blob).not.toContain(raw);
    expect(blob).not.toContain('wellformed-but-unknown-token-0000');
    expect(blob).not.toContain(TEST_USER.password);
  });

  it('verification does not disturb existing sessions or tokens', async () => {
    // Register + verify + login to get a live session
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: latestVerificationToken() })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    // A second verification (e.g. a duplicated/older link) must not touch the session
    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
    });
    const secondRaw = generateOpaqueToken();
    await prismaTestClient.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(secondRaw),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await request(app.getHttpServer())
      .post('/api/auth/email-verification')
      .send({ token: secondRaw })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    const sessions = await prismaTestClient.session.findMany({
      where: { userId: user.id },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.revokedAt).toBeNull();
  });
});
