import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import {
  PAYMENT_PROVIDER,
  type PaymentIntentSnapshot,
} from './payment-provider';
import { RefundMetricsService } from './refund-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

/**
 * Stripe-mode PaymentIntent flow (payBooking dispatch on provider capability).
 * Prisma is mocked in the same style as payments.service.spec.ts; the provider
 * is a PaymentIntentProvider double.
 */

const customer = {
  userId: 'user-1',
  email: 'customer@example.com',
  roles: ['Customer'],
  permissions: [],
};

const future = () => new Date(Date.now() + 10 * 60_000);

const bookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  bookingReference: 'NVAB12',
  userId: 'user-1',
  status: 'PENDING',
  totalAmount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  contactEmail: 'customer@example.com',
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

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  status: 'PENDING',
  provider: 'stripe',
  providerReference: 'pi_123',
  providerStatus: 'requires_payment_method',
  token: null,
  idempotencyKey: 'key-0001',
  paidAt: null,
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  refunds: [] as unknown[],
  ...overrides,
});

const snapshot = (
  overrides: Partial<PaymentIntentSnapshot> = {},
): PaymentIntentSnapshot => ({
  providerReference: 'pi_123',
  status: 'requires_payment_method',
  clientSecret: 'pi_123_secret_abc',
  amountCents: 50500,
  currency: 'EUR',
  ...overrides,
});

