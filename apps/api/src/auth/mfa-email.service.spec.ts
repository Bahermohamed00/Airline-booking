import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MfaEmailService } from './mfa-email.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { hashToken } from './token-crypto';

const createMockPrisma = () => {
  const tx = {
    mfaEmailToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'tok-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
  };
  return {
    mfaEmailToken: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
    __tx: tx,
  };
};

const USER = { id: 'user-1', email: 'user@example.com', firstName: 'Test' };

const liveToken = (code: string, overrides: Record<string, unknown> = {}) => ({
  id: 'tok-1',
  userId: USER.id,
  purpose: 'LOGIN',
  codeHash: hashToken(code),
  expiresAt: new Date(Date.now() + 600_000),
  usedAt: null,
  attempts: 0,
  createdAt: new Date(),
  ...overrides,
});

describe('MfaEmailService', () => {
  let service: MfaEmailService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mail: { sendMfaCodeEmail: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mail = { sendMfaCodeEmail: vi.fn().mockResolvedValue(undefined) };
    audit = { log: vi.fn().mockResolvedValue({}) };
    const module = await Test.createTestingModule({
      providers: [
        MfaEmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(MfaEmailService);
  });

  describe('issue', () => {
    it('locks the user row, invalidates outstanding codes, and stores only the hash', async () => {
      await service.issue(USER, 'LOGIN');

      const tx = prisma.__tx;
      expect((tx.$queryRaw.mock.calls[0]![0] as readonly string[]).join('')).toContain('FOR UPDATE');
      const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0]!;
      const invalidateOrder = tx.mfaEmailToken.updateMany.mock.invocationCallOrder[0]!;
      const createOrder = tx.mfaEmailToken.create.mock.invocationCallOrder[0]!;
      expect(lockOrder).toBeLessThan(invalidateOrder);
      expect(invalidateOrder).toBeLessThan(createOrder);

      const createData = tx.mfaEmailToken.create.mock.calls[0]![0].data;
      expect(createData.purpose).toBe('LOGIN');
      expect(createData.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(createData.expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);

      // The emailed code is a 6-digit string whose hash is what was stored.
      const emailedCode = mail.sendMfaCodeEmail.mock.calls[0]![1] as string;
      expect(emailedCode).toMatch(/^\d{6}$/);
      expect(hashToken(emailedCode)).toBe(createData.codeHash);
      expect(mail.sendMfaCodeEmail.mock.calls[0]![2]).toBe('LOGIN');
    });

    it('audits MFA_CHALLENGE_SENT without the code', async () => {
      await service.issue(USER, 'ENABLE');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MFA_CHALLENGE_SENT', targetId: USER.id, metadata: { purpose: 'ENABLE' } }),
      );
      const emailedCode = mail.sendMfaCodeEmail.mock.calls[0]![1] as string;
      expect(JSON.stringify(audit.log.mock.calls)).not.toContain(emailedCode);
    });
  });

  describe('verify', () => {
    it('consumes a valid code atomically', async () => {
      prisma.mfaEmailToken.findFirst.mockResolvedValue(liveToken('482910'));

      await service.verify(USER.id, 'LOGIN', '482910');

      expect(prisma.mfaEmailToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'tok-1', usedAt: null, expiresAt: { gt: expect.any(Date) }, attempts: { lt: 5 } },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('scopes the token lookup to the user and purpose (purpose binding)', async () => {
      prisma.mfaEmailToken.findFirst.mockResolvedValue(null);

      await expect(service.verify(USER.id, 'DISABLE', '482910')).rejects.toThrow(BadRequestException);
      expect(prisma.mfaEmailToken.findFirst).toHaveBeenCalledWith({
        where: { userId: USER.id, purpose: 'DISABLE', usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('rejects when no live token exists, when expired, and when locked out', async () => {
      prisma.mfaEmailToken.findFirst.mockResolvedValue(null);
      await expect(service.verify(USER.id, 'LOGIN', '482910')).rejects.toThrow(BadRequestException);

      prisma.mfaEmailToken.findFirst.mockResolvedValue(liveToken('482910', { expiresAt: new Date(Date.now() - 1000) }));
      await expect(service.verify(USER.id, 'LOGIN', '482910')).rejects.toThrow(BadRequestException);

      prisma.mfaEmailToken.findFirst.mockResolvedValue(liveToken('482910', { attempts: 5 }));
      await expect(service.verify(USER.id, 'LOGIN', '482910')).rejects.toThrow(BadRequestException);
      // Lockout is judged without touching the row.
      expect(prisma.__tx.mfaEmailToken.updateMany).not.toHaveBeenCalled();
    });

    it('increments attempts on a wrong code and audits the failure without the code', async () => {
      prisma.mfaEmailToken.findFirst.mockResolvedValue(liveToken('482910'));

      await expect(service.verify(USER.id, 'LOGIN', '000000')).rejects.toThrow(BadRequestException);

      expect(prisma.__tx.mfaEmailToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'tok-1', usedAt: null },
        data: { attempts: { increment: 1 } },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MFA_VERIFICATION_FAILED', targetId: USER.id }),
      );
      expect(JSON.stringify(audit.log.mock.calls)).not.toContain('000000');
      expect(JSON.stringify(audit.log.mock.calls)).not.toContain('482910');
    });

    it('locks the code out on the fifth failed attempt', async () => {
      prisma.mfaEmailToken.findFirst.mockResolvedValue(liveToken('482910', { attempts: 4 }));

      await expect(service.verify(USER.id, 'LOGIN', '000000')).rejects.toThrow(BadRequestException);
      expect(prisma.__tx.mfaEmailToken.update).toHaveBeenCalledWith({
        where: { id: 'tok-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('rejects when the CAS consume loses a concurrent replay', async () => {
      prisma.mfaEmailToken.findFirst.mockResolvedValue(liveToken('482910'));
      prisma.mfaEmailToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.verify(USER.id, 'LOGIN', '482910')).rejects.toThrow(BadRequestException);
    });
  });
});
