import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER, type ProviderWebhookEvent } from './payment-provider';
import { RefundMetricsService } from './refund-metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

/**
 * Webhook pipeline: signature gate (provider), database deduplication,
 * transactional processing, reconciliation invariants. Prisma is mocked in
 * the same style as payments.service.spec.ts; the provider double only
 * implements constructWebhookEvent (verification) — constructEvent output is
 * the domain-mapped ProviderWebhookEvent.
 */

const future = () => new Date(Date.now() + 10 * 60_000);

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: new Prisma.Decimal('505.00'),
  currency: 'EUR',
  status: 'PENDING',
  provider: 'stripe',
  providerReference: 'pi_123',
  providerStatus: 'requires_action',
  token: null,
  idempotencyKey: 'key-0001',
  paidAt: null,
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const intent = (overrides: Record<string, unknown> = {}) => ({
  providerReference: 'pi_123',
  status: 'succeeded' as const,
  clientSecret: null,
  amountCents: 50500,
  currency: 'EUR',
  paymentId: 'payment-1',
  ...overrides,
});

const event = (
  eventType: string,
  intentPayload?: Record<string, unknown> | null,
  eventId = 'evt_1',
): ProviderWebhookEvent => ({
  eventId,
  eventType,
  ...(intentPayload === null
    ? {}
    : { intent: intent({ ...intentPayload }) as never }),
});

