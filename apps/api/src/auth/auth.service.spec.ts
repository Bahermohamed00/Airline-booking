import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { MfaEmailService } from './mfa-email.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ConflictException, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';

const createMockPrisma = () => {
  // Shared interactive-transaction client; $transaction hands this to callbacks.
  const tx = {
    user: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    session: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    passwordResetToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'prt-1' }),
    },
    emailVerificationToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
  };
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn(),
    },
    role: {
      upsert: vi.fn(),
    },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({ id: 'token-1' }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
    },
    emailVerificationToken: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    userRole: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
    __tx: tx,
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let mfaEmail: { issue: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    mfaEmail = { issue: vi.fn().mockResolvedValue(undefined), verify: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
        SessionService,
        TokenService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: vi.fn().mockResolvedValue('token'),
            verify: vi.fn().mockReturnValue({ sub: 'user-1', type: 'refresh' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) => (key === 'JWT_SECRET' ? 'secret' : '')),
            get: vi.fn((key: string, def: string) => (key === 'JWT_EXPIRES_IN' ? '10m' : def)),
          },
        },
        {
          provide: AuditService,
          useValue: audit,
        },
        {
          provide: MfaEmailService,
          useValue: mfaEmail,
        },
        {
          provide: MailService,
          useValue: { sendVerificationEmail: vi.fn().mockResolvedValue(undefined), sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('should register a new user and assign Customer role', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      phone: '+49 170 1234567',
      streetAddress: 'Hauptstraße 12',
      nationalId: '28501010123456',
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.upsert.mockResolvedValue({ id: 'role-1', name: 'Customer' });
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: dto.email });

    const result = await service.register(dto);
    expect(result.userId).toBe('user-1');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: dto.phone,
          streetAddress: dto.streetAddress,
          nationalId: dto.nationalId,
        }),
      }),
    );
  });

  it('should reject duplicate email registration', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      phone: '+49 170 1234567',
      streetAddress: 'Hauptstraße 12',
      nationalId: '28501010123456',
    };

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: dto.email });

    await expect(service.register(dto)).rejects.toThrow(ConflictException);
  });

  it('should reject login with invalid credentials', async () => {
    const dto: LoginDto = { email: 'test@example.com', password: 'wrong' };
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('should transparently rehash a legacy bcrypt password on login', async () => {
    const bcrypt = await import('bcryptjs');
    const legacyHash = await bcrypt.hash('Password123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: legacyHash,
      status: 'ACTIVE',
      mfaEnabled: false,
      userRoles: [],
    });

    const result = await service.login({ email: 'test@example.com', password: 'Password123!' });

    expect(result.accessToken).toBeDefined();
    // Conditional write: only rehash while the stored hash is still the legacy one.
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', passwordHash: legacyHash },
      data: { passwordHash: expect.stringMatching(/^\$argon2id\$/) },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  }, 15000); // bcrypt cost-12 hashing is CPU-bound under parallel test load

  it('should still log in when a concurrent request already rehashed the password', async () => {
    const bcrypt = await import('bcryptjs');
    const legacyHash = await bcrypt.hash('Password123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: legacyHash,
      status: 'ACTIVE',
      mfaEnabled: false,
      userRoles: [],
    });
    // Lost the compare-and-set: another login rehashed first. No error, no retry.
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.login({ email: 'test@example.com', password: 'Password123!' });
    expect(result.accessToken).toBeDefined();
  }, 15000);

  it('should audit LOGIN_FAILED for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'ghost@example.com', password: 'Password123!' }, '203.0.113.7')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED', ipAddress: '203.0.113.7' }),
    );
  });

  it('should audit LOGIN_FAILED for a wrong password', async () => {
    const passwordService = new PasswordService();
    const hash = await passwordService.hash('Password123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
      status: 'ACTIVE',
      mfaEnabled: false,
      userRoles: [],
    });

    await expect(service.login({ email: 'test@example.com', password: 'WrongPassword!' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED', actorId: 'user-1', targetId: 'user-1' }),
    );
  });

  it('should derive expiresIn from JWT_EXPIRES_IN instead of hardcoding it', async () => {
    const passwordService = new PasswordService();
    const hash = await passwordService.hash('Password123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
      status: 'ACTIVE',
      mfaEnabled: false,
      userRoles: [],
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.login({ email: 'test@example.com', password: 'Password123!' });

    expect(result.expiresIn).toBe(600); // mocked JWT_EXPIRES_IN is 10m
  });

  it('should answer 404 when revoking an already-revoked session', async () => {
    prisma.session.findUnique.mockResolvedValue({ id: 's-9', userId: 'user-1', revokedAt: new Date() });

    await expect(service.revokeSession('s-9')).rejects.toThrow(NotFoundException);
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it('should email an enrollment code and audit MFA_SETUP_INITIATED on setup', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com', firstName: 'Test', mfaEnabled: false });

    const result = await service.setupMfa('user-1');

    expect(result.message).toBeDefined();
    expect(mfaEmail.issue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'test@example.com' }),
      'ENABLE',
    );
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'user-1',
      actorType: 'User',
      action: 'MFA_SETUP_INITIATED',
      targetType: 'User',
      targetId: 'user-1',
    });
    // No secret or code is ever stored on the user row.
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject MFA re-setup while MFA is enabled', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com', mfaEnabled: true });

    await expect(service.setupMfa('user-1')).rejects.toThrow(ConflictException);
    expect(mfaEmail.issue).not.toHaveBeenCalled();
  });

  it('should propagate a failed enrollment code verification', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com', mfaEnabled: false });
    mfaEmail.verify.mockRejectedValue(new BadRequestException('Invalid or expired code'));

    await expect(service.verifyMfaAndEnable('user-1', '000000')).rejects.toThrow(BadRequestException);
    expect(mfaEmail.verify).toHaveBeenCalledWith('user-1', 'ENABLE', '000000');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'MFA_ENABLED' }));
  });

  it('should audit MFA_ENABLED on successful verification', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com', mfaEnabled: false });
    prisma.user.update.mockResolvedValue({});

    const result = await service.verifyMfaAndEnable('user-1', '123456');

    expect(result.enabled).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { mfaEnabled: true },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MFA_ENABLED', actorId: 'user-1', targetId: 'user-1' }),
    );
  });

  describe('disableMfa', () => {
    it('should reject when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.disableMfa('user-1', '123456'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject when MFA is not enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        mfaEnabled: false,
      });

      await expect(
        service.disableMfa('user-1', '123456'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject an invalid DISABLE code without disabling MFA', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        mfaEnabled: true,
      });
      mfaEmail.verify.mockRejectedValue(new BadRequestException('Invalid or expired code'));

      await expect(
        service.disableMfa('user-1', '000000'),
      ).rejects.toThrow(BadRequestException);

      // The DISABLE purpose is enforced — LOGIN/ENABLE codes cannot pass.
      expect(mfaEmail.verify).toHaveBeenCalledWith('user-1', 'DISABLE', '000000');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should disable MFA when the emailed DISABLE code is valid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        mfaEnabled: true,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.disableMfa('user-1', '123456');

      expect(result.enabled).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { mfaEnabled: false },
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MFA_DISABLED',
          actorId: 'user-1',
          targetId: 'user-1',
        }),
      );
    });

    it('requestMfaDisable emails a fresh DISABLE-purpose code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com', firstName: 'Test', mfaEnabled: true });

      const result = await service.requestMfaDisable('user-1');

      expect(result.message).toBeDefined();
      expect(mfaEmail.issue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'DISABLE',
      );
    });

    it('requestMfaDisable rejects when MFA is not enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', mfaEnabled: false });

      await expect(service.requestMfaDisable('user-1')).rejects.toThrow(BadRequestException);
      expect(mfaEmail.issue).not.toHaveBeenCalled();
    });
  });

  describe('login MFA challenge (email OTP)', () => {
    const mfaUser = {
      id: 'user-1',
      email: 'mfa@example.com',
      firstName: 'Mfa',
      status: 'ACTIVE',
      mfaEnabled: true,
      userRoles: [],
    };

    it('issues a LOGIN challenge without creating a session or tokens', async () => {
      const passwordService = new PasswordService();
      const hash = await passwordService.hash('Password123!');
      prisma.user.findUnique.mockResolvedValue({ ...mfaUser, passwordHash: hash });

      const result = await service.login({ email: mfaUser.email, password: 'Password123!' });

      expect(result).toEqual({ mfaRequired: true });
      expect(mfaEmail.issue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', email: mfaUser.email }),
        'LOGIN',
        undefined,
      );
      expect(prisma.session.create).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('completes login only after the LOGIN code verifies', async () => {
      const passwordService = new PasswordService();
      const hash = await passwordService.hash('Password123!');
      prisma.user.findUnique.mockResolvedValue({ ...mfaUser, passwordHash: hash });

      const result = await service.login({ email: mfaUser.email, password: 'Password123!', mfaCode: '123456' });

      expect(mfaEmail.verify).toHaveBeenCalledWith('user-1', 'LOGIN', '123456', undefined);
      expect(result.mfaRequired).toBeUndefined();
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('maps a failed LOGIN code to 401 and issues no session', async () => {
      const passwordService = new PasswordService();
      const hash = await passwordService.hash('Password123!');
      prisma.user.findUnique.mockResolvedValue({ ...mfaUser, passwordHash: hash });
      mfaEmail.verify.mockRejectedValue(new BadRequestException('Invalid or expired code'));

      await expect(
        service.login({ email: mfaUser.email, password: 'Password123!', mfaCode: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('password reset single-use CAS', () => {
    const validTokenRow = {
      id: 'prt-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      user: { id: 'user-1' },
    };
    const dto = { token: 'raw-token', newPassword: 'NewPassword123!' };

    it('consumes the token, updates the password, and revokes sessions in one transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow);
      prisma.__tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resetPassword(dto);

      expect(result.message).toBeDefined();
      expect(prisma.__tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'prt-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.__tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.stringMatching(/^\$argon2id\$/) },
      });
      expect(prisma.__tx.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date), revokeReason: 'password_reset' },
      });
    });

    it('rejects a concurrently consumed token without touching the password or sessions', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow);
      prisma.__tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.__tx.user.update).not.toHaveBeenCalled();
      expect(prisma.__tx.session.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('email verification single-use CAS', () => {
    const pendingTokenRow = {
      id: 'evt-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      user: { id: 'user-1', status: 'PENDING_VERIFICATION' },
    };
    const dto = { token: 'raw-token' };

    it('verifies and reactivates a pending account via CAS', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(pendingTokenRow);
      prisma.__tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.verifyEmail(dto);

      expect(result.message).toBe('Email verified');
      expect(prisma.__tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true },
      });
      // Reactivation is conditional on the CURRENT status, not a pre-transaction read.
      expect(prisma.__tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE' },
      });
    });

    it('rejects a concurrently consumed token without writing the user', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(pendingTokenRow);
      prisma.__tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.verifyEmail(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.__tx.user.update).not.toHaveBeenCalled();
      expect(prisma.__tx.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('token issuance serialization', () => {
    it('locks the user row before invalidating and creating a verification token', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', emailVerified: false });

      await service.requestEmailVerification({ email: 'verify@example.com' });

      const tx = prisma.__tx;
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect((tx.$queryRaw.mock.calls[0]![0] as readonly string[]).join('')).toContain('FOR UPDATE');
      const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0]!;
      const invalidateOrder = tx.emailVerificationToken.updateMany.mock.invocationCallOrder[0]!;
      const createOrder = tx.emailVerificationToken.create.mock.invocationCallOrder[0]!;
      expect(lockOrder).toBeLessThan(invalidateOrder);
      expect(invalidateOrder).toBeLessThan(createOrder);
    });

    it('locks the user row before invalidating and creating a reset token', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'reset@example.com' });

      await service.requestPasswordReset({ email: 'reset@example.com' });

      const tx = prisma.__tx;
      expect(tx.$queryRaw).toHaveBeenCalled();
      const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0]!;
      const invalidateOrder = tx.passwordResetToken.updateMany.mock.invocationCallOrder[0]!;
      const createOrder = tx.passwordResetToken.create.mock.invocationCallOrder[0]!;
      expect(lockOrder).toBeLessThan(invalidateOrder);
      expect(invalidateOrder).toBeLessThan(createOrder);
    });
  });

});
