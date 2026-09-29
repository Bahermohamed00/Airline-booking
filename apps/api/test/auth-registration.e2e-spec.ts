import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from './test-utils.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

describe('Registration (e2e)', () => {
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

  function register(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post('/api/auth/register').send(body);
  }

  const validInput = {
    email: 'newuser@test.com',
    password: 'Password123!',
    firstName: 'New',
    lastName: 'User',
  };

  it('creates the account as PENDING_VERIFICATION with only the Customer role', async () => {
    const res = await register(validInput).expect(201);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: res.body.userId },
      include: { userRoles: { include: { role: true } } },
    });
    expect(user.status).toBe('PENDING_VERIFICATION');
    expect(user.emailVerified).toBe(false);
    expect(user.userRoles.map((ur) => ur.role.name)).toEqual(['Customer']);
  });

  it('stores only an Argon2id hash and never leaks secrets in the response', async () => {
    const res = await register(validInput).expect(201);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: res.body.userId },
    });
    expect(
      user.passwordHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$'),
    ).toBe(true);
    expect(user.passwordHash).not.toContain(validInput.password);

    expect(Object.keys(res.body).sort()).toEqual(['email', 'userId']);
  });

  it('writes a USER_REGISTERED audit entry and issues an email verification token', async () => {
    const res = await register(validInput).expect(201);

    const audit = await prismaTestClient.auditLog.findFirst({
      where: { action: 'USER_REGISTERED', actorId: res.body.userId },
    });
    expect(audit).not.toBeNull();

    const verification =
      await prismaTestClient.emailVerificationToken.findFirst({
        where: { userId: res.body.userId, usedAt: null },
      });
    expect(verification).not.toBeNull();
    expect(verification!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verification!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a duplicate email with 409 — including a differently-cased duplicate', async () => {
    await register(validInput).expect(201);

    const exact = await register(validInput);
    expect(exact.status).toBe(409);

    const differentCase = await register({
      ...validInput,
      email: 'NewUser@Test.com',
    });
    expect(differentCase.status).toBe(409);

    expect(await prismaTestClient.user.count()).toBe(1);
  });

  it('normalizes email (trim + lowercase) and trims names', async () => {
    const res = await register({
      ...validInput,
      email: '  MixedCase@Test.com  ',
      firstName: '  Jane  ',
    }).expect(201);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: res.body.userId },
    });
    expect(user.email).toBe('mixedcase@test.com');
    expect(user.firstName).toBe('Jane');
    expect(res.body.email).toBe('mixedcase@test.com');

    // And the account can sign in with any casing of the email
    await prismaTestClient.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', emailVerified: true },
    });
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'MIXEDCASE@test.com', password: validInput.password })
      .expect(200);
  });

  it('rejects mass-assignment of privileged fields', async () => {
    const res = await register({
      ...validInput,
      roles: ['Super Admin'],
      status: 'ACTIVE',
      emailVerified: true,
    });
    expect(res.status).toBe(400);
    expect(await prismaTestClient.user.count()).toBe(0);
  });

  it('rejects invalid input: bad email, short password, missing/blank names', async () => {
    expect(
      (await register({ ...validInput, email: 'not-an-email' })).status,
    ).toBe(400);
    expect(
      (await register({ ...validInput, password: 'Short1!' })).status,
    ).toBe(400);
    const { firstName: _omit, ...noFirstName } = validInput;
    expect((await register(noFirstName)).status).toBe(400);
    expect((await register({ ...validInput, firstName: '   ' })).status).toBe(
      400,
    );

    expect(await prismaTestClient.user.count()).toBe(0);
  });
});
