import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Scheduled purge of dead auth rows (ADR-0001). Rotated refresh tokens are
 * kept until expiry so reuse detection keeps working; past expiry they — and
 * expired sessions, used/expired verification and reset tokens — are deleted.
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Deletes every expired/dead auth row. Returns per-table deleted counts. */
  async purge(
    now = new Date(),
  ): Promise<{
    sessions: number;
    refreshTokens: number;
    verificationTokens: number;
    resetTokens: number;
  }> {
    // Expired sessions cascade-delete their refresh tokens.
    const sessions = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const refreshTokens = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const verificationTokens =
      await this.prisma.emailVerificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
      });
    const resetTokens = await this.prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
    });
    return {
      sessions: sessions.count,
      refreshTokens: refreshTokens.count,
      verificationTokens: verificationTokens.count,
      resetTokens: resetTokens.count,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTokensJob(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    const deleted = await this.purge();
    this.logger.log(
      `Token cleanup: ${deleted.sessions} session(s), ${deleted.refreshTokens} refresh token(s), ${deleted.verificationTokens} verification token(s), ${deleted.resetTokens} reset token(s) purged`,
    );
  }
}
