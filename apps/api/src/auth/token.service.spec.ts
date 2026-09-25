import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service.js';
import { SessionService } from './session.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';

const createMockPrisma = () => {
  const tx = {
    refreshToken: {
      create: vi.fn().mockResolvedValue({ id: 'new-token-id' }),
      update: vi.fn().mockResolvedValue({}),
    },
    session: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'token-id' }),
    },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

const activeSessionWithUser = {
  id: 'session-1',
  userId: 'user-1',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  user: { id: 'user-1', email: 'test@example.com', status: 'ACTIVE' },
};

describe('TokenService', () => {
  let service: TokenService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    const config = { get: vi.fn((_key: string, def: unknown) => def) };
    const sessionService = new SessionService(prisma as unknown as PrismaService, config as never);
    service = new TokenService(
      prisma as unknown as PrismaService,
      sessionService,
      config as never,
      audit as unknown as AuditService,
    );
  });

  it('rejects an unknown token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotate('nonexistent-token')).rejects.toThrow(UnauthorizedException);
  });

  it('revokes the whole session and audits when an already-rotated token is reused', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      rotatedAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 60_000),
      session: activeSessionWithUser,
    });

    await expect(service.rotate('reused-token')).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1', revokedAt: null },
        data: expect.objectContaining({ revokeReason: 'reuse_detected' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOKEN_REUSE_DETECTED', targetId: 'session-1' }),
    );
  });

  it('rejects an expired token without revoking the session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      rotatedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      session: activeSessionWithUser,
    });

    await expect(service.rotate('expired-token')).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a token whose session is revoked', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      session: { ...activeSessionWithUser, revokedAt: new Date() },
    });

    await expect(service.rotate('token-of-revoked-session')).rejects.toThrow(UnauthorizedException);
  });

  it('rotates a valid token: marks the old one rotated and returns a fresh token for the same session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      session: activeSessionWithUser,
    });

    const result = await service.rotate('valid-token');

    expect(result.sessionId).toBe('session-1');
    expect(result.userId).toBe('user-1');
    expect(result.email).toBe('test@example.com');
    expect(result.rawToken).toBeDefined();
    expect(result.rawToken).not.toBe('valid-token');
    expect(prisma.__tx.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'token-1' },
        data: expect.objectContaining({ replacedById: 'new-token-id' }),
      }),
    );
  });
});
