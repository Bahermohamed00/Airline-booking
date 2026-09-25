import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashToken } from '../src/auth/token-crypto.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const TEST_USER = {
  email: 'throttle@test.com',
  password: 'Password123!',
  firstName: 'Throttle',
  lastName: 'Tester',
};

/** Calls fn until a 429 appears (max `maxAttempts`), returning the status sequence. */
async function untilThrottled(fn: () => Promise<request.Response>, maxAttempts: number): Promise<{ statuses: number[]; throttled: request.Response | null }> {
  const statuses: number[] = [];
  let throttled: request.Response | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fn();
    statuses.push(res.status);
    if (res.status === 429) {
      throttled = res;
      break;
    }
  }
  return { statuses, throttled };
}

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  const previousFlag = process.env['E2E_THROTTLE'];

  beforeAll(async () => {
    // Opt this suite into throttling; all other e2e suites run with it disabled.
    process.env['E2E_THROTTLE'] = '1';

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
    if (previousFlag === undefined) {
      delete process.env['E2E_THROTTLE'];
    } else {
      process.env['E2E_THROTTLE'] = previousFlag;
    }
  });

  async function login(email = TEST_USER.email, password = 'WrongPassword123!') {
    return request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  }

  it('change-password: a valid change works under the limit, repeated attempts are throttled', async () => {
    await registerVerifiedUser(app, TEST_USER);
    const loginRes = await login(TEST_USER.email, TEST_USER.password);
    const token = loginRes.body.accessToken as string;

    const change = (currentPassword: string) =>
      request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword, newPassword: 'AnotherPass123!', confirmPassword: 'AnotherPass123!' });

    // Legitimate change succeeds first (limit not yet reached)
    await change(TEST_USER.password).expect(200);

    const { statuses, throttled } = await untilThrottled(() => change('WrongPassword123!'), 8);
    expect(throttled).not.toBeNull();
    expect(statuses.slice(0, -1).every((s) => s !== 429)).toBe(true);
  });

  it('throttling one endpoint does not affect unrelated endpoints', async () => {
    await registerVerifiedUser(app, TEST_USER);
    const loginRes = await login(TEST_USER.email, TEST_USER.password);
    const token = loginRes.body.accessToken as string;

    // The change-password counter was exhausted in the previous test: still 429
    const stillThrottled = await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Whatever123!', newPassword: 'AnotherPass123!', confirmPassword: 'AnotherPass123!' });
    expect(stillThrottled.status).toBe(429);

    // Unrelated endpoints answer normally (counters are per-route)
    const resetReq = await request(app.getHttpServer())
      .post('/api/auth/password-reset-request')
      .send({ email: 'nobody@test.com' });
    expect(resetReq.status).toBe(200);
    const verifyReq = await request(app.getHttpServer())
      .post('/api/auth/email-verification-request')
      .send({ email: 'nobody@test.com' });
    expect(verifyReq.status).toBe(200);
  });

  it('password-reset: valid token flow works under the limit, token abuse is throttled', async () => {
    await registerVerifiedUser(app, TEST_USER);
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
    await prismaTestClient.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken('valid-reset-token'), expiresAt: new Date(Date.now() + 3_600_000) },
    });

    // Legitimate reset succeeds first
    await request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ token: 'valid-reset-token', newPassword: 'NewPassword123!' })
      .expect(200);

    const { statuses, throttled } = await untilThrottled(
      () =>
        request(app.getHttpServer())
          .post('/api/auth/password-reset')
          .send({ token: 'garbage-token', newPassword: 'AnotherPass123!' }),
      12,
    );
    expect(throttled).not.toBeNull();
    expect(statuses.slice(0, -1).every((s) => s !== 429)).toBe(true);
  });

  it('password-reset-request: flooding is throttled without changing the generic behavior', async () => {
    const { statuses, throttled } = await untilThrottled(
      () =>
        request(app.getHttpServer())
          .post('/api/auth/password-reset-request')
          .send({ email: 'flood-target@test.com' }),
      8,
    );
    expect(throttled).not.toBeNull();
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);

    // The 429 body is the standard throttler response — no account existence hints
    const body = JSON.stringify(throttled!.body);
    expect(body).not.toContain('flood-target@test.com');
  });

  it('email-verification-request: resend flooding is throttled', async () => {
    const { statuses, throttled } = await untilThrottled(
      () =>
        request(app.getHttpServer())
          .post('/api/auth/email-verification-request')
          .send({ email: 'verify-flood@test.com' }),
      8,
    );
    expect(throttled).not.toBeNull();
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
  });

  it('login: brute force is throttled, failures stay generic, and the attempt is audited', async () => {
    await registerVerifiedUser(app, TEST_USER);

    const { statuses, throttled } = await untilThrottled(() => login(), 8);
    expect(throttled).not.toBeNull();
    // Every pre-throttle response is the normal invalid-credentials 401
    expect(statuses.slice(0, -1).every((s) => s === 401)).toBe(true);

    const body = JSON.stringify(throttled!.body);
    expect(body).not.toContain(TEST_USER.email);

    const audit = await prismaTestClient.auditLog.findFirst({
      where: { action: 'AUTH_RATE_LIMITED', targetId: 'POST /api/auth/login' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(TEST_USER.email);
  });
});
