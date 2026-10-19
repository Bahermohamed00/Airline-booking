import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER, ProviderDefinitiveError } from './payment-provider';
import { RefundMetricsService, REFUND_COUNTERS } from './refund-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

const customer = {
  userId: 'user-1',
  email: 'customer@example.com',
  roles: ['Customer'],
  permissions: [],
};
const financeStaff = {
  userId: 'staff-1',
  email: 'finance@novaair.dev',
  roles: ['Finance Staff'],
  permissions: ['payments:read', 'payments:refund'],
};
const bookingManager = {
  userId: 'staff-2',
  email: 'bm@novaair.dev',
  roles: ['Booking Manager'],
  permissions: ['bookings:manage'],
};

const future = () => new Date(Date.now() + 10 * 60_000);
const past = () => new Date(Date.now() - 10 * 60_000);

const bookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  bookingReference: 'NVAB12',
  userId: 'user-1',
  status: 'PENDING',
  totalAmount: 505,
  currency: 'EUR',
  contactEmail: 'customer@example.com',
  fareRulesSnapshot: {
    cabinClass: 'ECONOMY',
    refundPolicy: { refundable: true, cancellationFeePercent: 10 },
  },
  bookingPassengers: [{ id: 'bp-1' }],
  seatHolds: [
    {
      id: 'hold-1',
      flightId: 'flight-1',
      seatId: 'seat-1',
      status: 'ACTIVE',
      expiresAt: future(),
    },
  ],
  payments: [] as unknown[],
  ...overrides,
});

/** Shape returned by tx.booking.findUniqueOrThrow inside confirmBookingInTransaction. */
const txBookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  bookingPassengers: [
    {
      id: 'bp-1',
      passenger: { id: 'p-1', firstName: 'Lena', lastName: 'Hoffmann' },
    },
  ],
  seatHolds: [
    {
      id: 'hold-1',
      flightId: 'flight-1',
      seatId: 'seat-1',
      status: 'ACTIVE',
      expiresAt: future(),
      seat: { id: 'seat-1', seatNumber: '1A' },
    },
  ],
  ...overrides,
});

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: 505,
  currency: 'EUR',
  status: 'SUCCESS',
  provider: 'mock',
  providerReference: 'mockpay_key-1',
  token: 'tok_ok',
  idempotencyKey: 'key-0001',
  paidAt: new Date(),
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  refunds: [] as unknown[],
  ...overrides,
});

const dto = { token: 'tok_ok', idempotencyKey: 'key-0001' };

