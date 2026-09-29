import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from './session.service.js';
import { AuditService } from '../audit/audit.service.js';
import { generateOpaqueToken, hashToken } from './token-crypto.js';

export interface IssuedRefreshToken {
  rawToken: string;
  expiresAt: Date;
}

export interface RotatedRefresh {
  userId: string;
  email: string;
  sessionId: string;
  rawToken: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async issue(sessionId: string): Promise<IssuedRefreshToken> {
    const rawToken = generateOpaqueToken();
    const expiresAt = this.refreshExpiry();
    await this.prisma.refreshToken.create({
      data: { sessionId, tokenHash: hashToken(rawToken), expiresAt },
    });
    return { rawToken, expiresAt };
  }

  async rotate(presentedToken: string): Promise<RotatedRefresh> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
      include: { session: { include: { user: true } } },
    });
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { session } = token;
    const now = new Date();

    if (token.rotatedAt) {
      // Reuse of a rotated token means theft: kill the whole session.
      await this.sessionService.revoke(session.id, 'reuse_detected');
      await this.auditService.log({
        actorId: session.userId,
        actorType: 'User',
        action: 'TOKEN_REUSE_DETECTED',
        targetType: 'Session',
        targetId: session.id,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt || session.expiresAt <= now || token.expiresAt <= now) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not active');
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = this.refreshExpiry();
    const tokenHash = hashToken(rawToken);

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: { sessionId: session.id, tokenHash, expiresAt },
      });
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { rotatedAt: now, replacedById: created.id },
      });
      await tx.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    });

    return {
      userId: session.userId,
      email: session.user.email,
      sessionId: session.id,
      rawToken,
      expiresAt,
    };
  }

  private refreshExpiry(): Date {
    const days = Number(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '7'));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