const createMockPrisma = () => {
  const tx = {
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    booking: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn(),
    },
    flightSegment: { findMany: vi.fn().mockResolvedValue([{ id: 'seg-1' }]) },
    bookingSeat: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refund: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    paymentWebhookEvent: { update: vi.fn().mockResolvedValue({}) },
  };
  return {
    booking: { findFirst: vi.fn(), findUnique: vi.fn() },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    refund: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

const dto = { idempotencyKey: 'key-0001' } as {
  token?: string;
  idempotencyKey: string;
};

describe('PaymentsService — PaymentIntent flow (stripe mode)', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let provider: {
    name: string;
    charge: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    createPaymentIntent: ReturnType<typeof vi.fn>;
    retrievePaymentIntent: ReturnType<typeof vi.fn>;
    cancelPaymentIntent: ReturnType<typeof vi.fn>;
    constructWebhookEvent: ReturnType<typeof vi.fn>;
  };
  let bookings: { getBookingView: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };
  let realtime: { emitPaymentStatus: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    provider = {
      name: 'stripe',
      charge: vi.fn(),
      refund: vi.fn(),
      createPaymentIntent: vi.fn().mockResolvedValue(snapshot()),
      retrievePaymentIntent: vi.fn().mockResolvedValue(snapshot()),
      cancelPaymentIntent: vi.fn(),
      constructWebhookEvent: vi.fn(),
    };
    bookings = {
      getBookingView: vi.fn().mockResolvedValue({ id: 'booking-1' }),
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    realtime = { emitPaymentStatus: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: BookingsService, useValue: bookings },
        { provide: PAYMENT_PROVIDER, useValue: provider },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
        { provide: RefundMetricsService, useValue: new RefundMetricsService() },
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

  describe('create path', () => {
    it('creates a PENDING payment and a PaymentIntent with the booking-derived amount — and does NOT confirm the booking', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      const created = paymentFixture({ providerReference: null });
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        status: 'PENDING',
        payments: [],
      });
      prisma.__tx.payment.create.mockResolvedValue(created);
      prisma.payment.update.mockResolvedValue({
        ...created,
        providerReference: 'pi_123',
      });

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { status: string };
        paymentIntent: {
          clientSecret: string | null;
          status: string;
          requiresAction: boolean;
        };
      };

      // Amount derived from the persisted booking total: 505.00 EUR → 50500.
      expect(provider.createPaymentIntent).toHaveBeenCalledWith({
        amountCents: 50500,
        currency: 'EUR',
        idempotencyKey: 'payment-1',
        bookingReference: 'NVAB12',
        paymentId: 'payment-1',
      });
      expect(result.payment.status).toBe('PENDING');
      expect(result.paymentIntent).toEqual({
        clientSecret: 'pi_123_secret_abc',
        status: 'requires_payment_method',
        requiresAction: false,
      });
      // PaymentIntent creation is not payment success — no confirmation work.
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(provider.charge).not.toHaveBeenCalled();
    });

    it('resumes the existing open payment for a different key instead of creating a second intent', async () => {
      const open = paymentFixture({ idempotencyKey: 'key-original' });
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        status: 'PENDING',
        payments: [open],
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue(open);

      const result = (await service.payBooking(customer, 'booking-1', {
        idempotencyKey: 'key-other-999',
      })) as { payment: { id: string }; paymentIntent: { clientSecret: string } };

      // No second payment row, no second PaymentIntent — the open attempt is resumed.
      expect(prisma.__tx.payment.create).not.toHaveBeenCalled();
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
      expect(provider.retrievePaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(result.payment.id).toBe('payment-1');
      expect(result.paymentIntent.clientSecret).toBe('pi_123_secret_abc');
    });

    it('recovers from a same-key insert race (P2002) by resuming the winner', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        status: 'PENDING',
        payments: [],
      });
      prisma.__tx.payment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );
      const winner = paymentFixture();
      prisma.payment.findFirst.mockResolvedValue(winner);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(winner);

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { id: string };
        paymentIntent: { clientSecret: string | null };
      };

      // Exactly one intent operation happened — the winner's retrieve.
      expect(prisma.__tx.payment.create).toHaveBeenCalledTimes(1);
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
      expect(provider.retrievePaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(result.payment.id).toBe('payment-1');
      expect(result.paymentIntent.clientSecret).toBe('pi_123_secret_abc');
    });

    it('returns 502 and keeps the payment PENDING without a provider reference when Stripe fails — retry self-heals with the same provider idempotency key', async () => {
      prisma.booking.findFirst.mockResolvedValue(bookingFixture());
      const created = paymentFixture({ providerReference: null });
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        status: 'PENDING',
        payments: [],
      });
      prisma.__tx.payment.create.mockResolvedValue(created);
      provider.createPaymentIntent.mockRejectedValueOnce(
        new Error('stripe unavailable'),
      );

      const error = await service
        .payBooking(customer, 'booking-1', dto)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadGatewayException);
      // Payment row left resumable (never FAILED — Stripe may have created it).
      expect(prisma.payment.update).not.toHaveBeenCalled();

      // Retry with the SAME key: resumes the crash-window path and re-runs
      // creation with the same provider idempotency key (the payment id).
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ payments: [{ ...created }] }),
      );
      provider.createPaymentIntent.mockResolvedValue(snapshot());
      prisma.payment.update.mockResolvedValue({
        ...created,
        providerReference: 'pi_123',
      });

      const retry = (await service.payBooking(customer, 'booking-1', dto)) as {
        paymentIntent: { clientSecret: string | null };
      };
      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'payment-1' }),
      );
      expect(retry.paymentIntent.clientSecret).toBe('pi_123_secret_abc');
    });
  });

  describe('resume/replay', () => {
    it('resumes an open attempt and surfaces requires_action (3DS) — never as success', async () => {
      const existing = paymentFixture();
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ payments: [existing] }),
      );
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'requires_action' }),
      );
      prisma.payment.findUniqueOrThrow.mockResolvedValue(existing);

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { status: string };
        paymentIntent: { status: string; requiresAction: boolean };
      };

      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
      expect(result.payment.status).toBe('PENDING');
      expect(result.paymentIntent.requiresAction).toBe(true);
      expect(result.paymentIntent.status).toBe('requires_action');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { providerStatus: 'requires_action' },
      });
    });

    it('replays a SUCCESS attempt without touching the provider', async () => {
      const existing = paymentFixture({
        status: 'SUCCESS',
        paidAt: new Date(),
      });
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED', payments: [existing] }),
      );
      prisma.payment.findUniqueOrThrow.mockResolvedValue(existing);

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { status: string };
        paymentIntent: null;
      };
      expect(result.payment.status).toBe('SUCCESS');
      expect(result.paymentIntent).toBeNull();
      expect(provider.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('replays a FAILED attempt with 402 and no provider call', async () => {
      const existing = paymentFixture({
        status: 'FAILED',
        failedAt: new Date(),
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
      expect(provider.retrievePaymentIntent).not.toHaveBeenCalled();
    });

    it('marks a canceled intent FAILED and answers 402', async () => {
      const existing = paymentFixture();
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ payments: [existing] }),
      );
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );

      const error = await service
        .payBooking(customer, 'booking-1', dto)
        .catch((e: unknown) => e);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED,
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'FAILED',
          providerStatus: 'canceled',
        }),
      });
    });

    it('reconciles when Stripe shows succeeded but the webhook has not arrived yet', async () => {
      const existing = paymentFixture();
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ payments: [existing] }),
      );
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'succeeded' }),
      );
      // finalizeSucceededIntent internals:
      prisma.payment.findUnique.mockResolvedValue(existing); // locate by reference
      prisma.__tx.payment.updateMany.mockResolvedValue({ count: 1 }); // CAS wins
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        status: 'CONFIRMED',
        bookingReference: 'NVAB12',
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue(
        paymentFixture({ status: 'SUCCESS', paidAt: new Date() }),
      );

      const result = (await service.payBooking(customer, 'booking-1', dto)) as {
        payment: { status: string };
        paymentIntent: null;
      };

      expect(result.payment.status).toBe('SUCCESS');
      expect(result.paymentIntent).toBeNull();
      expect(prisma.__tx.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: { in: ['PENDING', 'FAILED'] } },
        data: expect.objectContaining({ status: 'SUCCESS' }),
      });
    });
  });

  describe('realtime status push (post-commit, deduped)', () => {
    const boundIntent = (
      overrides: Partial<PaymentIntentSnapshot> = {},
    ): Parameters<PaymentsService['finalizeSucceededIntent']>[0] => ({
      ...snapshot(overrides),
      paymentId: 'payment-1',
    });

    const finalizeTxFixtures = (casCount: number): void => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.__tx.payment.updateMany.mockResolvedValue({ count: casCount });
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        bookingReference: 'NVAB12',
      });
    };

    it('emits a minimal SUCCESS event after the finalization transaction commits', async () => {
      finalizeTxFixtures(1);

      await service.finalizeSucceededIntent(boundIntent({ status: 'succeeded' }));

      expect(realtime.emitPaymentStatus).toHaveBeenCalledTimes(1);
      expect(realtime.emitPaymentStatus).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        status: 'SUCCESS',
      });
    });

    it('emits nothing when the CAS loses (duplicate webhook / reconciliation replay)', async () => {
      finalizeTxFixtures(0); // a concurrent finalize already settled the payment

      await service.finalizeSucceededIntent(boundIntent({ status: 'succeeded' }));

      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('never emits for an unknown intent (no payment is touched)', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.finalizeSucceededIntent(boundIntent({ status: 'succeeded' })),
      ).rejects.toThrow();
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('emits FAILED after a payment_failed persists the failure', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.booking.findUnique.mockResolvedValue({
        userId: 'user-1',
        bookingReference: 'NVAB12',
      });

      const result = await service.markIntentFailed(boundIntent());

      expect(result).toBe('updated');
      expect(realtime.emitPaymentStatus).toHaveBeenCalledTimes(1);
      expect(realtime.emitPaymentStatus).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        status: 'FAILED',
      });
    });

    it('emits nothing for a late failure event on an already-SUCCESS payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture({ status: 'SUCCESS' }));

      const result = await service.markIntentFailed(boundIntent());

      expect(result).toBe('ignored');
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('emits FAILED after a canceled intent converges to FAILED', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markIntentCanceled(boundIntent());

      expect(result).toBe('updated');
      expect(realtime.emitPaymentStatus).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        status: 'FAILED',
      });
    });
  });

  describe('reconcileOwnPayment (customer-triggered webhook recovery)', () => {
    const openPayment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      providerReference: 'pi_123',
    };

    const ownBooking = (): void => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1' });
    };

    it('rejects a booking the customer does not own with 404 and never calls the provider', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.reconcileOwnPayment(customer, 'booking-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(provider.retrievePaymentIntent).not.toHaveBeenCalled();
    });

    it('is a no-op when no open payment exists — no provider call, returns the current list', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.payment.findMany.mockResolvedValue([]);

      const result = await service.reconcileOwnPayment(customer, 'booking-1');

      expect(provider.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('finalizes a succeeded intent through the CAS-protected path and returns the settled list', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockResolvedValue(snapshot({ status: 'succeeded' }));
      // finalizeSucceededIntent internals:
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.__tx.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        bookingReference: 'NVAB12',
      });
      prisma.payment.findMany.mockResolvedValue([
        paymentFixture({ status: 'SUCCESS', paidAt: new Date() }),
      ]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      // The intent identity came from the persisted payment — never from the client.
      expect(provider.retrievePaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
      expect(result[0].status).toBe('SUCCESS');
      expect(realtime.emitPaymentStatus).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        status: 'SUCCESS',
      });
    });

    it('converges duplicates: a lost CAS (webhook/resume won the race) emits nothing twice', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockResolvedValue(snapshot({ status: 'succeeded' }));
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.__tx.payment.updateMany.mockResolvedValue({ count: 0 }); // already settled
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        bookingReference: 'NVAB12',
      });
      prisma.payment.findMany.mockResolvedValue([
        paymentFixture({ status: 'SUCCESS', paidAt: new Date() }),
      ]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      expect(result[0].status).toBe('SUCCESS');
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('keeps PENDING for open provider states (processing/requires_*) and never fabricates FAILED', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockResolvedValue(snapshot({ status: 'processing' }));
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.payment.findMany.mockResolvedValue([paymentFixture()]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      expect(result[0].status).toBe('PENDING');
      // noteIntentStatus tracks the provider status only — no terminal write.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: 'PENDING' },
        data: { providerStatus: 'processing' },
      });
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('a declined card state (requires_payment_method) stays a safe pending — retryable, not FAILED', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'requires_payment_method' }),
      );
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.payment.findMany.mockResolvedValue([paymentFixture()]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      expect(result[0].status).toBe('PENDING');
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('applies the existing failure policy for a canceled intent', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockResolvedValue(snapshot({ status: 'canceled' }));
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.payment.findMany.mockResolvedValue([
        paymentFixture({ status: 'FAILED', failedAt: new Date() }),
      ]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      expect(result[0].status).toBe('FAILED');
      expect(realtime.emitPaymentStatus).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        status: 'FAILED',
      });
    });

    it('preserves the pending outcome when Stripe is unavailable (timeout) — never throws to the customer', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockRejectedValue(new Error('Stripe timeout'));
      prisma.payment.findMany.mockResolvedValue([paymentFixture()]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      expect(result[0].status).toBe('PENDING');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });

    it('never maps an unknown provider status to success or failure', async () => {
      ownBooking();
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'charged_unusual_state' as never }),
      );
      prisma.payment.findMany.mockResolvedValue([paymentFixture()]);

      const result = (await service.reconcileOwnPayment(customer, 'booking-1')) as {
        status: string;
      }[];

      expect(result[0].status).toBe('PENDING');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(realtime.emitPaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe('cancelOpenIntentsForCancelledBooking (Phase 3.2C)', () => {
    const eligibleRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'payment-1',
      providerReference: 'pi_123',
      status: 'PENDING',
      ...overrides,
    });

    it('cancels a cancellable intent (requires_action) and converges local state via markIntentCanceled', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'requires_action' }),
      );
      provider.cancelPaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      await service.cancelOpenIntentsForCancelledBooking('booking-1');

      expect(provider.retrievePaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(provider.cancelPaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'FAILED',
          providerStatus: 'canceled',
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_CANCELED' }),
      );
    });

    it('never calls the provider under the mock payment provider', async () => {
      const module = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditService, useValue: audit },
          { provide: BookingsService, useValue: bookings },
          { provide: PAYMENT_PROVIDER, useValue: { name: 'mock' } },
          { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
          { provide: RefundMetricsService, useValue: new RefundMetricsService() },
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
      const mockMode = module.get(PaymentsService);

      await mockMode.cancelOpenIntentsForCancelledBooking('booking-1');
      expect(prisma.payment.findMany).not.toHaveBeenCalled();
    });

    it('restricts eligibility to PENDING/FAILED stripe payments with a provider reference (mock, SUCCESS, terminal and no-reference payments excluded)', async () => {
      prisma.payment.findMany.mockResolvedValue([]);

      await service.cancelOpenIntentsForCancelledBooking('booking-1');

      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'booking-1',
          provider: 'stripe',
          providerReference: { not: null },
          status: { in: ['PENDING', 'FAILED'] },
        },
        select: { id: true, providerReference: true, status: true },
      });
      expect(provider.retrievePaymentIntent).not.toHaveBeenCalled();
    });

    it('converges an already-canceled intent without a duplicate provider cancellation', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      await service.cancelOpenIntentsForCancelledBooking('booking-1');

      expect(provider.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'FAILED',
          providerStatus: 'canceled',
        }),
      });
    });

    it('cancels a processing intent when the provider reports it cancellable', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'processing' }),
      );
      provider.cancelPaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      await service.cancelOpenIntentsForCancelledBooking('booking-1');
      expect(provider.cancelPaymentIntent).toHaveBeenCalledWith('pi_123');
    });

    it('never cancels a succeeded intent (webhook race: money is never cancelled, SUCCESS never overwritten)', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'succeeded' }),
      );

      await service.cancelOpenIntentsForCancelledBooking('booking-1');

      expect(provider.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('ignores a payment that already reached SUCCESS locally (no SUCCESS → FAILED overwrite)', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique.mockResolvedValue(
        paymentFixture({ status: 'SUCCESS' }),
      );

      await service.cancelOpenIntentsForCancelledBooking('booking-1');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('applies no amount/currency logic — cancellation is amount-agnostic', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'requires_action', amountCents: 999999, currency: 'USD' }),
      );
      provider.cancelPaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      await service.cancelOpenIntentsForCancelledBooking('booking-1');
      expect(provider.cancelPaymentIntent).toHaveBeenCalledWith('pi_123');
    });

    it('Stripe timeout on retrieve: payment is not falsely marked and stays recoverable', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockRejectedValue(
        new Error('stripe timeout'),
      );

      await expect(
        service.cancelOpenIntentsForCancelledBooking('booking-1'),
      ).resolves.toBeUndefined();
      expect(provider.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('Stripe timeout on cancel: ambiguous outcome is left recoverable — never a definitive local failure', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'requires_action' }),
      );
      provider.cancelPaymentIntent.mockRejectedValue(new Error('network error'));

      await expect(
        service.cancelOpenIntentsForCancelledBooking('booking-1'),
      ).resolves.toBeUndefined();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('repeated cancellation converges safely: no duplicate cancel, no duplicate write', async () => {
      prisma.payment.findMany.mockResolvedValue([eligibleRow()]);
      provider.retrievePaymentIntent
        .mockResolvedValueOnce(snapshot({ status: 'requires_action' }))
        .mockResolvedValueOnce(snapshot({ status: 'canceled' }));
      provider.cancelPaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique
        .mockResolvedValueOnce(paymentFixture())
        .mockResolvedValueOnce(paymentFixture({ status: 'FAILED' }));

      await service.cancelOpenIntentsForCancelledBooking('booking-1');
      await service.cancelOpenIntentsForCancelledBooking('booking-1');

      expect(provider.cancelPaymentIntent).toHaveBeenCalledTimes(1);
      expect(prisma.payment.updateMany).toHaveBeenCalledTimes(1);
    });

    it('a FAILED payment whose intent is still open is cancelled too; its local state is already converged', async () => {
      prisma.payment.findMany.mockResolvedValue([
        eligibleRow({ status: 'FAILED' }),
      ]);
      provider.retrievePaymentIntent.mockResolvedValue(
        snapshot({ status: 'requires_payment_method' }),
      );
      provider.cancelPaymentIntent.mockResolvedValue(
        snapshot({ status: 'canceled' }),
      );
      prisma.payment.findUnique.mockResolvedValue(
        paymentFixture({ status: 'FAILED' }),
      );

      await service.cancelOpenIntentsForCancelledBooking('booking-1');

      expect(provider.cancelPaymentIntent).toHaveBeenCalledWith('pi_123');
      // Already FAILED locally — markIntentCanceled is a no-op for it.
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('guards', () => {
    it('rejects a booking the customer does not own with 404', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toMatchObject({ status: 404 });
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('rejects payment for an already confirmed booking (new key)', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({ status: 'CONFIRMED' }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('rejects payment when seat holds expired — no intent created', async () => {
      prisma.booking.findFirst.mockResolvedValue(
        bookingFixture({
          seatHolds: [
            {
              id: 'hold-1',
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() - 60_000),
            },
          ],
        }),
      );
      await expect(
        service.payBooking(customer, 'booking-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });
  });
});