const createMockPrisma = () => {
  const tx = {
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    booking: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    flightSegment: { findMany: vi.fn().mockResolvedValue([{ id: 'seg-1' }]) },
    bookingSeat: { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    payment: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    refund: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cancellationRequest: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    booking: { findFirst: vi.fn(), findUnique: vi.fn() },
    cancellationRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    refund: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    orphanProviderRefund: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
    __tx: tx,
  };
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let provider: {
    name: string;
    charge: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    listRefundsForPayment: ReturnType<typeof vi.fn>;
  };
  let bookings: { getBookingView: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };
  let metrics: RefundMetricsService;
  let realtime: { emitPaymentStatus: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    provider = {
      name: 'mock',
      charge: vi
        .fn()
        .mockResolvedValue({
          outcome: 'success',
          providerReference: 'mockpay_key-0001',
        }),
      refund: vi
        .fn()
        .mockResolvedValue({
          providerReference: 'mockref_mockpay_key-1_100.00',
        }),
      listRefundsForPayment: vi.fn().mockResolvedValue([]),
    };
    bookings = {
      getBookingView: vi
        .fn()
        .mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' }),
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    metrics = new RefundMetricsService();
    realtime = { emitPaymentStatus: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: BookingsService, useValue: bookings },
        { provide: PAYMENT_PROVIDER, useValue: provider },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
        { provide: RefundMetricsService, useValue: metrics },
        {
          provide: NotificationsService,
          useValue: {
            notifyBookingConfirmed: vi.fn().mockResolvedValue(null),
            notifyPaymentSucceeded: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: RealtimeEventsService, useValue: realtime },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  describe('payBooking', () => {
    it('rejects a booking the customer does not own with 404', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('pays a PENDING booking: confirms it, converts holds, creates booking seats and a SUCCESS payment', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(
        txBookingFixture(),
      );
      const createdPayment = paymentFixture();
      prisma.__tx.payment.create.mockResolvedValue({
        ...createdPayment,
        refunds: [],
      });

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { status: string; providerReference: string };
        booking: { status: string };
      };

      expect(provider.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 505,
          currency: 'EUR',
          token: 'tok_ok',
          idempotencyKey: 'key-0001',
          bookingReference: 'NVAB12',
        }),
      );
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'PENDING' },
        data: { status: 'CONFIRMED' },
      });
      expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1', status: 'ACTIVE' },
        data: { status: 'CONVERTED' },
      });
      expect(prisma.__tx.bookingSeat.create).toHaveBeenCalledWith({
        data: {
          bookingPassengerId: 'bp-1',
          flightSegmentId: 'seg-1',
          seatId: 'seat-1',
          seatNumber: '1A',
        },
      });
      expect(prisma.__tx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
            providerReference: 'mockpay_key-0001',
            amount: 505,
            currency: 'EUR',
          }),
        }),
      );
      expect(result.payment.status).toBe('SUCCESS');
      expect(result.booking.status).toBe('CONFIRMED');
      // Post-commit realtime push: minimal payload, exactly once per settlement.
      expect(realtime.emitPaymentStatus).toHaveBeenCalledTimes(1);
      expect(realtime.emitPaymentStatus).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        status: 'SUCCESS',
      });
      const actions = audit.log.mock.calls.map((c) => c[0].action);
      expect(actions).toEqual([
        'PAYMENT_SUCCEEDED',
        'BOOKING_CONFIRMED',
        'SEAT_HOLD_CONVERTED',
      ]);
    });

    it('records a FAILED payment and returns 402 without confirming when the provider declines', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      provider.charge.mockResolvedValue({
        outcome: 'failed',
        failureReason: 'Payment method was declined by the provider',
      });
      prisma.payment.create.mockResolvedValue(
        paymentFixture({
          status: 'FAILED',
          providerReference: null,
          refunds: [],
        }),
      );

      const error = await service
        .payBooking(customer, 'booking-1', dto)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED,
      );
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.log.mock.calls.map((c) => c[0].action)).toEqual([
        'PAYMENT_FAILED',
      ]);
    });

    it('rejects an already confirmed booking (different key) with 409', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED' }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('rejects a cancelled booking with 409', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ status: 'CANCELLED' }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects payment when seat holds have expired (no charge made)', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({
          seatHolds: [{ id: 'hold-1', status: 'ACTIVE', expiresAt: past() }],
        }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('replays the existing SUCCESS payment for the same key without charging again', async () => {
      const existing = paymentFixture({
        idempotencyKey: 'key-0001',
        token: 'tok_ok',
      });
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED', payments: [existing] }),
      );

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { id: string };
      };
      expect(result.payment.id).toBe('payment-1');
      expect(provider.charge).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects conflicting reuse of an idempotency key with a different token', async () => {
      const existing = paymentFixture({
        idempotencyKey: 'key-0001',
        token: 'tok_other',
      });
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ payments: [existing] }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('replays a FAILED attempt with 402 for the same key', async () => {
      const existing = paymentFixture({
        status: 'FAILED',
        providerReference: null,
        idempotencyKey: 'key-0001',
        token: 'tok_ok',
      });
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ payments: [existing] }),
      );
      const error = await service
        .payBooking(customer, 'booking-1', dto)
        .catch((e: unknown) => e);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED,
      );
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('replays the winner when a concurrent identical request lost the confirmation race', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      // CAS loses: count 0 → BookingNotPendingError inside the transaction.
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 });
      const winner = paymentFixture({
        idempotencyKey: 'key-0001',
        token: 'tok_ok',
      });
      prisma.payment.findFirst.mockResolvedValue(winner);

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { id: string };
      };
      expect(result.payment.id).toBe('payment-1');
      expect(prisma.__tx.payment.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the confirmation race is lost to a different attempt', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('compensates the provider charge when confirmation fails after charging', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(
        txBookingFixture({ bookingPassengers: [] }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.refund).toHaveBeenCalledWith({
        amount: 505,
        currency: 'EUR',
        paymentProviderReference: 'mockpay_key-0001',
      });
    });
  });

  describe('findOwnPayments', () => {
    it('returns 404 for another customer’s booking', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.findOwnPayments(customer, 'booking-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps decimals to numbers and never exposes tokens', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1' });
      prisma.payment.findMany.mockResolvedValue([paymentFixture()]);
      const [view] = (await service.findOwnPayments(
        customer,
        'booking-1',
      )) as Record<string, unknown>[];
      expect(view).toBeDefined();
      expect(view!['amount']).toBe(505);
      expect(view!).not.toHaveProperty('token');
    });
  });

  describe('refundPayment', () => {
    const adminPaymentRow = (overrides: Record<string, unknown> = {}) => ({
      ...paymentFixture(),
      booking: {
        bookingReference: 'NVAB12',
        status: 'CONFIRMED',
        contactEmail: 'customer@example.com',
      },
      ...overrides,
    });

    it('rejects a missing payment with 404', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects refunding a non-successful payment with 409', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        adminPaymentRow({ status: 'FAILED' }),
      );
      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('rejects an amount above the refundable remainder with 409', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        adminPaymentRow({
          refunds: [{ amount: 400, status: 'PROCESSED' }],
          status: 'PARTIALLY_REFUNDED',
        }),
      );
      await expect(
        service.refundPayment(financeStaff, 'payment-1', { amount: 200 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('rejects refunding an already fully refunded payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        adminPaymentRow({ refunds: [{ amount: 505, status: 'PROCESSED' }] }),
      );
      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('processes a full refund by default and marks the payment REFUNDED', async () => {
      prisma.payment.findUnique.mockResolvedValue(adminPaymentRow());
      const refundRow = {
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PROCESSED',
        reason: null,
        processedAt: new Date(),
        createdAt: new Date(),
      };
      prisma.__tx.refund.create.mockImplementation(
        ({ data }: { data: { reason?: string | null } }) => ({
          ...refundRow,
          reason: data.reason ?? null,
        }),
      );
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 505 }]);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow({ status: 'REFUNDED', refunds: [refundRow] }),
      );

      const result = (await service.refundPayment(financeStaff, 'payment-1', {
        reason: 'Customer request',
      })) as {
        refund: { amount: number; status: string };
        payment: { status: string };
      };

      expect(provider.refund).toHaveBeenCalledWith({
        amount: 505,
        currency: 'EUR',
        paymentProviderReference: 'mockpay_key-1',
        idempotencyKey: 'refund-refund-1',
        metadataRefundId: 'refund-1',
      });
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
      expect(result.refund).toMatchObject({ amount: 505, status: 'PROCESSED' });
      expect(result.payment.status).toBe('REFUNDED');
      const refundAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_COMPLETED',
      );
      expect(refundAudit).toBeDefined();
      expect(refundAudit![0].metadata).toMatchObject({
        paymentId: 'payment-1',
        refundId: 'refund-1',
        amount: 505,
        currency: 'EUR',
        reason: 'Customer request',
      });
    });

    it('marks a partial refund PARTIALLY_REFUNDED', async () => {
      prisma.payment.findUnique.mockResolvedValue(adminPaymentRow());
      prisma.__tx.refund.create.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 100,
        currency: 'EUR',
        status: 'PROCESSED',
        reason: null,
        processedAt: new Date(),
        createdAt: new Date(),
      });
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 100 }]);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow({ status: 'PARTIALLY_REFUNDED' }),
      );

      await service.refundPayment(financeStaff, 'payment-1', { amount: 100 });
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'PARTIALLY_REFUNDED' },
      });
    });

    it('rejects inside the transaction when a concurrent refund consumed the remainder — without calling the provider', async () => {
      prisma.payment.findUnique.mockResolvedValue(adminPaymentRow());
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 505 }]);
      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('counts an in-flight PENDING refund against the refundable remainder', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        adminPaymentRow({ refunds: [{ amount: 505, status: 'PENDING' }] }),
      );
      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('leaves the refund PENDING and recoverable on an ambiguous provider outcome — never REJECTED (Batch 3.4A)', async () => {
      prisma.payment.findUnique.mockResolvedValue(adminPaymentRow());
      prisma.__tx.refund.create.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PENDING',
        reason: null,
        processedAt: null,
        createdAt: new Date(),
      });
      // Timeout / connection reset / 5xx: Stripe may already have moved the money.
      provider.refund.mockRejectedValue(new Error('stripe timeout'));

      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
      // The row is left untouched: it stays PENDING, keeps reserving the
      // remainder, and is converged by resume/reconciliation — a falsely
      // REJECTED row would free the amount for a duplicate refund.
      expect(prisma.refund.update).not.toHaveBeenCalled();
      expect(prisma.__tx.refund.update).not.toHaveBeenCalled();
      expect(prisma.__tx.payment.update).not.toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
      expect(audit.log.mock.calls.map((c) => c[0].action)).not.toContain(
        'REFUND_COMPLETED',
      );
    });

    it('marks the refund REJECTED and returns 502 only on a DEFINITIVE provider rejection', async () => {
      prisma.payment.findUnique.mockResolvedValue(adminPaymentRow());
      prisma.__tx.refund.create.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PENDING',
        reason: null,
        processedAt: null,
        createdAt: new Date(),
      });
      provider.refund.mockRejectedValue(
        new ProviderDefinitiveError('charge already fully refunded'),
      );

      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { id: 'refund-1' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.__tx.payment.update).not.toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });
  });

  describe('resumeRefund', () => {
    const pendingRefund = (overrides: Record<string, unknown> = {}) => ({
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'EUR',
      status: 'PENDING',
      reason: 'Goodwill partial',
      providerReference: null,
      processedAt: null,
      createdAt: new Date(),
      ...overrides,
    });

    /** Shape of prisma.refund.findUnique with payment (+refunds,+booking) and booking included. */
    const resumeRow = (
      opts: {
        refund?: Record<string, unknown>;
        payment?: Record<string, unknown>;
        bookingStatus?: string;
      } = {},
    ) =>
      pendingRefund({
        ...opts.refund,
        payment: {
          ...paymentFixture(opts.payment),
          booking: {
            bookingReference: 'NVAB12',
            status: opts.bookingStatus ?? 'CONFIRMED',
            contactEmail: 'customer@example.com',
            fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
          },
        },
        booking: {
          bookingReference: 'NVAB12',
          contactEmail: 'customer@example.com',
        },
      });

    const adminPaymentRow = (status: string) => ({
      ...paymentFixture({ status }),
      booking: {
        bookingReference: 'NVAB12',
        status: 'CONFIRMED',
        contactEmail: 'customer@example.com',
      },
    });

    const processedAdminRow = (overrides: Record<string, unknown> = {}) => ({
      ...pendingRefund({
        status: 'PROCESSED',
        providerReference: 'mockref_mockpay_key-1_100.00',
        processedAt: new Date(),
        ...overrides,
      }),
      payment: {
        providerReference: 'mockpay_key-1',
        status: 'PARTIALLY_REFUNDED',
      },
      booking: {
        bookingReference: 'NVAB12',
        contactEmail: 'customer@example.com',
      },
    });

    it('rejects a missing refund with 404', async () => {
      prisma.refund.findUnique.mockResolvedValue(null);
      await expect(
        service.resumeRefund(financeStaff, 'refund-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('recovers a stuck PENDING refund: PROCESSED with the provider reference and payment recomputed', async () => {
      prisma.refund.findUnique.mockResolvedValue(resumeRow());
      prisma.refund.findUniqueOrThrow.mockResolvedValue(processedAdminRow());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('PARTIALLY_REFUNDED'),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);

      const result = await service.resumeRefund(financeStaff, 'refund-1');

      expect(provider.refund).toHaveBeenCalledWith({
        amount: 100,
        currency: 'EUR',
        paymentProviderReference: 'mockpay_key-1',
        idempotencyKey: 'refund-refund-1',
        metadataRefundId: 'refund-1',
      });
      expect(prisma.__tx.refund.updateMany).toHaveBeenCalledWith({
        where: { id: 'refund-1', status: 'PENDING' },
        data: {
          status: 'PROCESSED',
          processedAt: expect.any(Date),
          providerReference: 'mockref_mockpay_key-1_100.00',
        },
      });
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'PARTIALLY_REFUNDED' },
      });
      expect(result.refund).toMatchObject({
        status: 'PROCESSED',
        providerReference: 'mockref_mockpay_key-1_100.00',
      });
      expect(result.payment.status).toBe('PARTIALLY_REFUNDED');
      const refundAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_COMPLETED',
      );
      expect(refundAudit).toBeDefined();
      expect(refundAudit![0].metadata).toMatchObject({
        paymentId: 'payment-1',
        refundId: 'refund-1',
        amount: 100,
      });
    });

    it('derives the provider idempotency key from the persisted refund id — never a fresh key', async () => {
      prisma.refund.findUnique.mockResolvedValue(
        resumeRow({ refund: { id: 'refund-xyz' } }),
      );
      prisma.refund.findUniqueOrThrow.mockResolvedValue(
        processedAdminRow({ id: 'refund-xyz' }),
      );
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('PARTIALLY_REFUNDED'),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);

      await service.resumeRefund(financeStaff, 'refund-xyz');
      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'refund-refund-xyz' }),
      );
      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
    });

    it('replays an already PROCESSED refund without calling the provider', async () => {
      prisma.refund.findUnique.mockResolvedValue(
        resumeRow({
          refund: {
            status: 'PROCESSED',
            providerReference: 're_123',
            processedAt: new Date(),
          },
        }),
      );

      const result = await service.resumeRefund(financeStaff, 'refund-1');
      expect(provider.refund).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.refund).toMatchObject({
        status: 'PROCESSED',
        providerReference: 're_123',
      });
    });

    it('repeated recovery calls the provider at most once', async () => {
      prisma.refund.findUnique
        .mockResolvedValueOnce(resumeRow())
        // The ambiguous-outcome staff-alert hook performs its own refund
        // context lookup after the first (ambiguous) attempt.
        .mockResolvedValueOnce(resumeRow())
        .mockResolvedValueOnce(
          resumeRow({
            refund: {
              status: 'PROCESSED',
              providerReference: 'mockref_mockpay_key-1_100.00',
              processedAt: new Date(),
            },
          }),
        );
      prisma.refund.findUniqueOrThrow.mockResolvedValue(processedAdminRow());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('PARTIALLY_REFUNDED'),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);

      await service.resumeRefund(financeStaff, 'refund-1');
      await service.resumeRefund(financeStaff, 'refund-1');
      expect(provider.refund).toHaveBeenCalledTimes(1);
    });

    it('leaves the refund PENDING and recoverable on an ambiguous provider failure — never REJECTED', async () => {
      prisma.refund.findUnique.mockResolvedValue(resumeRow());
      provider.refund.mockRejectedValue(new Error('stripe timeout'));

      await expect(
        service.resumeRefund(financeStaff, 'refund-1'),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
      expect(prisma.refund.update).not.toHaveBeenCalled();
      expect(prisma.__tx.refund.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not resurrect a REJECTED refund (its amount was freed for a new attempt)', async () => {
      prisma.refund.findUnique.mockResolvedValue(
        resumeRow({ refund: { status: 'REJECTED' } }),
      );
      await expect(
        service.resumeRefund(financeStaff, 'refund-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('concurrent recovery: the CAS loser performs no payment update and no audit, and returns the winning state', async () => {
      prisma.refund.findUnique.mockResolvedValue(resumeRow());
      prisma.__tx.refund.updateMany.mockResolvedValue({ count: 0 });
      prisma.refund.findUniqueOrThrow.mockResolvedValue(processedAdminRow());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('PARTIALLY_REFUNDED'),
      );

      const result = await service.resumeRefund(financeStaff, 'refund-1');

      // The provider call still happened — it is idempotent by key, so the
      // same single Stripe refund backs both resumers.
      expect(provider.refund).toHaveBeenCalledTimes(1);
      expect(prisma.__tx.payment.update).not.toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: expect.any(String) },
      });
      expect(result.refund.status).toBe('PROCESSED');
      expect(
        audit.log.mock.calls.find((c) => c[0].action === 'REFUND_COMPLETED'),
      ).toBeUndefined();
    });

    it('marks the payment REFUNDED when the resumed refund completes the total', async () => {
      prisma.refund.findUnique.mockResolvedValue(
        resumeRow({ refund: { amount: 505 } }),
      );
      prisma.refund.findUniqueOrThrow.mockResolvedValue(
        processedAdminRow({ amount: 505 }),
      );
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('REFUNDED'),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 505 }]);

      await service.resumeRefund(financeStaff, 'refund-1');
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('settles a CANCELLED booking at the fare-policy target (withheld fee is not a remainder)', async () => {
      // Booking cancelled with a 10% cancellation fee: 505 × 90% = 454.50.
      prisma.refund.findUnique.mockResolvedValue(
        resumeRow({
          refund: { amount: 454.5 },
          bookingStatus: 'CANCELLED',
        }),
      );
      prisma.refund.findUniqueOrThrow.mockResolvedValue(
        processedAdminRow({ amount: 454.5 }),
      );
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('REFUNDED'),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 454.5 }]);

      await service.resumeRefund(financeStaff, 'refund-1');
      // 454.50 < 505 would be PARTIALLY_REFUNDED under the plain-total rule;
      // the policy-target rule settles the payment exactly like adminCancelBooking.
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });
  });

  describe('reconcileRefund (scheduled refund reconciliation)', () => {
    /** Same row shape recoverRefund loads (payment + refunds + booking, booking). */
    const reconRow = (refundOverrides: Record<string, unknown> = {}) => ({
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'EUR',
      status: 'PENDING',
      reason: 'Customer cancellation (REFUND_100_PERCENT)',
      providerReference: null,
      processedAt: null,
      createdAt: new Date(),
      ...refundOverrides,
      payment: {
        ...paymentFixture(),
        booking: {
          bookingReference: 'NVAB12',
          status: 'CONFIRMED',
          contactEmail: 'customer@example.com',
          fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
        },
      },
      booking: {
        bookingReference: 'NVAB12',
        contactEmail: 'customer@example.com',
      },
    });

    const processedAdminRow = () => ({
      ...reconRow({
        status: 'PROCESSED',
        providerReference: 'mockref_mockpay_key-1_100.00',
        processedAt: new Date(),
      }),
      payment: {
        providerReference: 'mockpay_key-1',
        status: 'PARTIALLY_REFUNDED',
      },
    });

    const adminPaymentRow = (status: string) => ({
      ...paymentFixture({ status }),
      booking: {
        bookingReference: 'NVAB12',
        status: 'CONFIRMED',
        contactEmail: 'customer@example.com',
      },
    });

    it('converges a stale PENDING refund to PROCESSED and audits with the System actor', async () => {
      prisma.refund.findUnique.mockResolvedValue(reconRow());
      prisma.refund.findUniqueOrThrow.mockResolvedValue(processedAdminRow());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('PARTIALLY_REFUNDED'),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);

      const outcome = await service.reconcileRefund('refund-1');

      expect(outcome).toBe('processed');
      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'refund-refund-1' }),
      );
      const refundAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_COMPLETED',
      );
      expect(refundAudit).toBeDefined();
      expect(refundAudit![0].actorType).toBe('System');
      expect(refundAudit![0].actorId).toBeUndefined();
      expect(refundAudit![0].metadata).toMatchObject({
        refundId: 'refund-1',
        via: 'reconciliation',
      });
    });

    it('returns pending on an AMBIGUOUS provider outcome — the refund stays recoverable, never REJECTED', async () => {
      prisma.refund.findUnique.mockResolvedValue(reconRow());
      provider.refund.mockRejectedValue(new Error('connection reset'));

      const outcome = await service.reconcileRefund('refund-1');

      expect(outcome).toBe('pending');
      expect(prisma.refund.update).not.toHaveBeenCalled();
      expect(prisma.__tx.refund.updateMany).not.toHaveBeenCalled();
      expect(
        audit.log.mock.calls.find((c) => c[0].action === 'REFUND_COMPLETED'),
      ).toBeUndefined();
    });

    it('returns rejected on a DEFINITIVE provider rejection — the only terminal rejection', async () => {
      prisma.refund.findUnique.mockResolvedValue(reconRow());
      prisma.refund.findUniqueOrThrow.mockResolvedValue({
        ...reconRow({ status: 'REJECTED' }),
        payment: {
          providerReference: 'mockpay_key-1',
          status: 'SUCCESS',
        },
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        adminPaymentRow('SUCCESS'),
      );
      provider.refund.mockRejectedValue(
        new ProviderDefinitiveError('charge already fully refunded'),
      );

      const outcome = await service.reconcileRefund('refund-1');

      expect(outcome).toBe('rejected');
      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { id: 'refund-1' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replays an already PROCESSED refund as processed without any provider call', async () => {
      prisma.refund.findUnique.mockResolvedValue(
        reconRow({
          status: 'PROCESSED',
          providerReference: 're_123',
          processedAt: new Date(),
        }),
      );

      const outcome = await service.reconcileRefund('refund-1');

      expect(outcome).toBe('processed');
      expect(provider.refund).not.toHaveBeenCalled();
    });
  });

  describe('adminCancelBooking', () => {
    it('rejects a missing booking with 404 and an already cancelled one with 409', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.adminCancelBooking(bookingManager, 'booking-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ status: 'CANCELLED' }),
      );
      await expect(
        service.adminCancelBooking(bookingManager, 'booking-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('cancels a PENDING booking and releases holds without any refund', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ payments: [] }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 1 });

      const result = (await service.adminCancelBooking(
        bookingManager,
        'booking-1',
        { reason: 'Customer called' },
      )) as {
        booking: unknown;
        refund: unknown;
        refundNote: unknown;
      };
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: { in: ['PENDING', 'CONFIRMED'] } },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1', status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
      expect(provider.refund).not.toHaveBeenCalled();
      expect(result.refund).toBeNull();
      expect(audit.log.mock.calls.map((c) => c[0].action)).toEqual([
        'BOOKING_CANCELLED',
        'SEAT_HOLD_RELEASED',
      ]);
    });

    it('closes open Stripe PaymentIntents for the cancelled booking after commit (Phase 3.2C)', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ payments: [] }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      const protection = vi
        .spyOn(service, 'cancelOpenIntentsForCancelledBooking')
        .mockResolvedValue(undefined);

      await service.adminCancelBooking(bookingManager, 'booking-1', {});

      // The cancellation transaction committed first; the protection ran
      // afterwards — Stripe I/O never happens inside the transaction.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(protection).toHaveBeenCalledWith('booking-1');
    });

    it('auto-refunds a CONFIRMED paid booking per the fare policy (BR-15: 10% fee of the original payment)', async () => {
      const payment = paymentFixture({ amount: 505, refunds: [] });
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED', payments: [payment] }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });
      prisma.__tx.refund.create.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 454.5,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'x',
        processedAt: null,
        createdAt: new Date(),
      });
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 454.5 }]);

      const result = (await service.adminCancelBooking(
        bookingManager,
        'booking-1',
        { reason: 'Schedule change' },
      )) as {
        refund: { amount: number } | null;
      };
      // 505 × (1 − 10%) = 454.50
      expect(provider.refund).toHaveBeenCalledWith({
        amount: 454.5,
        currency: 'EUR',
        paymentProviderReference: 'mockpay_key-1',
        idempotencyKey: 'refund-refund-1',
        metadataRefundId: 'refund-1',
      });
      expect(result.refund).toMatchObject({
        amount: 454.5,
        status: 'PROCESSED',
      });
      const actions = audit.log.mock.calls.map((c) => c[0].action);
      expect(actions).toContain('BOOKING_CANCELLED');
      expect(actions).toContain('REFUND_COMPLETED');
    });

    it('releases the BookingSeat rows of a cancelled CONFIRMED booking so the seats can be resold', async () => {
      const payment = paymentFixture({ amount: 505, refunds: [] });
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED', payments: [payment] }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });
      prisma.__tx.bookingSeat.deleteMany.mockResolvedValue({ count: 2 });
      prisma.__tx.refund.create.mockResolvedValue({ id: 'refund-1' });

      await service.adminCancelBooking(bookingManager, 'booking-1', { reason: 'Schedule change' });

      // Only this booking's seat assignments are deleted, inside the same
      // transaction as the CAS; the booking row itself is preserved.
      expect(prisma.__tx.bookingSeat.deleteMany).toHaveBeenCalledWith({
        where: { bookingPassenger: { bookingId: 'booking-1' } },
      });
      const cancelAudit = audit.log.mock.calls.find((c) => c[0].action === 'BOOKING_CANCELLED');
      expect(cancelAudit![0].metadata).toMatchObject({ releasedSeatCount: 2 });
    });

    it('keeps the booking cancelled and leaves the refund PENDING (recoverable) on an ambiguous provider outcome', async () => {
      const payment = paymentFixture({ amount: 505, refunds: [] });
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED', payments: [payment] }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });
      prisma.__tx.refund.create.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 454.5,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'x',
        processedAt: null,
        createdAt: new Date(),
      });
      // Timeout / network / 5xx: the refund may already exist at the provider.
      provider.refund.mockRejectedValue(new Error('stripe timeout'));

      const result = (await service.adminCancelBooking(
        bookingManager,
        'booking-1',
        {},
      )) as { refund: unknown; refundNote: string };
      expect(result.refund).toBeNull();
      // Honest pending language — the refund is recovered automatically; it is
      // NOT reported as rejected and never freed for a duplicate.
      expect(result.refundNote).toMatch(/pending/i);
      expect(prisma.refund.update).not.toHaveBeenCalled();
      expect(audit.log.mock.calls.map((c) => c[0].action)).not.toContain(
        'REFUND_COMPLETED',
      );
    });

    it('marks the auto-refund REJECTED and flags manual handling only on a DEFINITIVE provider rejection', async () => {
      const payment = paymentFixture({ amount: 505, refunds: [] });
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED', payments: [payment] }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });
      prisma.__tx.refund.create.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 454.5,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'x',
        processedAt: null,
        createdAt: new Date(),
      });
      provider.refund.mockRejectedValue(
        new ProviderDefinitiveError('charge already fully refunded'),
      );

      const result = (await service.adminCancelBooking(
        bookingManager,
        'booking-1',
        {},
      )) as { refund: unknown; refundNote: string };
      expect(result.refund).toBeNull();
      expect(result.refundNote).toMatch(/manually/);
      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { id: 'refund-1' },
        data: { status: 'REJECTED' },
      });
      expect(audit.log.mock.calls.map((c) => c[0].action)).not.toContain(
        'REFUND_COMPLETED',
      );
    });

    it('does not refund a non-refundable fare and explains why', async () => {
      const payment = paymentFixture({ refunds: [] });
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({
          status: 'CONFIRMED',
          payments: [payment],
          fareRulesSnapshot: {
            refundPolicy: { refundable: false, cancellationFeePercent: 100 },
          },
        }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });

      const result = (await service.adminCancelBooking(
        bookingManager,
        'booking-1',
        {},
      )) as { refund: unknown; refundNote: string };
      expect(provider.refund).not.toHaveBeenCalled();
      expect(result.refund).toBeNull();
      expect(result.refundNote).toMatch(/non-refundable/);
    });

    it('preserves payment data and notes manual handling when no policy is configured', async () => {
      const payment = paymentFixture({ refunds: [] });
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({
          status: 'CONFIRMED',
          payments: [payment],
          fareRulesSnapshot: { cabinClass: 'ECONOMY' },
        }),
      );
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.seatHold.updateMany.mockResolvedValue({ count: 0 });

      const result = (await service.adminCancelBooking(
        bookingManager,
        'booking-1',
        {},
      )) as { refund: unknown; refundNote: string };
      expect(provider.refund).not.toHaveBeenCalled();
      expect(result.refund).toBeNull();
      expect(result.refundNote).toMatch(/not configured/);
    });
  });

  describe('cancelConfirmedForCustomer (cancellation policy)', () => {
    const decision = (refundPercentage: number, reason = 'REFUND_100_PERCENT') => ({
      allowed: true,
      reason,
      refundPercentage,
      hoursUntilDeparture: 200,
    });

    const confirmedBooking = (overrides: Record<string, unknown> = {}) =>
      bookingFixture({
        status: 'CONFIRMED',
        payments: [paymentFixture({ refunds: [] })],
        ...overrides,
      });

    const pendingRefundRow = (amount: number) => ({
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount,
      currency: 'EUR',
      status: 'PENDING',
      reason: 'Customer cancellation (REFUND_100_PERCENT)',
      providerReference: null,
      processedAt: null,
      createdAt: new Date(),
    });

    const cancelledCas = () =>
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'CONFIRMED' },
        data: { status: 'CANCELLED' },
      });

    it('refunds 100% of the paid amount via the provider and settles the payment as REFUNDED', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());
      prisma.__tx.refund.create.mockResolvedValue(pendingRefundRow(505));
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 505 }]);
      const protection = vi
        .spyOn(service, 'cancelOpenIntentsForCancelledBooking')
        .mockResolvedValue(undefined);

      const view = await service.cancelConfirmedForCustomer(
        customer,
        'booking-1',
        decision(100),
      );

      cancelledCas();
      expect(provider.refund).toHaveBeenCalledWith({
        amount: 505,
        currency: 'EUR',
        paymentProviderReference: 'mockpay_key-1',
        idempotencyKey: 'refund-refund-1',
        metadataRefundId: 'refund-1',
      });
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
      expect(protection).toHaveBeenCalledWith('booking-1');
      expect(view).toBeDefined();
      const refundAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_COMPLETED',
      );
      expect(refundAudit![0].actorType).toBe('User'); // customer-initiated
      expect(refundAudit![0].metadata).toMatchObject({ amount: 505 });
    });

    it('refunds 80% (3–6 day tier) and settles as REFUNDED at the policy target', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());
      prisma.__tx.refund.create.mockResolvedValue(pendingRefundRow(404));
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 404 }]);

      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(80, 'REFUND_80_PERCENT'));

      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 404 }),
      );
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('refunds 50% (24–72h tier) and settles as REFUNDED at the policy target', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());
      prisma.__tx.refund.create.mockResolvedValue(pendingRefundRow(252.5));
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 252.5 }]);

      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(50, 'REFUND_50_PERCENT'));

      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 252.5 }),
      );
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('zero-percent decision cancels without any refund row or provider call; the payment stays SUCCESS', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());

      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(0, 'LESS_THAN_24_HOURS'));

      cancelledCas();
      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
      expect(provider.refund).not.toHaveBeenCalled();
      expect(prisma.__tx.payment.update).not.toHaveBeenCalled();
    });

    it('a confirmed booking without any payment (BR-14) cancels without refund activity', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        confirmedBooking({ payments: [] }),
      );

      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100));

      cancelledCas();
      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('refunds nothing when earlier refunds already consumed the policy target', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        confirmedBooking({
          payments: [
            paymentFixture({
              status: 'PARTIALLY_REFUNDED',
              refunds: [{ amount: 300, status: 'PROCESSED' }],
            }),
          ],
        }),
      );

      // 50% of 505 = 252.50 target; 300 already refunded → remainder 0.
      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(50, 'REFUND_50_PERCENT'));

      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('caps the refund at the remaining refundable remainder', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        confirmedBooking({
          payments: [
            paymentFixture({
              status: 'PARTIALLY_REFUNDED',
              refunds: [{ amount: 300, status: 'PROCESSED' }],
            }),
          ],
        }),
      );
      prisma.__tx.refund.create.mockResolvedValue(pendingRefundRow(205));
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([{ amount: 300 }])
        .mockResolvedValue([{ amount: 300 }, { amount: 205 }]);

      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100));

      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 205 }),
      );
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('ambiguous provider failure leaves the refund PENDING and never REJECTED (Phase 3.3 P0 rule)', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());
      prisma.__tx.refund.create.mockResolvedValue(pendingRefundRow(505));
      prisma.__tx.refund.findMany.mockResolvedValue([]);
      provider.refund.mockRejectedValue(new Error('stripe timeout'));

      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100));

      cancelledCas();
      expect(prisma.__tx.refund.update).not.toHaveBeenCalled();
      expect(prisma.refund.update).not.toHaveBeenCalled();
      expect(prisma.__tx.payment.update).not.toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('marks the refund REJECTED only on a DEFINITIVE provider rejection (Batch 3.4A)', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());
      prisma.__tx.refund.create.mockResolvedValue(pendingRefundRow(505));
      prisma.__tx.refund.findMany.mockResolvedValue([]);
      provider.refund.mockRejectedValue(
        new ProviderDefinitiveError('charge already fully refunded'),
      );

      // The cancellation itself still succeeds; only the refund is rejected.
      await service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100));

      cancelledCas();
      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { id: 'refund-1' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.__tx.payment.update).not.toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'REFUNDED' },
      });
      expect(audit.log.mock.calls.map((c) => c[0].action)).not.toContain(
        'REFUND_COMPLETED',
      );
    });

    it('rejects when the booking is modified concurrently (CAS loses)', async () => {
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking());
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('rejects a non-CONFIRMED booking with 409 and a missing booking with 404', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture({ status: 'PENDING' }));
      await expect(
        service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100)),
      ).rejects.toBeInstanceOf(ConflictException);

      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelConfirmedForCustomer(customer, 'booking-1', decision(100)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancellationPreviewForCustomer', () => {
    const previewBooking = (hoursOffset: number, overrides: Record<string, unknown> = {}) =>
      bookingFixture({
        status: 'CONFIRMED',
        payments: [paymentFixture({ refunds: [] })],
        seatHolds: [{ flight: { departureTime: new Date(Date.now() + hoursOffset * 3_600_000) } }],
        ...overrides,
      });

    it('100% tier: full refund from the authoritative paid amount, never calling the provider', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(200));

      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');

      expect(p).toMatchObject({
        allowed: true,
        reason: 'REFUND_100_PERCENT',
        refundPercentage: 100,
        refundAmount: 505,
        paidAmount: 505,
        retainedAmount: 0,
        currency: 'EUR',
      });
      expect(provider.refund).not.toHaveBeenCalled();
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('80% tier (3–6 days)', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(120));
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({
        refundPercentage: 80,
        refundAmount: 404,
        retainedAmount: 101,
      });
    });

    it('50% tier (24–72 hours)', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(48));
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({
        refundPercentage: 50,
        refundAmount: 252.5,
        retainedAmount: 252.5,
      });
    });

    it('0% tier (<24 hours): allowed with zero refund and the full amount retained', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(12));
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({
        allowed: true,
        reason: 'LESS_THAN_24_HOURS',
        refundPercentage: 0,
        refundAmount: 0,
        retainedAmount: 505,
      });
    });

    it('non-refundable fare: allowed with zero refund', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        previewBooking(200, {
          fareRulesSnapshot: { refundPolicy: { refundable: false, cancellationFeePercent: 100 } },
        }),
      );
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({
        allowed: true,
        reason: 'NON_REFUNDABLE_FARE',
        refundAmount: 0,
      });
    });

    it('missing fare policy is treated as non-refundable (never promises refunds for unknown fares)', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        previewBooking(200, { fareRulesSnapshot: null }),
      );
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p.refundAmount).toBe(0);
    });

    it('after departure: not allowed, zero refund', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(-1));
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({ allowed: false, reason: 'AFTER_DEPARTURE', refundAmount: 0 });
    });

    it('completed booking: not allowed', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(200, { status: 'CHECKED_IN' }));
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({ allowed: false, reason: 'COMPLETED_BOOKING' });
    });

    it('already cancelled: not allowed', async () => {
      prisma.booking.findFirst.mockResolvedValue(previewBooking(200, { status: 'CANCELLED' }));
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({ allowed: false, reason: 'ALREADY_CANCELLED' });
    });

    it('404s for a booking the customer does not own (owner-scoped query)', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.cancellationPreviewForCustomer(customer, 'booking-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('uses the persisted paid payment as the authoritative base — never the booking total or client values', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        previewBooking(200, { totalAmount: 999 }),
      );
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p.paidAmount).toBe(505);
      expect(p.refundAmount).toBe(505);
    });

    it('caps the preview at the remaining refundable remainder', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        previewBooking(200, {
          payments: [
            paymentFixture({
              status: 'PARTIALLY_REFUNDED',
              refunds: [{ amount: 300, status: 'PROCESSED' }],
            }),
          ],
        }),
      );
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({ refundAmount: 205, retainedAmount: 300 });
    });

    it('a PENDING booking previews as allowed with zero amounts', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        previewBooking(48, { status: 'PENDING', payments: [] }),
      );
      const p = await service.cancellationPreviewForCustomer(customer, 'booking-1');
      expect(p).toMatchObject({ allowed: true, paidAmount: 0, refundAmount: 0, retainedAmount: 0 });
    });
  });

  describe('cancellation requests (staff review)', () => {
    /** Request row as approveCancellationRequest loads it (booking + payments + refund). */
    const requestFixture = (overrides: Record<string, unknown> = {}) => ({
      id: 'cr-1',
      bookingId: 'booking-1',
      userId: 'user-1',
      status: 'PENDING',
      reason: 'Plans changed',
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      refundId: null,
      refund: null,
      booking: {
        id: 'booking-1',
        bookingReference: 'NVAB12',
        userId: 'user-1',
        status: 'CONFIRMED',
        totalAmount: 505,
        currency: 'EUR',
        bookedAt: new Date(),
        fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
        seatHolds: [
          { flight: { departureTime: new Date(Date.now() + 200 * 3_600_000) } },
        ],
        payments: [paymentFixture({ refunds: [] })],
      },
      ...overrides,
    });

    /** Row shape behind CANCELLATION_REQUEST_INCLUDE for the admin views. */
    const requestRowFixture = (overrides: Record<string, unknown> = {}) => ({
      ...requestFixture(),
      user: {
        firstName: 'Pay',
        lastName: 'Customer',
        email: 'customer@example.com',
      },
      booking: {
        ...requestFixture().booking,
        seatHolds: [
          {
            flight: {
              flightNumber: 'NV100',
              departureTime: new Date(Date.now() + 200 * 3_600_000),
              route: {
                originAirport: { iataCode: 'FRA' },
                destinationAirport: { iataCode: 'JFK' },
              },
            },
          },
        ],
      },
      ...overrides,
    });

    it('list: maps rows with booking, customer, flight, payment, live policy evaluation and refund', async () => {
      prisma.cancellationRequest.findMany.mockResolvedValue([
        requestRowFixture(),
      ]);

      const rows = await service.listCancellationRequests({});

      expect(prisma.cancellationRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: undefined },
          orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
        }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 'cr-1',
        status: 'PENDING',
        reason: 'Plans changed',
        booking: {
          id: 'booking-1',
          bookingReference: 'NVAB12',
          status: 'CONFIRMED',
          totalAmount: 505,
          currency: 'EUR',
        },
        customer: {
          firstName: 'Pay',
          lastName: 'Customer',
          email: 'customer@example.com',
        },
        flight: { flightNumber: 'NV100', originIata: 'FRA', destinationIata: 'JFK' },
        payment: { amount: 505, currency: 'EUR', status: 'SUCCESS' },
        // 200h out → 100% tier on the paid 505.
        policy: { refundPercentage: 100, refundableAmount: 505, currency: 'EUR' },
        refund: null,
      });
    });

    it('list: filters by status when given', async () => {
      prisma.cancellationRequest.findMany.mockResolvedValue([]);
      await service.listCancellationRequests({ status: 'PENDING' as never });
      expect(prisma.cancellationRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } }),
      );
    });

    it('reject: CAS PENDING→REJECTED records the review and audits it; booking untouched', async () => {
      prisma.cancellationRequest.findUniqueOrThrow.mockResolvedValue(
        requestRowFixture({ status: 'REJECTED', rejectionReason: 'Duplicate request' }),
      );

      const view = await service.rejectCancellationRequest(bookingManager, 'cr-1', {
        rejectionReason: 'Duplicate request',
      });

      expect(prisma.cancellationRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'cr-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewedBy: bookingManager.userId,
          rejectionReason: 'Duplicate request',
        }),
      });
      expect(view.status).toBe('REJECTED');
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CANCELLATION_REQUEST_REJECTED',
          actorType: 'Staff',
          targetType: 'CancellationRequest',
          targetId: 'cr-1',
        }),
      );
    });

    it('reject: a second review conflicts with 409 (CAS lost); a missing request 404s', async () => {
      prisma.cancellationRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.cancellationRequest.findUnique.mockResolvedValue({ id: 'cr-1' });
      await expect(
        service.rejectCancellationRequest(bookingManager, 'cr-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);

      prisma.cancellationRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.rejectCancellationRequest(bookingManager, 'cr-x', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('approve (refundable): records the refund PENDING under the payment lock, executes the provider refund and finalizes the booking via the hook', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(requestFixture());
      prisma.__tx.refund.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'refund-1', ...data }),
      );
      // Finalization hook: the request linked to the processed refund.
      prisma.cancellationRequest.findFirst.mockResolvedValue({
        id: 'cr-1',
        bookingId: 'booking-1',
        booking: { id: 'booking-1', status: 'CONFIRMED', bookingReference: 'NVAB12' },
      });
      prisma.refund.findUniqueOrThrow.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PROCESSED',
        reason: 'Customer cancellation request approved (REFUND_100_PERCENT)',
        providerReference: 'mockref_mockpay_key-1_505.00',
        processedAt: new Date(),
      });
      prisma.cancellationRequest.findUniqueOrThrow.mockResolvedValue(
        requestRowFixture({
          status: 'APPROVED',
          refundId: 'refund-1',
          refund: { id: 'refund-1', status: 'PROCESSED', amount: 505 },
        }),
      );

      const view = await service.approveCancellationRequest(bookingManager, 'cr-1');

      // Request CAS PENDING→APPROVED by the reviewing staff member.
      expect(prisma.__tx.cancellationRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'cr-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedBy: bookingManager.userId,
        }),
      });
      // 100% tier (200h out) of the paid 505 — recorded PENDING first.
      expect(prisma.__tx.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 'payment-1',
          bookingId: 'booking-1',
          amount: 505,
          currency: 'EUR',
          status: 'PENDING',
        }),
      });
      // Provider executes post-commit with the refund-id idempotency key.
      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'refund-refund-1' }),
      );
      // The booking is cancelled only via the finalize hook — never before.
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'CONFIRMED' },
        data: { status: 'CANCELLED' },
      });
      expect(view).toMatchObject({
        status: 'APPROVED',
        refund: { id: 'refund-1', status: 'PROCESSED', amount: 505 },
      });
      const approvedAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'CANCELLATION_REQUEST_APPROVED',
      );
      expect(approvedAudit).toBeDefined();
      expect(approvedAudit![0]).toMatchObject({
        actorId: bookingManager.userId,
        actorType: 'Staff',
        targetType: 'CancellationRequest',
        targetId: 'cr-1',
      });
      // The hook audited the booking cancellation with the System actor.
      expect(
        audit.log.mock.calls.some(
          (c) => c[0].action === 'BOOKING_CANCELLED' && c[0].actorType === 'System',
        ),
      ).toBe(true);
    });

    it('approve (zero-refundable): cancels the booking in the same transaction without any refund or provider call', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(
        requestFixture({
          booking: {
            ...requestFixture().booking,
            seatHolds: [
              { flight: { departureTime: new Date(Date.now() + 12 * 3_600_000) } },
            ],
          },
        }),
      );
      prisma.cancellationRequest.findUniqueOrThrow.mockResolvedValue(
        requestRowFixture({ status: 'APPROVED' }),
      );

      const view = await service.approveCancellationRequest(bookingManager, 'cr-1');

      expect(view.status).toBe('APPROVED');
      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
      expect(provider.refund).not.toHaveBeenCalled();
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'CONFIRMED' },
        data: { status: 'CANCELLED' },
      });
      expect(
        audit.log.mock.calls.some((c) => c[0].action === 'BOOKING_CANCELLED'),
      ).toBe(true);
      expect(
        audit.log.mock.calls.some(
          (c) => c[0].action === 'CANCELLATION_REQUEST_APPROVED',
        ),
      ).toBe(true);
    });

    it('approve: an APPROVED request with a live refund conflicts — no second refund attempt', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(
        requestFixture({
          status: 'APPROVED',
          refundId: 'refund-1',
          refund: { id: 'refund-1', status: 'PENDING' },
        }),
      );

      await expect(
        service.approveCancellationRequest(bookingManager, 'cr-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('approve: a REJECTED request can never be approved', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(
        requestFixture({ status: 'REJECTED' }),
      );
      await expect(
        service.approveCancellationRequest(bookingManager, 'cr-1'),
      ).rejects.toThrow(/rejected cancellation request/i);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('approve: a missing request 404s and a lost review CAS conflicts', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.approveCancellationRequest(bookingManager, 'cr-x'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.cancellationRequest.findUnique.mockResolvedValue(requestFixture());
      prisma.__tx.cancellationRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.approveCancellationRequest(bookingManager, 'cr-1'),
      ).rejects.toThrow(/already reviewed/);
      expect(prisma.__tx.refund.create).not.toHaveBeenCalled();
    });

    it('approve: an APPROVED request whose refund was definitively REJECTED retries with a fresh refund', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(
        requestFixture({
          status: 'APPROVED',
          refundId: 'refund-old',
          refund: { id: 'refund-old', status: 'REJECTED' },
        }),
      );
      prisma.__tx.refund.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'refund-new', ...data }),
      );
      prisma.refund.findUniqueOrThrow.mockResolvedValue({
        id: 'refund-new',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PROCESSED',
        reason: 'Customer cancellation request approved (REFUND_100_PERCENT)',
        providerReference: 'mockref_mockpay_key-1_505.00',
        processedAt: new Date(),
      });
      prisma.cancellationRequest.findUniqueOrThrow.mockResolvedValue(
        requestRowFixture({
          status: 'APPROVED',
          refundId: 'refund-new',
          refund: { id: 'refund-new', status: 'PROCESSED', amount: 505 },
        }),
      );

      await service.approveCancellationRequest(bookingManager, 'cr-1');

      // No PENDING→APPROVED CAS on the retry — the request is already APPROVED.
      expect(prisma.__tx.cancellationRequest.updateMany).not.toHaveBeenCalled();
      expect(prisma.__tx.cancellationRequest.update).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        data: expect.objectContaining({ reviewedBy: bookingManager.userId }),
      });
      // A FRESH refund attempt with its own provider idempotency identity.
      expect(prisma.__tx.refund.create).toHaveBeenCalledTimes(1);
      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'refund-refund-new' }),
      );
    });

    it('approve: an ambiguous provider outcome leaves the refund PENDING and the booking CONFIRMED — recoverable, never REJECTED', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(requestFixture());
      prisma.__tx.refund.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'refund-1', ...data }),
      );
      provider.refund.mockRejectedValueOnce(new Error('connection reset'));
      prisma.cancellationRequest.findUniqueOrThrow.mockResolvedValue(
        requestRowFixture({
          status: 'APPROVED',
          refundId: 'refund-1',
          refund: { id: 'refund-1', status: 'PENDING', amount: 505 },
        }),
      );

      const view = await service.approveCancellationRequest(bookingManager, 'cr-1');

      expect(prisma.refund.update).not.toHaveBeenCalled();
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(view.refund).toMatchObject({ id: 'refund-1', status: 'PENDING' });
      expect(metrics.snapshot().counters[REFUND_COUNTERS.ambiguousOutcomes]).toBe(1);
    });

    it('approve: a definitive provider rejection marks only the refund REJECTED — booking CONFIRMED, request APPROVED (retryable)', async () => {
      prisma.cancellationRequest.findUnique.mockResolvedValue(requestFixture());
      prisma.__tx.refund.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'refund-1', ...data }),
      );
      provider.refund.mockRejectedValueOnce(
        new ProviderDefinitiveError('charge already fully refunded'),
      );
      prisma.cancellationRequest.findUniqueOrThrow.mockResolvedValue(
        requestRowFixture({
          status: 'APPROVED',
          refundId: 'refund-1',
          refund: { id: 'refund-1', status: 'REJECTED', amount: 505 },
        }),
      );

      const view = await service.approveCancellationRequest(bookingManager, 'cr-1');

      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { id: 'refund-1' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(view).toMatchObject({
        status: 'APPROVED',
        refund: { id: 'refund-1', status: 'REJECTED' },
      });
    });

    it('finalization hook: a refund without a linked request never touches the booking', async () => {
      // Recovery of an ordinary goodwill refund (no cancellation request).
      prisma.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 100,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Goodwill partial',
        providerReference: null,
        processedAt: null,
        createdAt: new Date(),
        payment: {
          ...paymentFixture({ refunds: [] }),
          booking: {
            bookingReference: 'NVAB12',
            status: 'CONFIRMED',
            contactEmail: 'customer@example.com',
            fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
          },
        },
        booking: { bookingReference: 'NVAB12', contactEmail: 'customer@example.com' },
      });
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);
      prisma.refund.findUniqueOrThrow.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 100,
        currency: 'EUR',
        status: 'PROCESSED',
        reason: 'Goodwill partial',
        providerReference: 'mockref_mockpay_key-1_100.00',
        processedAt: new Date(),
        payment: { providerReference: 'mockpay_key-1', status: 'PARTIALLY_REFUNDED' },
        booking: { bookingReference: 'NVAB12', contactEmail: 'customer@example.com' },
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        ...paymentFixture({ status: 'PARTIALLY_REFUNDED' }),
        booking: {
          bookingReference: 'NVAB12',
          status: 'CONFIRMED',
          contactEmail: 'customer@example.com',
        },
      });

      await service.resumeRefund(financeStaff, 'refund-1');

      // The hook looked up the link and found nothing — no cancellation.
      expect(prisma.cancellationRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { refundId: 'refund-1' } }),
      );
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(
        audit.log.mock.calls.some((c) => c[0].action === 'BOOKING_CANCELLED'),
      ).toBe(false);
    });

    it('finalization hook: a recovered request-linked refund cancels the still-CONFIRMED booking', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PENDING',
        reason: 'Customer cancellation request approved (REFUND_100_PERCENT)',
        providerReference: null,
        processedAt: null,
        createdAt: new Date(),
        payment: {
          ...paymentFixture({ refunds: [] }),
          booking: {
            bookingReference: 'NVAB12',
            status: 'CONFIRMED',
            contactEmail: 'customer@example.com',
            fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
          },
        },
        booking: { bookingReference: 'NVAB12', contactEmail: 'customer@example.com' },
      });
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 505 }]);
      prisma.refund.findUniqueOrThrow.mockResolvedValue({
        id: 'refund-1',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 505,
        currency: 'EUR',
        status: 'PROCESSED',
        reason: 'Customer cancellation request approved (REFUND_100_PERCENT)',
        providerReference: 'mockref_mockpay_key-1_505.00',
        processedAt: new Date(),
        payment: { providerReference: 'mockpay_key-1', status: 'REFUNDED' },
        booking: { bookingReference: 'NVAB12', contactEmail: 'customer@example.com' },
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        ...paymentFixture({ status: 'REFUNDED' }),
        booking: {
          bookingReference: 'NVAB12',
          status: 'CONFIRMED',
          contactEmail: 'customer@example.com',
        },
      });
      // The hook finds the approved request linked to this refund.
      prisma.cancellationRequest.findFirst.mockResolvedValue({
        id: 'cr-1',
        bookingId: 'booking-1',
        booking: { id: 'booking-1', status: 'CONFIRMED', bookingReference: 'NVAB12' },
      });

      await service.resumeRefund(financeStaff, 'refund-1');

      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'CONFIRMED' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.__tx.bookingSeat.deleteMany).toHaveBeenCalledWith({
        where: { bookingPassenger: { bookingId: 'booking-1' } },
      });
      expect(
        audit.log.mock.calls.some(
          (c) => c[0].action === 'BOOKING_CANCELLED' && c[0].actorType === 'System',
        ),
      ).toBe(true);
    });
  });

  describe('confirmBookingException (BR-14)', () => {
    it('rejects a non-pending booking with 409', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED' }),
      );
      await expect(
        service.confirmBookingException(bookingManager, 'booking-1', {
          reason: 'Group booking contract override',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('confirms without creating any payment and audits the reason', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingFixture());
      prisma.__tx.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(
        txBookingFixture(),
      );

      await service.confirmBookingException(bookingManager, 'booking-1', {
        reason: 'Group booking contract override',
      });

      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'PENDING' },
        data: { status: 'CONFIRMED' },
      });
      expect(prisma.__tx.payment.create).not.toHaveBeenCalled();
      expect(provider.charge).not.toHaveBeenCalled();
      const br14 = audit.log.mock.calls.find(
        (c) => c[0].action === 'BR14_PAYMENT_EXCEPTION',
      );
      expect(br14).toBeDefined();
      expect(br14![0].actorType).toBe('Staff');
      expect(br14![0].metadata).toMatchObject({
        bookingReference: 'NVAB12',
        reason: 'Group booking contract override',
        holdCount: 1,
      });
    });
  });

  describe('findRefundsAdmin (operational visibility, Phase 3.4D)', () => {
    const opsRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'EUR',
      status: 'PENDING',
      reason: 'Customer cancellation',
      providerReference: null,
      processedAt: null,
      createdAt: new Date(Date.now() - 12 * 60_000),
      updatedAt: new Date(),
      payment: { providerReference: 'mockpay_key-1', status: 'SUCCESS' },
      booking: {
        bookingReference: 'NVAB12',
        contactEmail: 'customer@example.com',
      },
      ...overrides,
    });

    const baseQuery = {
      page: 1,
      limit: 20,
    };

    it('returns a paginated envelope with aging/recovery fields and never exposes secrets', async () => {
      prisma.refund.findMany.mockResolvedValue([opsRow()]);
      prisma.refund.count.mockResolvedValue(1);

      const result = await service.findRefundsAdmin(baseQuery);

      expect(result).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      const row = result.items[0]!;
      expect(row).toMatchObject({
        id: 'refund-1',
        status: 'PENDING',
        amount: 100,
        currency: 'EUR',
        bookingReference: 'NVAB12',
        paymentProviderReference: 'mockpay_key-1',
        pendingAgeMinutes: 12,
        // Older than the 5-minute sweep age → recovery is due/working.
        pendingRecovery: true,
        recoveryKey: 'refund-refund-1',
      });
      expect(row.updatedAt).toBeDefined();
      expect(JSON.stringify(row)).not.toMatch(/tok_|secret|sk_live|sk_test/);
    });

    it('a fresh PENDING refund is not yet pendingRecovery; non-pending rows carry no age', async () => {
      prisma.refund.findMany.mockResolvedValue([
        opsRow({ createdAt: new Date() }),
        opsRow({ id: 'refund-2', status: 'PROCESSED', processedAt: new Date() }),
      ]);
      prisma.refund.count.mockResolvedValue(2);

      const result = await service.findRefundsAdmin(baseQuery);

      expect(result.items[0]).toMatchObject({
        pendingAgeMinutes: 0,
        pendingRecovery: false,
      });
      expect(result.items[1]).toMatchObject({
        status: 'PROCESSED',
        pendingAgeMinutes: null,
        pendingRecovery: false,
      });
    });

    it('pendingMinAgeMinutes forces status=PENDING and an upper createdAt bound', async () => {
      prisma.refund.findMany.mockResolvedValue([]);
      prisma.refund.count.mockResolvedValue(0);

      await service.findRefundsAdmin({
        ...baseQuery,
        status: 'PROCESSED' as never, // contradictory on purpose
        pendingMinAgeMinutes: 15,
      });

      const where = prisma.refund.findMany.mock.calls[0]![0].where;
      expect(where.status).toBe('PENDING');
      const lte = where.createdAt.lte as Date;
      expect(lte.getTime()).toBeLessThanOrEqual(Date.now() - 15 * 60_000);
      expect(lte.getTime()).toBeGreaterThan(Date.now() - 16 * 60_000);
    });

    it('applies reference filters: booking reference upper-cased, provider reference matched on refund OR payment', async () => {
      prisma.refund.findMany.mockResolvedValue([]);
      prisma.refund.count.mockResolvedValue(0);

      await service.findRefundsAdmin({
        ...baseQuery,
        bookingReference: 'nvab12',
        providerReference: 're_123',
        paymentId: '11111111-1111-4111-8111-111111111111',
        refundId: '22222222-2222-4222-8222-222222222222',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-06T23:59:59.000Z',
      });

      const where = prisma.refund.findMany.mock.calls[0]![0].where;
      expect(where.booking).toEqual({ bookingReference: 'NVAB12' });
      expect(where.OR).toEqual([
        { providerReference: 're_123' },
        { payment: { providerReference: 're_123' } },
      ]);
      expect(where.paymentId).toBe('11111111-1111-4111-8111-111111111111');
      expect(where.id).toBe('22222222-2222-4222-8222-222222222222');
      expect(where.createdAt.gte).toEqual(new Date('2026-10-01T00:00:00.000Z'));
      expect(where.createdAt.lte).toEqual(new Date('2026-10-06T23:59:59.000Z'));
    });

    it('paginates with skip/take from page/limit', async () => {
      prisma.refund.findMany.mockResolvedValue([]);
      prisma.refund.count.mockResolvedValue(45);

      const result = await service.findRefundsAdmin({ page: 3, limit: 20 });

      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result).toMatchObject({ page: 3, total: 45, totalPages: 3 });
    });
  });

  describe('getRefundOperations (Phase 3.4D/3.4F)', () => {
    const pendingAt = (ageMinutes: number) => ({
      createdAt: new Date(Date.now() - ageMinutes * 60_000),
    });

    it('buckets pending refunds by age and counts stuck beyond the threshold', async () => {
      prisma.refund.findMany.mockResolvedValue([
        pendingAt(2), // lt5m
        pendingAt(10), // m5to15
        pendingAt(30), // m15to60
        pendingAt(120), // h1to6
        pendingAt(720), // h6to24
        pendingAt(2000), // gt24h
      ]);
      prisma.orphanProviderRefund.count.mockResolvedValue(3);

      const ops = await service.getRefundOperations();

      expect(ops.pending).toMatchObject({
        total: 6,
        buckets: { lt5m: 1, m5to15: 1, m15to60: 1, h1to6: 1, h6to24: 1, gt24h: 1 },
        // Default alert threshold: 60 minutes → the 120/720/2000-minute rows.
        stuckThresholdMinutes: 60,
        stuck: 3,
      });
      expect(ops.orphans).toEqual({ unmatched: 3 });
      expect(ops.metrics.gauges['refunds_pending']).toBe(6);
      expect(ops.metrics.gauges['refunds_pending_stuck']).toBe(3);
      expect(ops.metrics.gauges['refund_orphans_unmatched']).toBe(3);
      expect(ops.alerts.active).toEqual([]);
      expect(ops.generatedAt).toBeDefined();
    });
  });

  describe('discoverProviderRefundsForPayment (orphan discovery, Phase 3.4E)', () => {
    const discoveryPayment = (refunds: unknown[], overrides: Record<string, unknown> = {}) => ({
      ...paymentFixture({ status: 'SUCCESS', refunds, ...overrides }),
      booking: {
        bookingReference: 'NVAB12',
        status: 'CONFIRMED',
        fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
      },
    });

    const localRefund = (overrides: Record<string, unknown> = {}) => ({
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'EUR',
      status: 'PENDING',
      reason: 'x',
      providerReference: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    const found = (overrides: Record<string, unknown> = {}) => ({
      providerReference: 're_1',
      amountCents: 10000,
      currency: 'EUR',
      metadataRefundId: null,
      ...overrides,
    });

    it('is a no-op for ineligible payments (no reference, foreign provider, unpaid)', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        discoveryPayment([], { providerReference: null }),
      );
      const result = await service.discoverProviderRefundsForPayment('payment-1');
      expect(result).toEqual({ checked: false, adopted: 0, unmatchedNew: 0 });
      expect(provider.listRefundsForPayment).not.toHaveBeenCalled();
    });

    it('adopts a PENDING local refund via a strong metadata match — no provider mutation', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        discoveryPayment([localRefund()]),
      );
      provider.listRefundsForPayment.mockResolvedValue([
        found({ metadataRefundId: 'refund-1' }),
      ]);
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(provider.listRefundsForPayment).toHaveBeenCalledWith('mockpay_key-1');
      expect(result).toEqual({ checked: true, adopted: 1, unmatchedNew: 0 });
      // Converged through the Batch 1 finalization: CAS + payment recompute,
      // NEVER a second provider refund.
      expect(prisma.__tx.refund.updateMany).toHaveBeenCalledWith({
        where: { id: 'refund-1', status: 'PENDING' },
        data: {
          status: 'PROCESSED',
          processedAt: expect.any(Date),
          providerReference: 're_1',
        },
      });
      expect(prisma.__tx.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'PARTIALLY_REFUNDED' },
      });
      expect(provider.refund).not.toHaveBeenCalled();
      const audit1 = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_COMPLETED',
      );
      expect(audit1![0].metadata).toMatchObject({ via: 'orphan-discovery' });
      expect(metrics.snapshot().counters[REFUND_COUNTERS.orphansAdopted]).toBe(1);
    });

    it('a CAS loss during adoption leaves outcomes honest (not adopted, no audit)', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        discoveryPayment([localRefund()]),
      );
      provider.listRefundsForPayment.mockResolvedValue([
        found({ metadataRefundId: 'refund-1' }),
      ]);
      prisma.__tx.refund.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(result).toEqual({ checked: true, adopted: 0, unmatchedNew: 0 });
      expect(
        audit.log.mock.calls.find((c) => c[0].action === 'REFUND_COMPLETED'),
      ).toBeUndefined();
    });

    it('matches an already-recorded provider reference without any state change', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        discoveryPayment([
          localRefund({ status: 'PROCESSED', providerReference: 're_1' }),
        ]),
      );
      provider.listRefundsForPayment.mockResolvedValue([found()]);

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(result).toEqual({ checked: true, adopted: 0, unmatchedNew: 0 });
      expect(prisma.orphanProviderRefund.create).not.toHaveBeenCalled();
      expect(prisma.__tx.refund.updateMany).not.toHaveBeenCalled();
    });

    it('flags an unmatched provider refund as an orphan — never guessed, never re-refunded', async () => {
      prisma.payment.findUnique.mockResolvedValue(discoveryPayment([]));
      provider.listRefundsForPayment.mockResolvedValue([
        found({ providerReference: 're_mystery', amountCents: 45450 }),
      ]);
      prisma.orphanProviderRefund.create.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'orphan-1', ...args.data }),
      );

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(result).toEqual({ checked: true, adopted: 0, unmatchedNew: 1 });
      expect(prisma.orphanProviderRefund.create).toHaveBeenCalledWith({
        data: {
          provider: 'mock',
          providerRefundReference: 're_mystery',
          paymentProviderReference: 'mockpay_key-1',
          amount: 454.5,
          currency: 'EUR',
          lastSeenAt: expect.any(Date),
        },
      });
      expect(provider.refund).not.toHaveBeenCalled();
      const orphanAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_ORPHAN_DISCOVERED',
      );
      expect(orphanAudit).toBeDefined();
      expect(orphanAudit![0].metadata).toMatchObject({
        providerRefundReference: 're_mystery',
        paymentProviderReference: 'mockpay_key-1',
      });
      expect(metrics.snapshot().counters[REFUND_COUNTERS.orphansDiscovered]).toBe(1);
    });

    it('duplicate discovery is idempotent: P2002 refreshes the sighting, no duplicate row/audit', async () => {
      prisma.payment.findUnique.mockResolvedValue(discoveryPayment([]));
      provider.listRefundsForPayment.mockResolvedValue([
        found({ providerReference: 're_mystery' }),
      ]);
      prisma.orphanProviderRefund.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(result).toEqual({ checked: true, adopted: 0, unmatchedNew: 0 });
      expect(prisma.orphanProviderRefund.update).toHaveBeenCalledWith({
        where: {
          provider_providerRefundReference: {
            provider: 'mock',
            providerRefundReference: 're_mystery',
          },
        },
        data: { lastSeenAt: expect.any(Date) },
      });
      expect(
        audit.log.mock.calls.find(
          (c) => c[0].action === 'REFUND_ORPHAN_DISCOVERED',
        ),
      ).toBeUndefined();
    });

    it('flags an orphan when the metadata owner is REJECTED (contradiction worth investigating)', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        discoveryPayment([localRefund({ status: 'REJECTED' })]),
      );
      provider.listRefundsForPayment.mockResolvedValue([
        found({ metadataRefundId: 'refund-1' }),
      ]);
      prisma.orphanProviderRefund.create.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'orphan-1', ...args.data }),
      );

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(result.unmatchedNew).toBe(1);
      expect(result.adopted).toBe(0);
      expect(prisma.__tx.refund.updateMany).not.toHaveBeenCalled();
    });

    it('auto-resolves earlier orphans whose provider reference is now recorded locally', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        discoveryPayment([
          localRefund({ status: 'PROCESSED', providerReference: 're_1' }),
        ]),
      );
      provider.listRefundsForPayment.mockResolvedValue([found()]);
      prisma.orphanProviderRefund.findMany.mockResolvedValue([
        {
          id: 'orphan-1',
          provider: 'mock',
          providerRefundReference: 're_1',
          paymentProviderReference: 'mockpay_key-1',
          status: 'UNMATCHED',
        },
      ]);
      prisma.orphanProviderRefund.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.discoverProviderRefundsForPayment('payment-1');

      expect(result).toEqual({ checked: true, adopted: 0, unmatchedNew: 0 });
      expect(prisma.orphanProviderRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'orphan-1', status: 'UNMATCHED' },
        data: { status: 'RESOLVED', resolvedAt: expect.any(Date) },
      });
      const resolvedAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_ORPHAN_RESOLVED',
      );
      expect(resolvedAudit).toBeDefined();
      expect(resolvedAudit![0].actorType).toBe('System');
    });

    it('a failed provider lookup propagates without any local state change', async () => {
      prisma.payment.findUnique.mockResolvedValue(discoveryPayment([]));
      provider.listRefundsForPayment.mockRejectedValue(
        new Error('stripe timeout'),
      );

      await expect(
        service.discoverProviderRefundsForPayment('payment-1'),
      ).rejects.toThrow('stripe timeout');
      expect(prisma.orphanProviderRefund.create).not.toHaveBeenCalled();
      expect(prisma.__tx.refund.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('resolveOrphanRefund (Phase 3.4E)', () => {
    const orphanRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'orphan-1',
      provider: 'stripe',
      providerRefundReference: 're_1',
      paymentProviderReference: 'pi_1',
      amount: 100,
      currency: 'EUR',
      status: 'UNMATCHED',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('404s for an unknown orphan', async () => {
      prisma.orphanProviderRefund.findUnique.mockResolvedValue(null);
      await expect(
        service.resolveOrphanRefund(financeStaff, 'orphan-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves with the staff identity and audits it', async () => {
      prisma.orphanProviderRefund.findUnique.mockResolvedValue(orphanRow());
      prisma.orphanProviderRefund.updateMany.mockResolvedValue({ count: 1 });
      prisma.orphanProviderRefund.findUniqueOrThrow.mockResolvedValue(
        orphanRow({ status: 'RESOLVED', resolvedAt: new Date() }),
      );

      const result = await service.resolveOrphanRefund(
        financeStaff,
        'orphan-1',
        'Verified in the Stripe dashboard — manual goodwill refund',
      );

      expect(prisma.orphanProviderRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'orphan-1', status: 'UNMATCHED' },
        data: {
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
          resolvedBy: 'staff-1',
          resolutionNote:
            'Verified in the Stripe dashboard — manual goodwill refund',
        },
      });
      expect(result.status).toBe('RESOLVED');
      const resolvedAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_ORPHAN_RESOLVED',
      );
      expect(resolvedAudit![0]).toMatchObject({
        actorId: 'staff-1',
        actorType: 'Staff',
      });
    });

    it('replays an already-resolved orphan without a state change or audit', async () => {
      prisma.orphanProviderRefund.findUnique.mockResolvedValue(
        orphanRow({ status: 'RESOLVED', resolvedAt: new Date() }),
      );
      prisma.orphanProviderRefund.findUniqueOrThrow.mockResolvedValue(
        orphanRow({ status: 'RESOLVED', resolvedAt: new Date() }),
      );

      await service.resolveOrphanRefund(financeStaff, 'orphan-1');

      expect(prisma.orphanProviderRefund.updateMany).not.toHaveBeenCalled();
      expect(
        audit.log.mock.calls.find(
          (c) => c[0].action === 'REFUND_ORPHAN_RESOLVED',
        ),
      ).toBeUndefined();
    });
  });

  describe('refund metrics hooks (Phase 3.4F)', () => {
    const refundablePaymentRow = (overrides: Record<string, unknown> = {}) => ({
      ...paymentFixture(overrides),
      booking: {
        bookingReference: 'NVAB12',
        status: 'CONFIRMED',
        contactEmail: 'customer@example.com',
      },
    });

    const createdRefundRow = {
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount: 505,
      currency: 'EUR',
      status: 'PENDING',
      reason: null,
      processedAt: null,
      createdAt: new Date(),
    };

    const pendingResumeRow = () => ({
      id: 'refund-1',
      paymentId: 'payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'EUR',
      status: 'PENDING',
      reason: 'x',
      providerReference: null,
      processedAt: null,
      createdAt: new Date(),
      payment: {
        ...paymentFixture(),
        booking: {
          bookingReference: 'NVAB12',
          status: 'CONFIRMED',
          contactEmail: 'customer@example.com',
          fareRulesSnapshot: bookingFixture().fareRulesSnapshot,
        },
      },
      booking: {
        bookingReference: 'NVAB12',
        contactEmail: 'customer@example.com',
      },
    });

    const processedResumeRow = () => ({
      ...pendingResumeRow(),
      status: 'PROCESSED',
      providerReference: 'mockref_mockpay_key-1_100.00',
      processedAt: new Date(),
      payment: {
        providerReference: 'mockpay_key-1',
        status: 'PARTIALLY_REFUNDED',
      },
    });

    it('counts a created + processed refund in the staff refund flow', async () => {
      prisma.payment.findUnique.mockResolvedValue(refundablePaymentRow());
      prisma.__tx.refund.create.mockResolvedValue(createdRefundRow);
      prisma.__tx.refund.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ amount: 505 }]);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        refundablePaymentRow({ status: 'REFUNDED' }),
      );

      await service.refundPayment(financeStaff, 'payment-1', {});

      const counters = metrics.snapshot().counters;
      expect(counters[REFUND_COUNTERS.created]).toBe(1);
      expect(counters[REFUND_COUNTERS.processed]).toBe(1);
      expect(counters[REFUND_COUNTERS.rejected]).toBe(0);
      expect(counters[REFUND_COUNTERS.ambiguousOutcomes]).toBe(0);
    });

    it('counts an ambiguous provider outcome without a rejection', async () => {
      prisma.payment.findUnique.mockResolvedValue(refundablePaymentRow());
      prisma.__tx.refund.create.mockResolvedValue(createdRefundRow);
      prisma.__tx.refund.findMany.mockResolvedValue([]);
      provider.refund.mockRejectedValue(new Error('stripe timeout'));

      await expect(
        service.refundPayment(financeStaff, 'payment-1', {}),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });

      const counters = metrics.snapshot().counters;
      expect(counters[REFUND_COUNTERS.created]).toBe(1);
      expect(counters[REFUND_COUNTERS.ambiguousOutcomes]).toBe(1);
      expect(counters[REFUND_COUNTERS.rejected]).toBe(0);
      expect(counters[REFUND_COUNTERS.processed]).toBe(0);
    });

    it('counts recovery attempt + success and audits the manual recovery outcome', async () => {
      prisma.refund.findUnique.mockResolvedValue(pendingResumeRow());
      prisma.refund.findUniqueOrThrow.mockResolvedValue(processedResumeRow());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        refundablePaymentRow({ status: 'PARTIALLY_REFUNDED' }),
      );
      prisma.__tx.refund.findMany.mockResolvedValue([{ amount: 100 }]);

      await service.resumeRefund(financeStaff, 'refund-1');

      const counters = metrics.snapshot().counters;
      expect(counters[REFUND_COUNTERS.recoveryAttempts]).toBe(1);
      expect(counters[REFUND_COUNTERS.recoveryProcessed]).toBe(1);
      expect(counters[REFUND_COUNTERS.processed]).toBe(1);
      const recoveryAudit = audit.log.mock.calls.find(
        (c) => c[0].action === 'REFUND_RECOVERY_REQUESTED',
      );
      expect(recoveryAudit).toBeDefined();
      expect(recoveryAudit![0]).toMatchObject({
        actorId: 'staff-1',
        actorType: 'Staff',
        targetType: 'Refund',
        targetId: 'refund-1',
      });
      expect(recoveryAudit![0].metadata).toMatchObject({
        outcome: 'processed',
      });
    });
  });
});
