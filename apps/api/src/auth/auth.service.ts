import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { MfaEmailService } from './mfa-email.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  generateOpaqueToken,
  hashToken,
  parseDurationMs,
} from './token-crypto.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { PasswordResetDto } from './dto/password-reset.dto.js';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto.js';
import { EmailVerificationDto } from './dto/email-verification.dto.js';
import { EmailVerificationRequestDto } from './dto/email-verification-request.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { SAFE_USER_OMIT, type SafeUser } from '../users/safe-user.js';

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export type LoginResult =
  { mfaRequired: true } | ({ mfaRequired?: false } & AuthTokens);

export interface SessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
}

export interface MfaSetupResult {
  message: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(MfaEmailService) private readonly mfaEmail: MfaEmailService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(MailService) private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string; email: string }> {
    // 18+ rule — the backend is the final authority; never trust a client-sent age.
    const dob = new Date(dto.dateOfBirth);
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
    if (Number.isNaN(dob.getTime()) || dob > cutoff) {
      throw new BadRequestException(
        'You must be at least 18 years old to register.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Never log or echo the submitted ID; the conflict message stays generic.
    const existingNationalId = await this.prisma.user.findUnique({
      where: { nationalId: dto.nationalId },
    });
    if (existingNationalId) {
      throw new ConflictException('National ID already registered');
    }

    const customerRole = await this.prisma.role.upsert({
      where: { name: 'Customer' },
      update: {},
      create: { name: 'Customer', description: 'Default customer role' },
    });

    const hashedPassword = await this.passwordService.hash(dto.password);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          streetAddress: dto.streetAddress,
          nationalId: dto.nationalId,
          dateOfBirth: dob,
          status: 'PENDING_VERIFICATION',
          userRoles: { create: { roleId: customerRole.id } },
        },
      });
    } catch (error) {
      // Unique-violation race between the pre-checks above and the insert.
      // meta.target carries field NAMES only (model field or mapped column
      // name, depending on the driver) — never the submitted values.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.['target']) ? error.meta['target'].join(',') : '';
        throw new ConflictException(
          /national_?id/i.test(target) ? 'National ID already registered' : 'Email already registered',
        );
      }
      throw error;
    }

    await this.auditService.log({
      actorId: user.id,
      actorType: 'User',
      action: 'USER_REGISTERED',
      targetType: 'User',
      targetId: user.id,
    });

    const rawToken = await this.createVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(user, rawToken);

    return { userId: user.id, email: user.email };
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      // Verify against a dummy hash so response time does not reveal account existence
      await this.passwordService.verify(
        dto.password,
        await this.getDummyHash(),
      );
      await this.auditService.log({
        actorType: 'User',
        action: 'LOGIN_FAILED',
        targetType: 'User',
        metadata: { email: dto.email },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );
    if (!valid) {
      await this.auditService.log({
        actorId: user.id,
        actorType: 'User',
        action: 'LOGIN_FAILED',
        targetType: 'User',
        targetId: user.id,
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'PENDING_VERIFICATION') {
      throw new ForbiddenException({
        message: 'Please verify your email address before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account not active');
    }

    if (this.passwordService.needsRehash(user.passwordHash)) {
      const rehashed = await this.passwordService.hash(dto.password);
      // Conditional write: a concurrent login that already rehashed loses the
      // compare-and-set (count 0) instead of overwriting with a second hash.
      await this.prisma.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash: rehashed },
      });
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        // Password is proven — now issue the second factor. No session and no
        // tokens are created before the emailed code verifies.
        await this.mfaEmail.issue(user, 'LOGIN', ipAddress);
        return { mfaRequired: true };
      }
      try {
        await this.mfaEmail.verify(user.id, 'LOGIN', dto.mfaCode, ipAddress);
      } catch (error) {
        // Preserve the historical 401 for a failed login challenge.
        if (error instanceof BadRequestException) {
          throw new UnauthorizedException('Invalid MFA code');
        }
        throw error;
      }
    }

    const session = await this.sessionService.create(user.id, {
      userAgent,
      ipAddress,
    });
    const refresh = await this.tokenService.issue(session.id);
    const accessToken = await this.signAccessToken(
      user.id,
      user.email,
      session.id,
    );

    await this.auditService.log({
      actorId: user.id,
      actorType: 'User',
      action: 'USER_LOGGED_IN',
      targetType: 'User',
      targetId: user.id,
      ipAddress,
    });

    return {
      accessToken,
      expiresIn: this.accessExpiresInSeconds(),
      refreshToken: refresh.rawToken,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async refresh(presentedToken: string): Promise<AuthTokens> {
    const rotated = await this.tokenService.rotate(presentedToken);
    const accessToken = await this.signAccessToken(
      rotated.userId,
      rotated.email,
      rotated.sessionId,
    );

    return {
      accessToken,
      expiresIn: this.accessExpiresInSeconds(),
      refreshToken: rotated.rawToken,
      refreshTokenExpiresAt: rotated.expiresAt,
    };
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, 'logout');
    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'LOGOUT',
      targetType: 'Session',
      targetId: sessionId,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.revokeAllForUser(userId, 'logout_all');
    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'LOGOUT_ALL',
      targetType: 'User',
      targetId: userId,
    });
  }

  async listSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionView[]> {
    const sessions = await this.sessionService.listActiveForUser(userId);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(sessionId: string): Promise<void> {
    // Ownership is enforced by OwnershipGuard before this service is reached.
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.revokedAt) {
      throw new NotFoundException('Session not found');
    }
    await this.sessionService.revoke(sessionId, 'revoked');
    await this.auditService.log({
      actorId: session.userId,
      actorType: 'User',
      action: 'SESSION_REVOKED',
      targetType: 'Session',
      targetId: sessionId,
    });
  }

  async requestEmailVerification(
    dto: EmailVerificationRequestDto,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const message = 'If the email exists, a verification link has been sent';
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.emailVerified) {
      // Same response either way: no account enumeration
      return { message };
    }

    const rawToken = await this.createVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(user, rawToken);

    await this.auditService.log({
      actorId: user.id,
      actorType: 'User',
      action: 'EMAIL_VERIFICATION_REQUESTED',
      targetType: 'User',
      targetId: user.id,
      ipAddress,
    });

    return { message };
  }

  async verifyEmail(
    dto: EmailVerificationDto,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      include: { user: true },
    });

    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      // Same public error for missing/used/expired; the audit row records the attempt.
      await this.auditService.log({
        actorType: 'Guest',
        action: 'EMAIL_VERIFICATION_FAILED',
        targetType: 'EmailVerificationToken',
        targetId: token?.id ?? undefined,
        metadata: { reason: 'invalid_or_expired' },
        ipAddress,
      });
      throw new BadRequestException('Invalid or expired token');
    }

    // Single-use consume + activation in one interactive transaction: the CAS
    // on usedAt makes a concurrent double-submit lose with count 0 (rolled
    // back, same public error), and reactivation only fires if the account is
    // STILL PENDING_VERIFICATION at commit time — a concurrent admin
    // suspend/deactivate is never overwritten.
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw new BadRequestException('Invalid or expired token');
      }
      await tx.user.update({
        where: { id: token.userId },
        data: { emailVerified: true },
      });
      await tx.user.updateMany({
        where: { id: token.userId, status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE' },
      });
    });

    await this.auditService.log({
      actorId: token.userId,
      actorType: 'User',
      action: 'EMAIL_VERIFIED',
      targetType: 'User',
      targetId: token.userId,
      ipAddress,
    });

    return { message: 'Email verified' };
  }

  async requestPasswordReset(
    dto: PasswordResetRequestDto,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const message = 'If the email exists, a reset link has been sent';
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      // Same response either way: no account enumeration
      return { message };
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.resetTokenTtlMs());

    // One active reset link per user: requesting a new one invalidates the
    // previous ones, matching the email-verification flow (ADR-0004). The user
    // row lock serializes concurrent requests so they cannot interleave into
    // two live tokens.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
      });
    });

    await this.mailService.sendPasswordResetEmail(user, rawToken);

    await this.auditService.log({
      actorId: user.id,
      actorType: 'User',
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'User',
      targetId: user.id,
      ipAddress,
    });

    return { message };
  }

  async resetPassword(
    dto: PasswordResetDto,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      include: { user: true },
    });

    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      // Same public error for missing/used/expired; the audit row records the attempt.
      await this.auditService.log({
        actorType: 'Guest',
        action: 'PASSWORD_RESET_FAILED',
        targetType: 'PasswordResetToken',
        targetId: token?.id ?? undefined,
        metadata: { reason: 'invalid_or_expired' },
        ipAddress,
      });
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // CAS consume: a concurrent request presenting the same token loses with
      // count 0 and rolls back — no partial password/session writes.
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count === 0) {
        throw new BadRequestException('Invalid or expired token');
      }
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: hashedPassword },
      });
      // Every outstanding session dies with the old password.
      await tx.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'password_reset' },
      });
    });

    await this.auditService.log({
      actorId: token.userId,
      actorType: 'User',
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'User',
      targetId: token.userId,
      ipAddress,
    });

    return { message: 'Password updated successfully' };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No profile fields to update');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      omit: SAFE_USER_OMIT,
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        streetAddress: dto.streetAddress,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'PROFILE_UPDATED',
      targetType: 'User',
      targetId: userId,
      metadata: { changedFields: Object.keys(dto) },
    });

    return user;
  }

  async changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const fail = async (reason: string, message: string): Promise<never> => {
      await this.auditService.log({
        actorId: userId,
        actorType: 'User',
        action: 'PASSWORD_CHANGE_FAILED',
        targetType: 'User',
        targetId: userId,
        metadata: { reason },
        ipAddress,
      });
      throw new BadRequestException(message);
    };

    if (dto.newPassword !== dto.confirmPassword) {
      await fail('password_mismatch', 'Passwords do not match');
    }

    const currentValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentValid) {
      await fail('wrong_current_password', 'Current password is incorrect');
    }

    const isSamePassword = await this.passwordService.verify(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      await fail(
        'same_password',
        'New password must differ from the current password',
      );
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);
    const now = new Date();
    // The current session survives; every other session dies with the old password.
    const [, revoked] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null, id: { not: sessionId } },
        data: { revokedAt: now, revokeReason: 'password_changed' },
      }),
    ]);

    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'PASSWORD_CHANGED',
      targetType: 'User',
      targetId: userId,
      metadata: { otherSessionsRevoked: revoked.count },
      ipAddress,
    });

    return { message: 'Password changed successfully' };
  }

  async setupMfa(userId: string): Promise<MfaSetupResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Re-setup while MFA is active would silently replace the second factor —
    // require a verified disable first.
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled. Disable it before setting up again.');
    }

    // Email-OTP enrollment: the code proves mailbox control; nothing is
    // stored on the user row until verifyMfaAndEnable succeeds.
    await this.mfaEmail.issue(user, 'ENABLE');

    // Never log the code — user ID only.
    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'MFA_SETUP_INITIATED',
      targetType: 'User',
      targetId: userId,
    });

    return { message: 'A 6-digit security code was sent to your email address.' };
  }

  async verifyMfaAndEnable(
    userId: string,
    code: string,
  ): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('MFA not initialized');
    }

    // Audits MFA_VERIFICATION_FAILED internally; never logs the code. The CAS
    // consume inside verify() rejects a concurrent or replayed enable attempt
    // with the same public 400 — no separate mfaEnabled pre-check needed.
    await this.mfaEmail.verify(userId, 'ENABLE', code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'MFA_ENABLED',
      targetType: 'User',
      targetId: userId,
    });

    return { enabled: true };
  }

  /** Sends the fresh DISABLE-purpose code required by disableMfa. */
  async requestMfaDisable(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }
    await this.mfaEmail.issue(user, 'DISABLE');
    return { message: 'A 6-digit security code was sent to your email address.' };
  }

  async disableMfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Proof of possession: a stolen access token alone must not be able to
    // turn MFA off — a fresh DISABLE-purpose email code is required (LOGIN or
    // ENABLE codes are rejected by purpose binding).
    await this.mfaEmail.verify(userId, 'DISABLE', code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'User',
      action: 'MFA_DISABLED',
      targetType: 'User',
      targetId: userId,
    });

    return { enabled: false };
  }

  private dummyHash: string | null = null;

  private async createVerificationToken(userId: string): Promise<string> {
    const rawToken = generateOpaqueToken();
    const ttlMs = parseDurationMs(
      this.configService.get<string>('EMAIL_VERIFICATION_EXPIRES_IN', '24h'),
      24 * 3_600_000,
    );

    // Serialize issuance per user: lock the user row, then invalidate
    // outstanding tokens and create the new one in the same transaction —
    // concurrent requests cannot interleave into two live tokens.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      await tx.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });
    });
    return rawToken;
  }

  private resetTokenTtlMs(): number {
    return parseDurationMs(
      this.configService.get<string>('RESET_TOKEN_EXPIRES_IN', '1h'),
      3_600_000,
    );
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await this.passwordService.hash(
      'timing-equalization-dummy',
    );
    return this.dummyHash;
  }

  private parseExpiresInSeconds(value: string): number {
    const match = /^(\d+)([smhd])?$/.exec(value);
    if (!match) {
      return 900;
    }
    const amount = parseInt(match[1] ?? '900', 10);
    const unit = match[2] ?? 's';
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
    return amount * multiplier;
  }

  private accessExpiresInSeconds(): number {
    return this.parseExpiresInSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    );
  }

  private async signAccessToken(
    userId: string,
    email: string,
    sessionId: string,
  ): Promise<string> {
    const accessExpiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    );
    return this.jwtService.signAsync(
      { sub: userId, email, sid: sessionId, type: 'access' as const },
      { expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'] },
    );
  }
}
