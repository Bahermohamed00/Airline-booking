import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const user = {
  userId: 'user-1',
  email: 'customer@example.com',
  roles: ['Customer'],
  permissions: [],
};

const otherUser = { ...user, userId: 'user-2' };

const notificationFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'notif-1',
  userId: 'user-1',
  bookingId: 'booking-1',
  templateId: null,
  type: 'BOOKING_CONFIRMED',
  channel: 'IN_APP',
  status: 'SENT',
  title: 'Booking confirmed',
  content: 'Your booking NVAB12 is confirmed.',
  readAt: null,
  dedupeKey: 'booking-confirmed:booking:booking-1',
  error: null,
  sentAt: new Date('2026-10-13T10:00:00Z'),
  createdAt: new Date('2026-10-13T10:00:00Z'),
  ...overrides,
});

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.7.0',
  });

const createMockPrisma = () => ({
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((args: Promise<unknown>[]) => Promise.all(args)),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('createInApp', () => {
    const input = {
      userId: 'user-1',
      bookingId: 'booking-1',
      type: 'BOOKING_CONFIRMED' as const,
      title: 'Booking confirmed',
      content: 'Your booking NVAB12 is confirmed.',
      dedupeKey: 'booking-confirmed:booking:booking-1',
    };

    it('creates an IN_APP row delivered at insert time and returns the customer view', async () => {
      prisma.notification.create.mockResolvedValue(notificationFixture());

      const view = await service.createInApp(input);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          bookingId: 'booking-1',
          type: 'BOOKING_CONFIRMED',
          channel: 'IN_APP',
          status: 'SENT',
          dedupeKey: 'booking-confirmed:booking:booking-1',
          sentAt: expect.any(Date),
        }),
      });
      // The view must not leak delivery internals (error, templateId, status).
      expect(view).toEqual({
        id: 'notif-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking confirmed',
        content: 'Your booking NVAB12 is confirmed.',
        bookingId: 'booking-1',
        readAt: null,
        createdAt: new Date('2026-10-13T10:00:00Z'),
      });
    });

    it('returns null on a dedupe-key unique conflict (replay is a no-op)', async () => {
      prisma.notification.create.mockRejectedValue(p2002());

      await expect(service.createInApp(input)).resolves.toBeNull();
    });

    it('rethrows unexpected database errors so callers can fail-soft', async () => {
      prisma.notification.create.mockRejectedValue(new Error('db down'));

      await expect(service.createInApp(input)).rejects.toThrow('db down');
    });
  });

  describe('event helpers', () => {
    it('notifyBookingConfirmed dedupes per booking', async () => {
      prisma.notification.create.mockResolvedValue(notificationFixture());

      await service.notifyBookingConfirmed({
        userId: 'user-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'BOOKING_CONFIRMED',
          dedupeKey: 'booking-confirmed:booking:booking-1',
          content: 'Your booking NVAB12 is confirmed.',
        }),
      });
    });

    it('notifyPaymentSucceeded dedupes per payment and references the public booking reference', async () => {
      prisma.notification.create.mockResolvedValue(
        notificationFixture({ type: 'PAYMENT_SUCCEEDED' }),
      );

      await service.notifyPaymentSucceeded({
        userId: 'user-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYMENT_SUCCEEDED',
          dedupeKey: 'payment-succeeded:payment:payment-1',
          content: 'Your payment for booking NVAB12 was successful.',
        }),
      });
    });
  });

  describe('findMine', () => {
    it('scopes every query to the authenticated user and orders newest-first', async () => {
      prisma.notification.findMany.mockResolvedValue([notificationFixture()]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.findMine(user, {
        page: 2,
        limit: 10,
      } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'IN_APP' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'IN_APP' },
      });
      expect(result).toMatchObject({ page: 2, limit: 10, total: 1, totalPages: 1 });
      expect(result.data).toHaveLength(1);
    });

    it('applies the unread filter via readAt null only', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findMine(user, { page: 1, limit: 20, status: 'unread' } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', channel: 'IN_APP', readAt: null },
        }),
      );
    });
  });

  describe('unreadCount', () => {
    it('counts only the authenticated user’s unread IN_APP rows', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.unreadCount(otherUser);

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-2', channel: 'IN_APP', readAt: null },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('markMineRead', () => {
    it('marks an owned unread notification as read', async () => {
      prisma.notification.findFirst.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ readAt: new Date('2026-10-13T11:00:00Z') }),
      );

      const view = await service.markMineRead(user, 'notif-1');

      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { readAt: expect.any(Date) },
      });
      expect(view.readAt).toEqual(new Date('2026-10-13T11:00:00Z'));
    });

    it('is idempotent: an already-read notification is returned unchanged', async () => {
      const readAt = new Date('2026-10-13T09:00:00Z');
      prisma.notification.findFirst.mockResolvedValue(
        notificationFixture({ readAt }),
      );

      const view = await service.markMineRead(user, 'notif-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(view.readAt).toEqual(readAt);
    });

    it('returns 404 for a foreign or unknown id (never 403)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markMineRead(otherUser, 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllMineRead', () => {
    it('scopes the bulk update to the authenticated user’s unread rows', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllMineRead(user);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'IN_APP', readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual({ updated: 4 });
    });
  });
});

