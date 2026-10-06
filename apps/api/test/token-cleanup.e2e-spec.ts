import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TokenCleanupService } from '../src/auth/token-cleanup.service.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

const hash = (letter: string) => letter.repeat(64);

describe('TokenCleanupService (e2e)', () => {
  let app: INestApplication<App>;
  let service: TokenCleanupService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    service = app.get(TokenCleanupService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
  });

  it('purges expired sessions/tokens and used one-time tokens, keeping live rows untouched', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86_400_000);
    const future = new Date(now.getTime() + 86_400_000);

    const user = await prismaTestClient.user.create({
      data: {
        email: 'cleanup@example.com',
        passwordHash: hash('f'),
        firstName: 'Clean',
        lastName: 'Up',
        status: 'ACTIVE',
      },
    });

    // Expired session with an expired token (cascade-deleted with the session).
    const expiredSession = await prismaTestClient.session.create({
      data: { userId: user.id, expiresAt: past },
    });
    await prismaTestClient.refreshToken.create({
      data: {
        sessionId: expiredSession.id,
        tokenHash: hash('a'),
        expiresAt: past,
      },
    });

    // Live session with a live token plus a rotated, already-expired token.
    const liveSession = await prismaTestClient.session.create({
      data: { userId: user.id, expiresAt: future },
    });
    await prismaTestClient.refreshToken.create({
      data: {
        sessionId: liveSession.id,
        tokenHash: hash('b'),
        expiresAt: future,
      },
    });
    await prismaTestClient.refreshToken.create({
      data: {
        sessionId: liveSession.id,
        tokenHash: hash('c'),
        expiresAt: past,
        rotatedAt: past,
      },
    });

    // Used verification token (dead despite future expiry), expired reset
    // token, and one still-valid reset token.
    await prismaTestClient.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hash('d'),
        expiresAt: future,
        usedAt: past,
      },
    });
    await prismaTestClient.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash('e'), expiresAt: past },
    });
    await prismaTestClient.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash('g'), expiresAt: future },
    });

    const deleted = await service.purge(now);

    expect(deleted).toEqual({
      sessions: 1,
      refreshTokens: 1,
      verificationTokens: 1,
      resetTokens: 1,
    });

    expect(await prismaTestClient.session.count()).toBe(1);
    expect(await prismaTestClient.refreshToken.count()).toBe(1);
    expect(await prismaTestClient.emailVerificationToken.count()).toBe(0);
    expect(await prismaTestClient.passwordResetToken.count()).toBe(1);

    const survivingSession = await prismaTestClient.session.findFirstOrThrow();
    expect(survivingSession.id).toBe(liveSession.id);
    const survivingToken =
      await prismaTestClient.refreshToken.findFirstOrThrow();
    expect(survivingToken.sessionId).toBe(liveSession.id);
  });
});
