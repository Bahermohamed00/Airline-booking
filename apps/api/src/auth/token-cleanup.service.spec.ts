import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenCleanupService } from './token-cleanup.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const createMockPrisma = () => ({
  session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  refreshToken: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  emailVerificationToken: {
    deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
  },
  passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
});

describe('TokenCleanupService', () => {
  let service: TokenCleanupService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TokenCleanupService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('purges expired sessions, expired refresh tokens, and used-or-expired verification/reset tokens', async () => {
    const now = new Date('2026-10-05T03:00:00Z');

    const deleted = await service.purge(now);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
    });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
    });
    expect(deleted).toEqual({
      sessions: 2,
      refreshTokens: 3,
      verificationTokens: 4,
      resetTokens: 5,
    });
  });

  it('cron wrapper is a no-op under NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    await service.purgeExpiredTokensJob();

    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
  });

  it('cron wrapper purges outside the test environment', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await service.purgeExpiredTokensJob();

    expect(prisma.session.deleteMany).toHaveBeenCalledOnce();
  });
});