describe('NotificationsService — Patch 3 (email + new events + staff alerts)', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  const createdChannels = () =>
    prisma.notification.create.mock.calls.map((c) => c[0].data);

  it('notifyBookingConfirmed queues an IN_APP row AND a PENDING email row with an :email dedupe suffix', async () => {
    prisma.notification.create.mockResolvedValue(notificationFixture());

    await service.notifyBookingConfirmed({
      userId: 'user-1',
      bookingId: 'booking-1',
      bookingReference: 'NVAB12',
    });

    const calls = createdChannels();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(
      expect.objectContaining({
        channel: 'IN_APP',
        status: 'SENT',
        type: 'BOOKING_CONFIRMED',
        dedupeKey: 'booking-confirmed:booking:booking-1',
      }),
    );
    expect(calls[1]).toEqual(
      expect.objectContaining({
        channel: 'EMAIL',
        status: 'PENDING',
        type: 'BOOKING_CONFIRMED',
        dedupeKey: 'booking-confirmed:booking:booking-1:email',
      }),
    );
  });

  it('event helpers use stable per-entity dedupe keys', async () => {
    prisma.notification.create.mockResolvedValue(notificationFixture());

    await service.notifyPaymentFailed({
      userId: 'user-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      bookingReference: 'NVAB12',
    });
    await service.notifyCancellationApproved({
      userId: 'user-1',
      requestId: 'req-1',
      bookingId: 'booking-1',
      bookingReference: 'NVAB12',
    });
    await service.notifyCancellationRejected({
      userId: 'user-1',
      requestId: 'req-1',
      bookingId: 'booking-1',
      bookingReference: 'NVAB12',
    });
    await service.notifyRefundProcessed({
      userId: 'user-1',
      refundId: 'refund-1',
      bookingId: 'booking-1',
      bookingReference: 'NVAB12',
    });

    const keys = createdChannels().map((c) => c.dedupeKey);
    expect(keys).toEqual([
      'payment-failed:payment:payment-1',
      'payment-failed:payment:payment-1:email',
      'cancellation-approved:request:req-1',
      'cancellation-approved:request:req-1:email',
      'cancellation-rejected:request:req-1',
      'cancellation-rejected:request:req-1:email',
      'refund-processed:refund:refund-1',
      'refund-processed:refund:refund-1:email',
    ]);
    // The rejected message must not contain a staff free-text reason.
    const rejected = createdChannels().find(
      (c) => c.type === 'CANCELLATION_REJECTED',
    );
    expect(rejected.content).not.toContain('reason');
  });

  it('createEmail returns null on a dedupe conflict (replay is a no-op)', async () => {
    prisma.notification.create.mockRejectedValue(p2002());

    await expect(
      service.createEmail({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 't',
        content: 'c',
        dedupeKey: 'booking-confirmed:booking:booking-1:email',
      }),
    ).resolves.toBeNull();
  });

  it('staff alert resolves least-privilege recipients and dedupes per refund per user', async () => {
    prisma.notification.create.mockResolvedValue(notificationFixture());
    const userFindMany = vi
      .fn()
      .mockResolvedValue([{ id: 'staff-1' }, { id: 'staff-2' }]);
    Object.assign(prisma, { user: { findMany: userFindMany } });

    const notified = await service.notifyStaffRefundReviewRequired({
      refundId: 'refund-1',
      bookingReference: 'NVAB12',
    });

    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              OR: [
                { isSuperAdmin: true },
                {
                  rolePermissions: {
                    some: {
                      permission: { resource: 'payments', action: 'refund' },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    const keys = createdChannels().map((c) => c.dedupeKey);
    expect(keys).toEqual([
      'refund-review:refund:refund-1:user:staff-1',
      'refund-review:refund:refund-1:user:staff-1:email',
      'refund-review:refund:refund-1:user:staff-2',
      'refund-review:refund:refund-1:user:staff-2:email',
    ]);
    expect(notified).toBe(2);
  });

  it('staff alert with no eligible recipients notifies nobody', async () => {
    Object.assign(prisma, { user: { findMany: vi.fn().mockResolvedValue([]) } });

    const notified = await service.notifyStaffRefundReviewRequired({
      refundId: 'refund-1',
      bookingReference: 'NVAB12',
    });

    expect(notified).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  describe('listAdmin (staff operations view)', () => {
    it('queries without user scoping, newest-first with id tie-breaker, paginated', async () => {
      prisma.notification.findMany.mockResolvedValue([notificationFixture()]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.listAdmin({ page: 2, limit: 10 } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      });
      expect(result).toMatchObject({ page: 2, limit: 10, total: 1, totalPages: 1 });
      expect(result.data).toHaveLength(1);
    });

    it('applies channel, delivery-status, and read-state filters independently', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listAdmin({
        page: 1,
        limit: 20,
        channel: 'EMAIL',
        status: 'FAILED',
        read: 'unread',
      } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channel: 'EMAIL', status: 'FAILED', readAt: null },
        }),
      );
    });

    it('read=read maps to readAt not-null', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listAdmin({ page: 1, limit: 20, read: 'read' } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { readAt: { not: null } } }),
      );
    });

    it('returns the admin view with exactly the documented fields — no sensitive internals', async () => {
      prisma.notification.findMany.mockResolvedValue([
        notificationFixture({
          attempts: 2,
          error: 'SMTP connection timeout',
          templateId: 'tpl-1',
          dedupeKey: 'booking-confirmed:booking:booking-1',
        }),
      ]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.listAdmin({ page: 1, limit: 20 } as never);
      const row = result.data[0]!;

      expect(Object.keys(row).sort()).toEqual(
        [
          'attempts',
          'bookingId',
          'channel',
          'content',
          'createdAt',
          'error',
          'id',
          'readAt',
          'sentAt',
          'status',
          'title',
          'type',
          'userId',
        ].sort(),
      );
      expect(row).not.toHaveProperty('templateId');
      expect(row).not.toHaveProperty('dedupeKey');
      expect(row.error).toBe('SMTP connection timeout');
      expect(row.attempts).toBe(2);
    });

    it('handles an empty result set', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.listAdmin({ page: 1, limit: 20 } as never);

      expect(result).toEqual({
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('scopes to the bookingId FK exactly — never inferred from content or recipient', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listAdmin({ page: 1, limit: 20, bookingId: 'booking-1' } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bookingId: 'booking-1' } }),
      );
      expect(prisma.notification.count).toHaveBeenCalledWith({ where: { bookingId: 'booking-1' } });
    });

    it('combines bookingId with the other filters without dropping it', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listAdmin({
        page: 1,
        limit: 20,
        bookingId: 'booking-1',
        channel: 'IN_APP',
        read: 'unread',
      } as never);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: 'booking-1', channel: 'IN_APP', readAt: null },
        }),
      );
    });
  });

  describe('AdminNotificationQueryDto bookingId', () => {
    it('accepts a UUID bookingId and rejects malformed ones', async () => {
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      const { AdminNotificationQueryDto } = await import('./dto/admin-notification-query.dto.js');

      const ok = plainToInstance(AdminNotificationQueryDto, { bookingId: '3f6b1d2e-7a9c-4e5b-9d8c-1a2b3c4d5e6f' });
      expect(await validate(ok)).toHaveLength(0);

      const bad = plainToInstance(AdminNotificationQueryDto, { bookingId: 'NVABC1' });
      const errors = await validate(bad);
      expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
    });
  });
});
