import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payment-provider';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';

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
    },
  };
  return {
    booking: { findFirst: vi.fn(), findUnique: vi.fn() },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    refund: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
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
  };
  let bookings: { getBookingView: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };

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
    };
    bookings = {
      getBookingView: vi
        .fn()
        .mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' }),
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: BookingsService, useValue: bookings },
        { provide: PAYMENT_PROVIDER, useValue: provider },
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

    it('marks the refund REJECTED and returns 502 when the provider refund fails', async () => {
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
      provider.refund.mockRejectedValue(new Error('provider unavailable'));

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

    it('keeps the booking cancelled and flags manual handling when the provider refund fails', async () => {
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
      provider.refund.mockRejectedValue(new Error('provider unavailable'));

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
});
