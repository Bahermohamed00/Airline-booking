import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

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

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
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
            get: vi.fn((key: string, def: string) => def),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: vi.fn().mockResolvedValue({}),
          },
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
});
