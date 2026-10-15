import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { MfaEmailPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { hashToken } from './token-crypto.js';

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

export interface MfaEmailChallengeUser {
  id: string;
  email: string;
  firstName: string;
}

/**
 * Email-OTP MFA codes: 6 digits from a CSPRNG, SHA-256 hash stored, bound to a
 * user AND a purpose (LOGIN / ENABLE / DISABLE), 10-minute expiry, at most 5
 * verification attempts, single-use via compare-and-set. Issuing a replacement
 * invalidates the previous code for the same user+purpose under the user row
 * lock (same serialization pattern as verification/reset token issuance).
 *
 * The plaintext code is never logged or stored — it only exists in the email.
 */
@Injectable()
export class MfaEmailService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /** Issues a fresh code (invalidating outstanding ones) and emails it. */
  async issue(user: MfaEmailChallengeUser, purpose: MfaEmailPurpose, ipAddress?: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      await tx.mfaEmailToken.updateMany({
        where: { userId: user.id, purpose, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.mfaEmailToken.create({
        data: {
          userId: user.id,
          purpose,
          codeHash: hashToken(code),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });
    });
    await this.mail.sendMfaCodeEmail(user, code, purpose);
    await this.auditService.log({
      actorId: user.id,
      actorType: 'User',
      action: 'MFA_CHALLENGE_SENT',
      targetType: 'User',
      targetId: user.id,
      metadata: { purpose },
      ipAddress,
    });
  }

  /**
   * Verifies a code. Wrong codes increment the attempt counter; the fifth
   * failure invalidates the code (lockout — request a new one). Success
   * consumes the code atomically: a concurrent replay loses with count 0.
   */
  async verify(userId: string, purpose: MfaEmailPurpose, code: string, ipAddress?: string): Promise<void> {
    const fail = async (): Promise<never> => {
      // Never log the submitted code or its hash.
      await this.auditService.log({
        actorId: userId,
        actorType: 'User',
        action: 'MFA_VERIFICATION_FAILED',
        targetType: 'User',
        targetId: userId,
        metadata: { purpose },
        ipAddress,
      });
      throw new BadRequestException('Invalid or expired code');
    };

    const token = await this.prisma.mfaEmailToken.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    if (!token || token.expiresAt <= now || token.attempts >= MAX_ATTEMPTS) {
      await fail();
    }

    if (token!.codeHash !== hashToken(code)) {
      await this.prisma.$transaction(async (tx) => {
        const bumped = await tx.mfaEmailToken.updateMany({
          where: { id: token!.id, usedAt: null },
          data: { attempts: { increment: 1 } },
        });
        if (bumped.count === 0) return; // consumed concurrently — fail below
        if (token!.attempts + 1 >= MAX_ATTEMPTS) {
          // Fifth failure: lock the code out entirely.
          await tx.mfaEmailToken.update({
            where: { id: token!.id },
            data: { usedAt: new Date() },
          });
        }
      });
      await fail();
    }

    const consumed = await this.prisma.mfaEmailToken.updateMany({
      where: { id: token!.id, usedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_ATTEMPTS } },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      await fail();
    }
  }
}
