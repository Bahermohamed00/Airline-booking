import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER, type PaymentIntentSnapshot } from './payment-provider';
import { RefundMetricsService } from './refund-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

/**
 * Notification wiring for BOOKING_CONFIRMED / PAYMENT_SUCCEEDED (Patch 1).
 * Covers all three committed success paths (sync/mock charge, Stripe
 * finalize funnel, BR-14 exception), fail-soft behavior, and replay safety.
 */

const customer = {
  userId: 'user-1',
  email: 'customer@example.com',
  roles: ['Customer'],
  permissions: [],
};

const staff = {
  userId: 'staff-1',
  email: 'admin@example.com',
  roles: ['Administrator'],
  permissions: ['bookings:manage'],
};

const future = () => new Date(Date.now() + 10 * 60_000);

/** Satisfies both the finalize-time select and confirmBookingInTransaction's include. */
const txBookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  userId: 'user-1',
  status: 'PENDING',
  bookingReference: 'NVAB12',
  bookingPassengers: [
    { id: 'bp-1', passenger: { id: 'pax-1', firstName: 'Ada', lastName: 'Lovelace' } },
  ],
  seatHolds: [
    {
      id: 'hold-1',
      flightId: 'flight-1',
      seatId: 'seat-1',
      status: 'ACTIVE',
      expiresAt: future(),
      seat: { seatNumber: '1A' },
    },
  ],
  ...overrides,
});

const bookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  bookingReference: 'NVAB12',
  userId: 'user-1',
  status: 'PENDING',
  totalAmount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  bookingPassengers: [{ id: 'bp-1' }],
  seatHolds: [
    { id: 'hold-1', flightId: 'flight-1', seatId: 'seat-1', status: 'ACTIVE', expiresAt: future() },
  ],
  payments: [] as unknown[],
  ...overrides,
});

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  status: 'PENDING',
  provider: 'stripe',
  providerReference: 'pi_123',
  providerStatus: null,
  token: null,
  idempotencyKey: 'key-1',
  paidAt: null,
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  refunds: [] as unknown[],
  ...overrides,
});

const intentFixture = (
  overrides: Partial<PaymentIntentSnapshot & { paymentId: string | null }> = {},
): PaymentIntentSnapshot & { paymentId: string | null } => ({
  providerReference: 'pi_123',
  status: 'succeeded',
  clientSecret: null,
  amountCents: 50500,
  currency: 'EUR',
  paymentId: null,
  ...overrides,
});

