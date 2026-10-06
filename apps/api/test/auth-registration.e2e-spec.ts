import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

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
    dateOfBirth: '2000-05-17',
  };

  /** ISO date (YYYY-MM-DD) exactly `years` ago today, UTC. */
  const isoYearsAgo = (years: number): string => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - years);
    return d.toISOString().slice(0, 10);
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

  it('persists the date of birth on the account', async () => {
    const res = await register(validInput).expect(201);

    const user = await prismaTestClient.user.findUniqueOrThrow({
      where: { id: res.body.userId },
    });
    expect(user.dateOfBirth?.toISOString().slice(0, 10)).toBe('2000-05-17');
  });

  it('rejects a customer younger than 18 with 400 and persists nothing', async () => {
    const res = await register({ ...validInput, dateOfBirth: isoYearsAgo(17) });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('at least 18 years old');
    expect(await prismaTestClient.user.count()).toBe(0);
  });

  it('accepts a customer who turns exactly 18 today', async () => {
    const res = await register({ ...validInput, dateOfBirth: isoYearsAgo(18) });

    expect(res.status).toBe(201);
    expect(await prismaTestClient.user.count()).toBe(1);
  });

  it('rejects an invalid or future date of birth', async () => {
    expect(
      (await register({ ...validInput, dateOfBirth: 'not-a-date' })).status,
    ).toBe(400);
    const future = new Date(Date.now() + 365 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(
      (await register({ ...validInput, dateOfBirth: future })).status,
    ).toBe(400);
    const { dateOfBirth: _omit, ...noDob } = validInput;
    expect((await register(noDob)).status).toBe(400);

    expect(await prismaTestClient.user.count()).toBe(0);
  });

  it('returns the authenticated user data, including dateOfBirth, from /auth/me', async () => {
    const res = await register(validInput).expect(201);
    await prismaTestClient.user.update({
      where: { id: res.body.userId },
      data: { status: 'ACTIVE', emailVerified: true },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: validInput.email, password: validInput.password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body.email).toBe(validInput.email);
    expect(me.body.firstName).toBe('New');
    expect(me.body.lastName).toBe('User');
    expect(me.body.dateOfBirth).toBe('2000-05-17T00:00:00.000Z');
    expect(me.body.roles).toEqual(['Customer']);
  });
});
