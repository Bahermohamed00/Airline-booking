import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';

const createMockPrisma = () => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
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
  emailVerificationToken: {
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
  $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(createMockPrisma())),
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };

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
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.upsert.mockResolvedValue({ id: 'role-1', name: 'Customer' });
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: dto.email });

    const result = await service.register(dto);
    expect(result.userId).toBe('user-1');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should reject duplicate email registration', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
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
    prisma.user.update.mockResolvedValue({});

    const result = await service.login({ email: 'test@example.com', password: 'Password123!' });

    expect(result.accessToken).toBeDefined();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: expect.stringMatching(/^\$argon2id\$/) },
    });
  }, 15000); // bcrypt cost-12 hashing is CPU-bound under parallel test load

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
});