describe('PaymentsService — notification hooks (Patch 1)', () => {
  let service: PaymentsService;
  let prisma: {
    booking: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    payment: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
    __tx: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  };
  let provider: Record<string, ReturnType<typeof vi.fn> | string>;
  let notifications: {
    notifyBookingConfirmed: ReturnType<typeof vi.fn>;
    notifyPaymentSucceeded: ReturnType<typeof vi.fn>;
    notifyPaymentFailed: ReturnType<typeof vi.fn>;
    notifyCancellationApproved: ReturnType<typeof vi.fn>;
    notifyCancellationRejected: ReturnType<typeof vi.fn>;
    notifyRefundProcessed: ReturnType<typeof vi.fn>;
    notifyStaffRefundReviewRequired: ReturnType<typeof vi.fn>;
  };
  /** Set only after the transaction callback has fully run — the "commit" marker. */
  let txCompleted: boolean;

  beforeEach(async () => {
    txCompleted = false;
    const tx = {
      seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      booking: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(txBookingFixture()),
      },
      flightSegment: { findMany: vi.fn().mockResolvedValue([{ id: 'seg-1' }]) },
      bookingSeat: { create: vi.fn().mockResolvedValue({}) },
      payment: {
        create: vi.fn().mockResolvedValue(paymentFixture({ status: 'SUCCESS' })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      paymentWebhookEvent: { update: vi.fn().mockResolvedValue({}) },
    };
    prisma = {
      booking: { findFirst: vi.fn(), findUnique: vi.fn() },
      payment: {
        findUnique: vi.fn(),
        create: vi.fn().mockResolvedValue(paymentFixture({ status: 'FAILED' })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => {
        const result = await cb(tx);
        txCompleted = true;
        return result;
      }),
      __tx: tx as never,
    };
    provider = {
      name: 'mock',
      charge: vi.fn().mockResolvedValue({ outcome: 'succeeded', providerReference: 'mockref_1' }),
      refund: vi.fn(),
    };
    notifications = {
      // Post-commit assertion: a hook firing from inside the transaction would
      // observe txCompleted === false and fail here.
      notifyBookingConfirmed: vi.fn().mockImplementation(async () => {
        expect(txCompleted).toBe(true);
        return null;
      }),
      notifyPaymentSucceeded: vi.fn().mockImplementation(async () => {
        expect(txCompleted).toBe(true);
        return null;
      }),
      notifyPaymentFailed: vi.fn().mockResolvedValue(null),
      notifyCancellationApproved: vi.fn().mockResolvedValue(null),
      notifyCancellationRejected: vi.fn().mockResolvedValue(null),
      notifyRefundProcessed: vi.fn().mockResolvedValue(null),
      notifyStaffRefundReviewRequired: vi.fn().mockResolvedValue(0),
    };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn().mockResolvedValue({}) } },
        {
          provide: BookingsService,
          useValue: { getBookingView: vi.fn().mockResolvedValue({ id: 'booking-1' }) },
        },
        { provide: PAYMENT_PROVIDER, useValue: provider },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
        { provide: RefundMetricsService, useValue: new RefundMetricsService() },
        { provide: NotificationsService, useValue: notifications },
        { provide: RealtimeEventsService, useValue: { emitPaymentStatus: vi.fn() } },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  describe('sync/mock charge path (payBooking)', () => {
    it('notifies PAYMENT_SUCCEEDED and BOOKING_CONFIRMED after the committed transaction', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());

      const result = (await service.payBooking(customer, 'booking-1', {
        token: 'tok-1',
        idempotencyKey: 'key-1',
      })) as { payment: { status: string } };

      expect(result.payment.status).toBe('SUCCESS');
      expect(notifications.notifyPaymentSucceeded).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPaymentSucceeded).toHaveBeenCalledWith({
        userId: 'user-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledTimes(1);
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledWith({
        userId: 'user-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });
    });

    it('notifies PAYMENT_FAILED (never success events) when the charge is declined', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      (provider.charge as ReturnType<typeof vi.fn>).mockResolvedValue({
        outcome: 'failed',
        failureReason: 'declined',
      });

      await expect(
        service.payBooking(customer, 'booking-1', { token: 'tok-1', idempotencyKey: 'key-1' }),
      ).rejects.toThrow();

      expect(notifications.notifyPaymentFailed).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPaymentFailed).toHaveBeenCalledWith({
        userId: 'user-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });
      expect(notifications.notifyPaymentSucceeded).not.toHaveBeenCalled();
      expect(notifications.notifyBookingConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('finalizeSucceededIntent (Stripe webhook / retrieve funnel)', () => {
    it('notifies both events when the payment CAS and booking confirmation win', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      const result = await service.finalizeSucceededIntent(intentFixture(), {
        provider: 'stripe',
        eventId: 'evt_1',
      });

      expect(result).toEqual({
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        confirmedNow: true,
      });
      expect(notifications.notifyPaymentSucceeded).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPaymentSucceeded).toHaveBeenCalledWith({
        userId: 'user-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledTimes(1);
    });

    it('replayed delivery (payment CAS loses, booking already CONFIRMED) notifies nothing', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture({ status: 'SUCCESS' }));
      prisma.__tx['payment']!['updateMany']!.mockResolvedValue({ count: 0 });
      prisma.__tx['booking']!['findUniqueOrThrow']!.mockResolvedValue(
        txBookingFixture({ status: 'CONFIRMED' }),
      );

      const result = await service.finalizeSucceededIntent(intentFixture(), {
        provider: 'stripe',
        eventId: 'evt_1',
      });

      expect(result.confirmedNow).toBe(false);
      expect(notifications.notifyPaymentSucceeded).not.toHaveBeenCalled();
      expect(notifications.notifyBookingConfirmed).not.toHaveBeenCalled();
    });

    it('a notification failure is swallowed and never changes the finalized outcome', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      notifications.notifyPaymentSucceeded.mockReset();
      notifications.notifyPaymentSucceeded.mockRejectedValue(new Error('db down'));

      const result = await service.finalizeSucceededIntent(intentFixture(), {
        provider: 'stripe',
        eventId: 'evt_1',
      });

      expect(result.confirmedNow).toBe(true);
      // The second notification still runs after the first one failed.
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmBookingException (BR-14, no payment)', () => {
    it('notifies BOOKING_CONFIRMED only — never PAYMENT_SUCCEEDED', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingFixture());

      await service.confirmBookingException(staff, 'booking-1', {
        reason: 'VIP recovery',
      } as never);

      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledTimes(1);
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledWith({
        userId: 'user-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });
      expect(notifications.notifyPaymentSucceeded).not.toHaveBeenCalled();
    });
  });

  describe('markIntentFailed (Stripe payment_failed webhook)', () => {
    it('notifies PAYMENT_FAILED when the payment CAS PENDING→FAILED commits', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.booking.findUnique.mockResolvedValue({
        userId: 'user-1',
        bookingReference: 'NVAB12',
      });

      const result = await service.markIntentFailed(intentFixture());

      expect(result).toBe('updated');
      expect(notifications.notifyPaymentFailed).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPaymentFailed).toHaveBeenCalledWith({
        userId: 'user-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        bookingReference: 'NVAB12',
      });
    });

    it('ignores a late failure for an already-SUCCESS payment — no notification', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        paymentFixture({ status: 'SUCCESS' }),
      );

      const result = await service.markIntentFailed(intentFixture());

      expect(result).toBe('ignored');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyPaymentFailed).not.toHaveBeenCalled();
    });
  });
});