/** tx double whose booking payload satisfies confirmBookingInTransaction. */
const createMockPrisma = () => {
  const tx = {
    seatHold: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    booking: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    flightSegment: { findMany: vi.fn().mockResolvedValue([{ id: 'seg-1' }]) },
    bookingSeat: { create: vi.fn().mockResolvedValue({}) },
    payment: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    paymentWebhookEvent: { update: vi.fn().mockResolvedValue({}) },
  };
  return {
    payment: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    paymentWebhookEvent: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

/** Booking row as read inside the finalize transaction. */
const txBookingRow = (status = 'PENDING') => ({
  id: 'booking-1',
  status,
  bookingReference: 'NVAB12',
});

/** Full booking fixture for confirmBookingInTransaction's findUniqueOrThrow. */
const txBookingFull = () => ({
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
});

describe('PaymentWebhookService', () => {
  let service: PaymentWebhookService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let provider: {
    name: string;
    constructWebhookEvent: ReturnType<typeof vi.fn>;
    createPaymentIntent: ReturnType<typeof vi.fn>;
    retrievePaymentIntent: ReturnType<typeof vi.fn>;
    cancelPaymentIntent: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    provider = {
      name: 'stripe',
      constructWebhookEvent: vi.fn(),
      createPaymentIntent: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      cancelPaymentIntent: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        PaymentWebhookService,
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn().mockResolvedValue({}) } },
        {
          provide: BookingsService,
          useValue: { getBookingView: vi.fn().mockResolvedValue({}) },
        },
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
        { provide: RealtimeEventsService, useValue: { emitPaymentStatus: vi.fn() } },
      ],
    }).compile();
    service = module.get(PaymentWebhookService);
  });

  const raw = Buffer.from('{"id":"evt_1"}');

  describe('signature gate', () => {
    it('rejects an invalid signature with 400 and never touches the database', async () => {
      provider.constructWebhookEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });
      await expect(
        service.handleStripeWebhook(raw, 'bad-sig'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('rejects a missing signature header with 400', async () => {
      await expect(
        service.handleStripeWebhook(raw, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(provider.constructWebhookEvent).not.toHaveBeenCalled();
    });

    it('verifies with the exact raw bytes and signature header', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('charge.refunded', null),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      await service.handleStripeWebhook(raw, 'sig-header');
      expect(provider.constructWebhookEvent).toHaveBeenCalledWith(
        raw,
        'sig-header',
      );
    });
  });

  describe('deduplication', () => {
    it('persists the event identity before processing', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('charge.refunded', null),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      await service.handleStripeWebhook(raw, 'sig');
      expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          provider: 'stripe',
          eventId: 'evt_1',
          eventType: 'charge.refunded',
        },
      });
    });

    it('answers a duplicate delivery of an already-processed event without reprocessing', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.succeeded'),
      );
      prisma.paymentWebhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );
      prisma.paymentWebhookEvent.findUniqueOrThrow.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: new Date(),
      });

      const result = await service.handleStripeWebhook(raw, 'sig');
      expect(result).toEqual({ received: true, status: 'duplicate' });
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reprocesses an event whose first delivery crashed before processing', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.succeeded'),
      );
      prisma.paymentWebhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );
      // Row exists but processedAt is null → first attempt never finished.
      prisma.paymentWebhookEvent.findUniqueOrThrow.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
      prisma.__tx.booking.findUniqueOrThrow
        .mockResolvedValueOnce(txBookingRow('CONFIRMED'))
        .mockResolvedValueOnce(txBookingFull());

      const result = await service.handleStripeWebhook(raw, 'sig');
      expect(result.status).toBe('processed');
    });
  });

  describe('payment_intent.succeeded', () => {
    const succeededSetup = () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.succeeded'),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());
    };

    it('confirms the full chain atomically: Payment SUCCESS + Booking CONFIRMED + holds CONVERTED + BookingSeat + event PROCESSED', async () => {
      succeededSetup();
      prisma.__tx.booking.findUniqueOrThrow
        .mockResolvedValueOnce(txBookingRow('PENDING'))
        .mockResolvedValueOnce(txBookingFull());

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result).toEqual({ received: true, status: 'processed' });
      // Payment CAS PENDING/FAILED → SUCCESS.
      expect(prisma.__tx.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: { in: ['PENDING', 'FAILED'] } },
        data: expect.objectContaining({
          status: 'SUCCESS',
          providerStatus: 'succeeded',
        }),
      });
      // Booking CAS PENDING → CONFIRMED.
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'PENDING' },
        data: { status: 'CONFIRMED' },
      });
      // Holds converted.
      expect(prisma.__tx.seatHold.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1', status: 'ACTIVE' },
        data: { status: 'CONVERTED' },
      });
      // BookingSeat created for the segment.
      expect(prisma.__tx.bookingSeat.create).toHaveBeenCalledWith({
        data: {
          bookingPassengerId: 'bp-1',
          flightSegmentId: 'seg-1',
          seatId: 'seat-1',
          seatNumber: '1A',
        },
      });
      // Event marked PROCESSED inside the same transaction.
      expect(prisma.__tx.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { provider_eventId: { provider: 'stripe', eventId: 'evt_1' } },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      });
      expect(result.status).toBe('processed');
    });

    it('is idempotent when the payment is already SUCCESS and the booking CONFIRMED (duplicate/race)', async () => {
      succeededSetup();
      prisma.__tx.payment.updateMany.mockResolvedValue({ count: 0 }); // CAS lost
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(
        txBookingRow('CONFIRMED'),
      );

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('processed');
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(prisma.__tx.bookingSeat.create).not.toHaveBeenCalled();
      expect(prisma.__tx.paymentWebhookEvent.update).toHaveBeenCalled();
    });

    it('recovers the crash window: payment SUCCESS committed but booking still PENDING', async () => {
      succeededSetup();
      prisma.payment.findUnique.mockResolvedValue(
        paymentFixture({ status: 'SUCCESS', paidAt: new Date() }),
      );
      prisma.__tx.payment.updateMany.mockResolvedValue({ count: 0 }); // already SUCCESS
      prisma.__tx.booking.findUniqueOrThrow
        .mockResolvedValueOnce(txBookingRow('PENDING'))
        .mockResolvedValueOnce(txBookingFull());

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('processed');
      expect(prisma.__tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', status: 'PENDING' },
        data: { status: 'CONFIRMED' },
      });
      expect(prisma.__tx.bookingSeat.create).toHaveBeenCalledTimes(1);
    });

    it('heals a missing provider reference via metadata paymentId (crash between intent creation and reference persistence)', async () => {
      succeededSetup();
      prisma.payment.findUnique
        .mockResolvedValueOnce(null) // by providerReference
        .mockResolvedValueOnce(
          paymentFixture({ providerReference: null, providerStatus: null }),
        ); // by id
      // heal updateMany (outer client)
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.__tx.booking.findUniqueOrThrow
        .mockResolvedValueOnce(txBookingRow('PENDING'))
        .mockResolvedValueOnce(txBookingFull());

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', providerReference: null },
        data: { providerReference: 'pi_123' },
      });
      expect(result.status).toBe('processed');
    });

    it('IGNORES an event for an unknown PaymentIntent', async () => {
      succeededSetup();
      prisma.payment.findUnique.mockResolvedValue(null); // by ref and by id

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result).toEqual({ received: true, status: 'ignored:unknown-payment' });
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evtrow-1' },
        data: expect.objectContaining({ status: 'IGNORED' }),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('IGNORES an event from a stale intent (payment owned by a different reference)', async () => {
      succeededSetup();
      prisma.payment.findUnique
        .mockResolvedValueOnce(null) // by providerReference
        .mockResolvedValueOnce(paymentFixture({ providerReference: 'pi_other' })); // by id

      const result = await service.handleStripeWebhook(raw, 'sig');
      expect(result.status).toBe('ignored:unknown-payment');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to confirm on an amount mismatch and records FAILED for reconciliation', async () => {
      succeededSetup();
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.succeeded', { amountCents: 49900 }),
      );

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result).toEqual({ received: true, status: 'failed:reconciliation' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evtrow-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          processingError: expect.stringContaining('49900'),
        }),
      });
    });

    it('refuses to confirm on a currency mismatch', async () => {
      succeededSetup();
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.succeeded', { currency: 'USD' }),
      );

      const result = await service.handleStripeWebhook(raw, 'sig');
      expect(result.status).toBe('failed:reconciliation');
      expect(prisma.__tx.payment.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to confirm a booking that is no longer confirmable (cancelled after capture)', async () => {
      succeededSetup();
      prisma.__tx.booking.findUniqueOrThrow.mockResolvedValue(
        txBookingRow('CANCELLED'),
      );

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('failed:reconciliation');
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CONFIRMED' } }),
      );
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evtrow-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          processingError: expect.stringContaining('manual reconciliation'),
        }),
      });
    });

    it('records FAILED when the money arrived but the holds expired before confirmation', async () => {
      succeededSetup();
      // confirmBookingInTransaction: booking CAS wins but holds are gone.
      prisma.__tx.booking.findUniqueOrThrow
        .mockResolvedValueOnce(txBookingRow('PENDING'))
        .mockResolvedValueOnce({
          ...txBookingFull(),
          seatHolds: [],
        });

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('failed:reconciliation');
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evtrow-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });

    it('propagates transient failures so Stripe retries (event stays unprocessed)', async () => {
      succeededSetup();
      prisma.$transaction.mockRejectedValueOnce(new Error('connection reset'));

      await expect(service.handleStripeWebhook(raw, 'sig')).rejects.toThrow(
        'connection reset',
      );
      expect(prisma.paymentWebhookEvent.update).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.payment_failed', () => {
    it('marks the payment FAILED and never touches the booking', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.payment_failed', {
          status: 'requires_payment_method',
        }),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('processed');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
      expect(prisma.__tx.booking.updateMany).not.toHaveBeenCalled();
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evtrow-1' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      });
    });

    it('ignores a late failure event for an already-SUCCESS payment', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.payment_failed', {
          status: 'requires_payment_method',
        }),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      prisma.payment.findUnique.mockResolvedValue(
        paymentFixture({ status: 'SUCCESS' }),
      );

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('processed');
      expect(prisma.payment.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });
  });

  describe('asynchronous intermediate states', () => {
    it.each(['payment_intent.processing', 'payment_intent.requires_action'])(
      '%s only tracks the provider status — never confirms',
      async (eventType) => {
        provider.constructWebhookEvent.mockReturnValue(
          event(eventType, {
            status: eventType === 'payment_intent.processing' ? 'processing' : 'requires_action',
          }),
        );
        prisma.paymentWebhookEvent.create.mockResolvedValue({
          id: 'evtrow-1',
          processedAt: null,
        });
        prisma.payment.findUnique.mockResolvedValue(paymentFixture());

        const result = await service.handleStripeWebhook(raw, 'sig');

        expect(result.status).toBe('processed');
        expect(prisma.payment.updateMany).toHaveBeenCalledWith({
          where: { id: 'payment-1', status: 'PENDING' },
          data: {
            providerStatus:
              eventType === 'payment_intent.processing'
                ? 'processing'
                : 'requires_action',
          },
        });
        // Never a SUCCESS/CONFIRMED transition for intermediate states.
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('payment_intent.canceled marks the open attempt FAILED', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('payment_intent.canceled', { status: 'canceled' }),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });
      prisma.payment.findUnique.mockResolvedValue(paymentFixture());

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result.status).toBe('processed');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'payment-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'FAILED',
          providerStatus: 'canceled',
        }),
      });
    });
  });

  describe('unknown events', () => {
    it('IGNORES verified but unsupported event types', async () => {
      provider.constructWebhookEvent.mockReturnValue(
        event('customer.created', null),
      );
      prisma.paymentWebhookEvent.create.mockResolvedValue({
        id: 'evtrow-1',
        processedAt: null,
      });

      const result = await service.handleStripeWebhook(raw, 'sig');

      expect(result).toEqual({
        received: true,
        status: 'ignored:unsupported-event',
      });
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evtrow-1' },
        data: expect.objectContaining({ status: 'IGNORED' }),
      });
    });
  });
});

describe('PaymentsWebhookController fail-closed behavior', () => {
  it('rejects when the raw body is unavailable (no rawBody bootstrap)', async () => {
    const { PaymentsWebhookController } = await import(
      './payments-webhook.controller'
    );
    const controller = new PaymentsWebhookController({} as never);
    await expect(
      controller.handleStripe(
        { rawBody: undefined } as never,
        'sig',
      ),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('rejects when rawBody is not a Buffer', async () => {
    const { PaymentsWebhookController } = await import(
      './payments-webhook.controller'
    );
    const controller = new PaymentsWebhookController({} as never);
    await expect(
      controller.handleStripe({ rawBody: '{"json":true}' } as never, 'sig'),
    ).rejects.toMatchObject({ status: 500 });
  });
});
