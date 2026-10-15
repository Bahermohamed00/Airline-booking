import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Booking,
  BookingStatus,
  OrphanProviderRefund,
  Payment,
  Prisma,
  Refund,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  RealtimeEventsService,
  type PaymentStatusEvent,
} from '../realtime/realtime-events.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import {
  isPaymentIntentProvider,
  PAYMENT_PROVIDER,
  ProviderDefinitiveError,
  type PaymentIntentProvider,
  type PaymentIntentSnapshot,
  type PaymentProvider,
  type ProviderRefundLookup,
  type ProviderRefundResult,
} from './payment-provider.js';
import { fromCents, resolveRefundPolicy, toCents } from './refund-policy.js';
import { normalizeCurrency, toSmallestUnit } from './money.js';
import {
  resolveRefundAlertPendingMinutes,
  resolveRefundReconciliationMinAgeMinutes,
} from './payment-reconciliation-config.js';
import {
  REFUND_COUNTERS,
  REFUND_GAUGES,
  RefundMetricsService,
} from './refund-metrics.service.js';
import { PayBookingDto } from './dto/pay-booking.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto.js';
import { AdminRefundQueryDto } from './dto/admin-refund-query.dto.js';
import { AdminOrphanRefundQueryDto } from './dto/admin-orphan-refund.dto.js';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto.js';
import { ConfirmExceptionDto } from './dto/confirm-exception.dto.js';
import { AdminCancellationRequestQueryDto } from './dto/admin-cancellation-request-query.dto.js';
import { RejectCancellationRequestDto } from './dto/reject-cancellation-request.dto.js';
import {
  BookingNotPendingError,
  confirmBookingInTransaction,
} from './booking-confirmation.js';
import {
  evaluateCancellationPolicy,
  type CancellationPolicyDecision,
} from '../bookings/cancellation-policy.js';

/**
 * A verified provider state change that contradicts persisted data (amount,
 * currency, booking association) or arrives for a booking that can no longer
 * be confirmed (e.g. cancelled after capture). Permanent — retrying the same
 * event will never fix it; recorded for manual reconciliation instead.
 */
export class PaymentReconciliationError extends Error {}

/** A webhook/retrieval referenced a provider intent this system never recorded. */
export class UnknownProviderIntentError extends Error {}

type PaymentWithRefunds = Payment & { refunds: Refund[] };

/** Booking shape loaded by payBooking (passengers, ACTIVE holds, payments). */
type BookingForPayment = Prisma.BookingGetPayload<{
  include: {
    bookingPassengers: { select: { id: true } };
    seatHolds: { where: { status: 'ACTIVE' } };
    payments: { include: { refunds: true } };
  };
}>;

/** Intent snapshot plus the internal payment binding carried in provider metadata. */
type BoundIntentSnapshot = PaymentIntentSnapshot & { paymentId: string | null };
type AdminPaymentRow = PaymentWithRefunds & {
  booking: {
    bookingReference: string;
    status: BookingStatus;
    contactEmail: string;
  };
};
type AdminRefundRow = Refund & {
  payment: { providerReference: string | null; status: Payment['status'] };
  booking: { bookingReference: string; contactEmail: string };
};

/**
 * Narrowed injection surface for BookingsService. The constructor parameter is
 * typed with this Pick (not the class) on purpose: emitDecoratorMetadata emits
 * `Object` for type aliases, so the decorator metadata never eagerly touches
 * the BookingsService binding across the bookings ⇄ payments ESM import cycle
 * (a class-typed parameter would crash at bootstrap with a TDZ error). The
 * actual injection token stays the lazy forwardRef class reference.
 */
type BookingViewReader = Pick<BookingsService, 'getBookingView'>;

const ADMIN_PAYMENT_INCLUDE = {
  refunds: true,
  booking: {
    select: { bookingReference: true, status: true, contactEmail: true },
  },
} as const;

/** Full row shape behind the admin cancellation-request list/detail views. */
const CANCELLATION_REQUEST_INCLUDE = {
  user: { select: { firstName: true, lastName: true, email: true } },
  refund: { select: { id: true, status: true, amount: true } },
  booking: {
    include: {
      payments: { include: { refunds: true } },
      seatHolds: {
        take: 1,
        orderBy: { createdAt: 'asc' as const },
        select: {
          flight: {
            select: {
              flightNumber: true,
              departureTime: true,
              route: {
                select: {
                  originAirport: { select: { iataCode: true } },
                  destinationAirport: { select: { iataCode: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

type CancellationRequestRow = Prisma.CancellationRequestGetPayload<{
  include: typeof CANCELLATION_REQUEST_INCLUDE;
}>;

/**
 * Payments, refunds, and the paid booking lifecycle (Phase 6F + Phase 2).
 *
 * Lifecycle implemented here (BR-04/BR-05/BR-13/BR-14/BR-15):
 * - customer payment (mock provider): charge synchronously with the
 *   server-computed booking total, then in ONE Prisma transaction atomically
 *   compare-and-set PENDING→CONFIRMED, convert ACTIVE seat holds to CONVERTED,
 *   create BookingSeat rows, and persist the SUCCESS payment;
 * - customer payment (Stripe PaymentIntent provider): create/resume the
 *   PaymentIntent and return its client secret — Stripe.js confirms
 *   client-side; the booking becomes CONFIRMED only after a VERIFIED
 *   successful payment state via the signed webhook (or the authenticated
 *   retrieve-reconciliation), both funneled through finalizeSucceededIntent;
 * - idempotency: (bookingId, idempotencyKey) replays/resumes the recorded
 *   attempt and is unique at the database level; concurrent different-key
 *   attempts serialize on the booking row lock; the provider idempotency key
 *   is the persisted payment id, so retries never create duplicate intents;
 * - refunds: the Refund row is recorded as PENDING inside a payment-row-locked,
 *   remainder-validated transaction BEFORE the provider is called, then marked
 *   PROCESSED (with the provider refund reference) after the provider succeeds
 *   (REJECTED when it fails) — money never moves at the provider without a
 *   committed database record, and the per-Refund provider idempotency key
 *   makes provider retries safe;
 * - admin cancellation: cancels the booking and auto-refunds per the fare
 *   refund policy snapshot captured at booking creation (BR-15);
 * - BR-14: staff-only audited confirmation without any payment record.
 *
 * Audit is always post-commit and fail-soft, like the bookings module.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    // forwardRef: BookingsService (cancelMine) calls back into this service for
    // post-cancellation PaymentIntent protection — the deferred reference keeps
    // the runtime import cycle safe regardless of module evaluation order.
    @Inject(forwardRef(() => BookingsService)) private readonly bookings: BookingViewReader,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RefundMetricsService) private readonly metrics: RefundMetricsService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(RealtimeEventsService)
    private readonly realtime: RealtimeEventsService,
  ) {}

  // ---------- Customer ----------

  async payBooking(user: AuthUser, bookingId: string, dto: PayBookingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      include: {
        bookingPassengers: { select: { id: true } },
        seatHolds: { where: { status: 'ACTIVE' } },
        payments: { include: { refunds: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // PaymentIntent providers (Stripe) use the asynchronous flow: the intent
    // is created/retrieved here, Stripe.js confirms client-side, and the
    // signed provider webhook is authoritative for the final payment state.
    if (isPaymentIntentProvider(this.provider)) {
      return this.payBookingWithPaymentIntent(user, booking, dto);
    }

    // Idempotency: a recorded attempt with the same key replays its outcome.
    const existing = booking.payments.find(
      (p) => p.idempotencyKey === dto.idempotencyKey,
    );
    if (existing) {
      if (existing.token !== dto.token) {
        throw new ConflictException(
          'Idempotency key was already used with different payment details',
        );
      }
      if (existing.status === 'SUCCESS') {
        return {
          payment: this.toPaymentView(existing),
          booking: await this.bookings.getBookingView(booking.id),
        };
      }
      if (existing.status === 'FAILED') {
        throw new HttpException(
          'Payment failed: the payment method was declined. Please try again with a new payment attempt.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      throw new ConflictException(
        'A payment with this idempotency key is already being processed',
      );
    }

    if (booking.status === 'CONFIRMED') {
      throw new ConflictException('Booking is already confirmed');
    }
    if (booking.status !== 'PENDING') {
      throw new ConflictException('Booking is not payable');
    }

    // Fast-fail before charging: holds must still cover every passenger (BR-13).
    const liveHolds = booking.seatHolds.filter(
      (h) => h.expiresAt.getTime() > Date.now(),
    );
    if (liveHolds.length !== booking.bookingPassengers.length) {
      throw new ConflictException(
        'Seat holds for this booking have expired — cancel it and create a new booking',
      );
    }

    const token = dto.token;
    if (!token) {
      throw new BadRequestException(
        'token is required for the synchronous payment provider',
      );
    }

    // The amount is always the persisted booking total — never client input.
    const amount = Number(booking.totalAmount);
    const currency = booking.currency;
    const charge = await this.provider.charge({
      amount,
      currency,
      token,
      idempotencyKey: dto.idempotencyKey,
      bookingReference: booking.bookingReference,
    });

    // BR-05: a failed payment is recorded as FAILED and never confirms anything.
    if (charge.outcome === 'failed') {
      const failed = await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount,
          currency,
          status: 'FAILED',
          provider: this.provider.name,
          token,
          idempotencyKey: dto.idempotencyKey,
          failedAt: new Date(),
        },
        include: { refunds: true },
      });
      await this.logPaymentEvent('PAYMENT_FAILED', user, failed, booking, {
        amount,
        currency,
      });
      await this.safeNotify(
        () =>
          this.notifications.notifyPaymentFailed({
            userId: booking.userId,
            paymentId: failed.id,
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
          }),
        `PAYMENT_FAILED payment ${failed.id}`,
      );
      throw new HttpException(
        `Payment failed: ${charge.failureReason}`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    try {
      const { payment, details } = await this.prisma.$transaction(
        async (tx) => {
          const details = await confirmBookingInTransaction(tx, booking.id);
          const payment = await tx.payment.create({
            data: {
              bookingId: booking.id,
              amount,
              currency,
              status: 'SUCCESS',
              provider: this.provider.name,
              providerReference: charge.providerReference,
              token,
              idempotencyKey: dto.idempotencyKey,
              paidAt: new Date(),
            },
            include: { refunds: true },
          });
          return { payment, details };
        },
      );

      const view = await this.bookings.getBookingView(booking.id);
      await this.logPaymentEvent('PAYMENT_SUCCEEDED', user, payment, booking, {
        amount,
        currency,
        providerReference: charge.providerReference,
      });
      await this.logBookingEvent('BOOKING_CONFIRMED', user, booking, {
        amount,
        currency,
      });
      await this.logBookingEvent('SEAT_HOLD_CONVERTED', user, booking, {
        seatNumbers: details.seatNumbers,
        holdCount: details.holdCount,
      });
      // Post-commit, fail-soft: the payment + booking confirmation above are
      // already persisted; a notification failure must never change this
      // response or the stored state. Dedupe keys make idempotent replays
      // no-ops.
      await this.safeNotify(
        () =>
          this.notifications.notifyPaymentSucceeded({
            userId: booking.userId,
            paymentId: payment.id,
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
          }),
        `PAYMENT_SUCCEEDED payment ${payment.id}`,
      );
      await this.safeNotify(
        () =>
          this.notifications.notifyBookingConfirmed({
            userId: booking.userId,
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
          }),
        `BOOKING_CONFIRMED booking ${booking.id}`,
      );
      // Post-commit realtime push: the payment + booking confirmation are
      // already persisted; clients reconcile via the API on receipt.
      this.emitPaymentStatus({
        bookingId: booking.id,
        paymentId: payment.id,
        status: 'SUCCESS',
      });
      return { payment: this.toPaymentView(payment), booking: view };
    } catch (error) {
      if (error instanceof BookingNotPendingError) {
        // Lost a concurrent race — the parallel request confirmed the booking.
        // Replay its result when it is the same idempotent attempt.
        const winner = await this.prisma.payment.findFirst({
          where: { bookingId: booking.id, idempotencyKey: dto.idempotencyKey },
          include: { refunds: true },
        });
        if (winner?.status === 'SUCCESS' && winner.token === dto.token) {
          return {
            payment: this.toPaymentView(winner),
            booking: await this.bookings.getBookingView(booking.id),
          };
        }
        throw new ConflictException('Booking is already confirmed');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.compensateCharge(charge.providerReference, amount, currency);
        throw new ConflictException('Duplicate payment reference');
      }
      // The provider charged successfully but the confirmation transaction
      // failed — compensate best-effort (the mock provider is stateless; a real
      // provider would void/refund the charge here).
      await this.compensateCharge(charge.providerReference, amount, currency);
      throw error;
    }
  }

  // ---------- PaymentIntent flow (Stripe) ----------

  /** The configured provider narrowed to PaymentIntent capability (dispatch sites guarantee it). */
  private intentProvider(): PaymentIntentProvider {
    const provider = this.provider;
    if (!isPaymentIntentProvider(provider)) {
      throw new Error(
        'Configured payment provider does not support PaymentIntents',
      );
    }
    return provider;
  }

  /**
   * Creates or resumes the PaymentIntent for a booking. This endpoint never
   * confirms the booking: Stripe.js confirms the intent client-side (3DS via
   * requires_action), and the signed provider webhook (or the authenticated
   * retrieve-reconciliation below) is authoritative for the final state.
   *
   * Guarantees:
   * - the amount is ALWAYS the persisted booking total, converted with exact
   *   decimal math — never client input, never floating point;
   * - at most one open (PENDING) payment per booking — concurrent attempts
   *   with different keys serialize on the booking row lock inside the
   *   creation transaction;
   * - same-key retries resume/replay; the database unique constraint on
   *   (bookingId, idempotencyKey) is the backstop for concurrent same-key
   *   attempts;
   * - the provider idempotency key is the persisted payment id, so retries of
   *   the same logical attempt can never create a second intent at Stripe.
   */
  private async payBookingWithPaymentIntent(
    user: AuthUser,
    booking: BookingForPayment,
    dto: PayBookingDto,
  ) {
    const provider = this.intentProvider();
    const amountCents = toSmallestUnit(booking.totalAmount, booking.currency);
    const currency = normalizeCurrency(booking.currency);
    const money = { amountCents, currency };

    // Application idempotency: a recorded attempt with the same key resumes or
    // replays instead of creating a second intent.
    const existing = booking.payments.find(
      (p) => p.idempotencyKey === dto.idempotencyKey,
    );
    if (existing) {
      return this.resumePaymentIntentAttempt(user, booking, existing, money);
    }

    if (booking.status === 'CONFIRMED') {
      throw new ConflictException('Booking is already confirmed');
    }
    if (booking.status !== 'PENDING') {
      throw new ConflictException('Booking is not payable');
    }

    // Fast-fail before creating an intent: holds must still cover every
    // passenger (BR-13).
    const liveHolds = booking.seatHolds.filter(
      (h) => h.expiresAt.getTime() > Date.now(),
    );
    if (liveHolds.length !== booking.bookingPassengers.length) {
      throw new ConflictException(
        'Seat holds for this booking have expired — cancel it and create a new booking',
      );
    }

    let payment: Payment;
    let resumedOpenAttempt = false;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        // Lock the booking row (self-assign pattern, same as the refund flow):
        // concurrent attempts with DIFFERENT keys serialize here and the loser
        // observes the winner's open payment below.
        await tx.booking.update({
          where: { id: booking.id },
          data: { currency: booking.currency },
        });
        const fresh = await tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          include: { payments: true },
        });
        if (fresh.status !== 'PENDING') {
          throw new ConflictException('Booking is not payable');
        }
        // An open (PENDING) attempt already exists for this booking under a
        // different key — e.g. the customer's browser lost the persisted key.
        // Resume it instead of creating anything new: still exactly one open
        // payment and one PaymentIntent per booking, so no double charge is
        // possible. The clientSecret is returned to the booking owner only.
        const open = fresh.payments.find((p) => p.status === 'PENDING');
        if (open) {
          resumedOpenAttempt = true;
          return open;
        }
        return tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: booking.totalAmount,
            currency,
            status: 'PENDING',
            provider: provider.name,
            idempotencyKey: dto.idempotencyKey,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // A concurrent attempt with the SAME key inserted first — resume it.
        const winner = await this.prisma.payment.findFirst({
          where: { bookingId: booking.id, idempotencyKey: dto.idempotencyKey },
        });
        if (winner) {
          return this.resumePaymentIntentAttempt(user, booking, winner, money);
        }
      }
      throw error;
    }
    if (resumedOpenAttempt) {
      // The open attempt keeps its ORIGINAL idempotency key; the request's
      // fresh key is intentionally discarded.
      return this.resumePaymentIntentAttempt(user, booking, payment, money);
    }
    return this.createAndAttachIntent(user, booking, payment, money);
  }

  /** Same-key replay/resume for an existing payment attempt. */
  private async resumePaymentIntentAttempt(
    user: AuthUser,
    booking: BookingForPayment,
    payment: Payment,
    money: { amountCents: number; currency: string },
  ) {
    if (payment.provider !== this.provider.name) {
      throw new ConflictException(
        'Idempotency key was already used with a different payment provider',
      );
    }
    if (
      payment.status === 'SUCCESS' ||
      payment.status === 'PARTIALLY_REFUNDED' ||
      payment.status === 'REFUNDED'
    ) {
      const full = await this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { refunds: true },
      });
      return {
        payment: this.toPaymentView(full),
        paymentIntent: null,
        booking: await this.bookings.getBookingView(booking.id),
      };
    }
    if (payment.status === 'FAILED') {
      throw new HttpException(
        'Payment failed: please start a new payment attempt with a fresh idempotency key.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // PENDING — resume the still-open attempt.
    if (!payment.providerReference) {
      // Crash window: the intent creation was never visibly linked. Re-run it
      // with the SAME provider idempotency key (the payment id) — the provider
      // deduplicates, so a retried creation can never double-charge.
      return this.createAndAttachIntent(user, booking, payment, money);
    }

    let snapshot: PaymentIntentSnapshot;
    try {
      snapshot = await this.intentProvider().retrievePaymentIntent(
        payment.providerReference,
      );
    } catch (error) {
      this.logger.warn(
        `retrievePaymentIntent failed for ${payment.providerReference}: ${String(error)}`,
      );
      throw new BadGatewayException(
        'Payment provider is unavailable — please retry with the same idempotency key',
      );
    }

    if (snapshot.status === 'succeeded') {
      // The webhook is delayed or lost — reconcile from the authenticated
      // provider read. finalizeSucceededIntent is idempotent, so racing the
      // webhook is harmless.
      await this.finalizeSucceededIntent({ ...snapshot, paymentId: payment.id });
      const full = await this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { refunds: true },
      });
      return {
        payment: this.toPaymentView(full),
        paymentIntent: null,
        booking: await this.bookings.getBookingView(booking.id),
      };
    }
    if (snapshot.status === 'canceled') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          providerStatus: 'canceled',
        },
      });
      throw new HttpException(
        'Payment was canceled — please start a new payment attempt with a fresh idempotency key.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Still open (requires_payment_method / requires_confirmation /
    // requires_action / processing): persist the fine-grained provider status
    // and hand the client secret back so Stripe.js can (re)confirm — 3DS runs
    // client-side; requires_action is never reported as success.
    await this.prisma.payment.updateMany({
      where: { id: payment.id },
      data: { providerStatus: snapshot.status },
    });
    const full = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { refunds: true },
    });
    return {
      payment: this.toPaymentView(full),
      paymentIntent: {
        clientSecret: snapshot.clientSecret,
        status: snapshot.status,
        requiresAction: snapshot.status === 'requires_action',
      },
      booking: await this.bookings.getBookingView(booking.id),
    };
  }

  /** The configured provider's name (sweep eligibility filtering). */
  configuredProviderName(): string {
    return this.provider.name;
  }

  /**
   * Creates the provider intent for a fresh (or never-linked) PENDING payment
   * and persists the provider reference. If the provider call fails, the row
   * stays PENDING without a reference and the same-key retry resumes through
   * the crash-window path — the provider idempotency key (payment id) makes
   * that retry safe.
   */
  private async createAndAttachIntent(
    user: AuthUser,
    booking: BookingForPayment,
    payment: Payment,
    money: { amountCents: number; currency: string },
  ) {
    let snapshot: PaymentIntentSnapshot;
    try {
      snapshot = await this.intentProvider().createPaymentIntent({
        amountCents: money.amountCents,
        currency: money.currency,
        idempotencyKey: payment.id,
        bookingReference: booking.bookingReference,
        paymentId: payment.id,
      });
    } catch (error) {
      this.logger.warn(
        `createPaymentIntent failed for payment ${payment.id}: ${String(error)}`,
      );
      throw new BadGatewayException(
        'Payment provider is unavailable — please retry with the same idempotency key',
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerReference: snapshot.providerReference,
        providerStatus: snapshot.status,
      },
      include: { refunds: true },
    });
    await this.logPaymentEvent('PAYMENT_INTENT_CREATED', user, updated, booking, {
      providerReference: snapshot.providerReference,
      providerStatus: snapshot.status,
    });
    return {
      payment: this.toPaymentView(updated),
      paymentIntent: {
        clientSecret: snapshot.clientSecret,
        status: snapshot.status,
        requiresAction: snapshot.status === 'requires_action',
      },
      booking: await this.bookings.getBookingView(booking.id),
    };
  }

  // ---------- Verified intent finalization (webhook + retrieve reconciliation) ----------

  /**
   * Locates the payment for a verified provider intent: by provider reference,
   * falling back to the metadata paymentId for the crash window where the
   * intent was created but its reference was never persisted (healed here).
   * Returns null for unknown intents and for events of a STALE intent (a
   * payment whose reference points at a different intent).
   */
  private async locatePaymentForIntent(
    intent: BoundIntentSnapshot,
  ): Promise<Payment | null> {
    const byReference = await this.prisma.payment.findUnique({
      where: { providerReference: intent.providerReference },
    });
    if (byReference) {
      return byReference;
    }
    if (!intent.paymentId) {
      return null;
    }
    const byId = await this.prisma.payment.findUnique({
      where: { id: intent.paymentId },
    });
    if (!byId || byId.provider !== this.provider.name) {
      return null;
    }
    if (byId.providerReference || byId.status !== 'PENDING') {
      // A different intent owns this payment (stale event), or the payment is
      // already terminal — never overwrite a persisted reference.
      return null;
    }
    const healed = await this.prisma.payment.updateMany({
      where: { id: byId.id, providerReference: null },
      data: { providerReference: intent.providerReference },
    });
    if (healed.count !== 1) {
      return null;
    }
    return { ...byId, providerReference: intent.providerReference };
  }

  /**
   * Turns a VERIFIED succeeded intent into the final database state:
   * Payment SUCCESS + Booking CONFIRMED + holds CONVERTED + BookingSeat rows,
   * atomically. Shared by the webhook (eventCtx set — the event is marked
   * PROCESSED inside the same transaction) and the retrieve-reconciliation
   * path (eventCtx unset).
   *
   * Idempotent and race-safe: the payment CAS (PENDING/FAILED→SUCCESS) and the
   * booking CAS inside confirmBookingInTransaction each admit exactly one
   * winner; duplicate deliveries and webhook/retrieve races are harmless.
   *
   * Throws PaymentReconciliationError (permanent) when the verified intent
   * contradicts persisted data or the booking can no longer be confirmed —
   * the booking is never blindly confirmed.
   */
  async finalizeSucceededIntent(
    intent: BoundIntentSnapshot,
    eventCtx?: { provider: string; eventId: string },
  ): Promise<{ paymentId: string; bookingId: string; confirmedNow: boolean }> {
    const payment = await this.locatePaymentForIntent(intent);
    if (!payment) {
      throw new UnknownProviderIntentError(
        `No payment recorded for intent ${intent.providerReference}`,
      );
    }

    // Never trust the provider blindly: the captured amount and currency must
    // match the persisted payment exactly.
    const expectedCents = toSmallestUnit(payment.amount, payment.currency);
    const expectedCurrency = normalizeCurrency(payment.currency);
    if (
      intent.amountCents !== expectedCents ||
      intent.currency !== expectedCurrency
    ) {
      throw new PaymentReconciliationError(
        `intent ${intent.providerReference} reports ${intent.amountCents} ${intent.currency}, expected ${expectedCents} ${expectedCurrency} (payment ${payment.id}) — booking NOT confirmed`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // CAS PENDING/FAILED→SUCCESS (a failed confirmation can be re-attempted
      // at the provider and later succeed — the verified success is final).
      // count 0 means a concurrent finalize already succeeded the payment.
      const cas = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          failedAt: null,
          providerStatus: 'succeeded',
        },
      });
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        select: { id: true, userId: true, status: true, bookingReference: true },
      });
      let confirmedNow = false;
      let seatNumbers: string[] = [];
      let holdCount = 0;
      if (booking.status === 'PENDING') {
        try {
          const details = await confirmBookingInTransaction(tx, booking.id);
          confirmedNow = true;
          seatNumbers = details.seatNumbers;
          holdCount = details.holdCount;
        } catch (error) {
          if (error instanceof BookingNotPendingError) {
            // A concurrent confirmation won between the read and the CAS.
            const fresh = await tx.booking.findUniqueOrThrow({
              where: { id: booking.id },
              select: { status: true },
            });
            if (fresh.status !== 'CONFIRMED') {
              throw new PaymentReconciliationError(
                `payment ${payment.id} captured but booking ${booking.bookingReference} is ${fresh.status} — manual reconciliation required`,
              );
            }
          } else if (error instanceof ConflictException) {
            // Money moved but the booking can no longer be confirmed (holds
            // expired, seats taken, …) — permanent; never retried silently.
            throw new PaymentReconciliationError(
              `payment ${payment.id} captured but booking ${booking.bookingReference} cannot be confirmed: ${error.message} — manual refund required`,
            );
          } else {
            throw error;
          }
        }
      } else if (booking.status !== 'CONFIRMED') {
        throw new PaymentReconciliationError(
          `payment ${payment.id} captured but booking ${booking.bookingReference} is ${booking.status} — manual reconciliation required`,
        );
      }
      if (eventCtx) {
        // Mark the webhook event inside the SAME transaction: a crash rolls
        // everything back, so the retried delivery reprocesses cleanly.
        await tx.paymentWebhookEvent.update({
          where: {
            provider_eventId: {
              provider: eventCtx.provider,
              eventId: eventCtx.eventId,
            },
          },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
      return {
        transitioned: cas.count === 1,
        confirmedNow,
        seatNumbers,
        holdCount,
        bookingReference: booking.bookingReference,
        bookingUserId: booking.userId,
      };
    });

    await this.logSystemPaymentEvent('PAYMENT_SUCCEEDED', payment.id, payment.bookingId, {
      providerReference: intent.providerReference,
      transitioned: result.transitioned,
      via: eventCtx ? 'webhook' : 'retrieve',
    });
    if (result.confirmedNow) {
      await this.logSystemBookingEvent('BOOKING_CONFIRMED', payment.bookingId, {
        bookingReference: result.bookingReference,
        paymentId: payment.id,
        via: eventCtx ? 'webhook' : 'retrieve',
      });
      await this.logSystemBookingEvent('SEAT_HOLD_CONVERTED', payment.bookingId, {
        bookingReference: result.bookingReference,
        seatNumbers: result.seatNumbers,
        holdCount: result.holdCount,
      });
    }
    // Post-commit, fail-soft customer notifications. Gating on the CAS
    // outcomes (transitioned / confirmedNow) plus per-entity dedupe keys
    // makes duplicate webhook deliveries and reconciliation replays no-ops.
    if (result.transitioned) {
      await this.safeNotify(
        () =>
          this.notifications.notifyPaymentSucceeded({
            userId: result.bookingUserId,
            paymentId: payment.id,
            bookingId: payment.bookingId,
            bookingReference: result.bookingReference,
          }),
        `PAYMENT_SUCCEEDED payment ${payment.id}`,
      );
      // Gated on the CAS outcome like the notifications above: duplicate
      // webhook deliveries and reconciliation replays emit nothing twice.
      this.emitPaymentStatus({
        bookingId: payment.bookingId,
        paymentId: payment.id,
        status: 'SUCCESS',
      });
    }
    if (result.confirmedNow) {
      await this.safeNotify(
        () =>
          this.notifications.notifyBookingConfirmed({
            userId: result.bookingUserId,
            bookingId: payment.bookingId,
            bookingReference: result.bookingReference,
          }),
        `BOOKING_CONFIRMED booking ${payment.bookingId}`,
      );
    }
    return {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      confirmedNow: result.confirmedNow,
    };
  }

  /**
   * payment_intent.payment_failed: the payment becomes FAILED; the booking
   * stays PENDING and its seat holds keep their own 15-minute expiry lifecycle
   * (no premature release, no new cancellation behavior). A late failure event
   * for an already-SUCCESS payment is ignored — it must never un-succeed.
   */
  async markIntentFailed(
    intent: BoundIntentSnapshot,
  ): Promise<'updated' | 'ignored'> {
    const payment = await this.locatePaymentForIntent(intent);
    if (!payment) {
      throw new UnknownProviderIntentError(
        `No payment recorded for intent ${intent.providerReference}`,
      );
    }
    if (payment.status !== 'PENDING') {
      this.logger.warn(
        `payment_failed arrived for payment ${payment.id} in status ${payment.status} (intent ${intent.providerReference}) — ignored`,
      );
      return 'ignored';
    }
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        providerStatus: intent.status,
      },
    });
    await this.logSystemPaymentEvent('PAYMENT_FAILED', payment.id, payment.bookingId, {
      providerReference: intent.providerReference,
      via: 'webhook',
    });
    await this.safeNotify(
      async () => {
        const booking = await this.prisma.booking.findUnique({
          where: { id: payment.bookingId },
          select: { userId: true, bookingReference: true },
        });
        if (!booking) {
          return;
        }
        await this.notifications.notifyPaymentFailed({
          userId: booking.userId,
          paymentId: payment.id,
          bookingId: payment.bookingId,
          bookingReference: booking.bookingReference,
        });
      },
      `PAYMENT_FAILED payment ${payment.id}`,
    );
    this.emitPaymentStatus({
      bookingId: payment.bookingId,
      paymentId: payment.id,
      status: 'FAILED',
    });
    return 'updated';
  }

  /** payment_intent.canceled: the open attempt becomes FAILED (canceled). */
  async markIntentCanceled(
    intent: BoundIntentSnapshot,
  ): Promise<'updated' | 'ignored'> {
    const payment = await this.locatePaymentForIntent(intent);
    if (!payment) {
      throw new UnknownProviderIntentError(
        `No payment recorded for intent ${intent.providerReference}`,
      );
    }
    if (payment.status !== 'PENDING') {
      return 'ignored';
    }
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        providerStatus: 'canceled',
      },
    });
    await this.logSystemPaymentEvent('PAYMENT_CANCELED', payment.id, payment.bookingId, {
      providerReference: intent.providerReference,
      via: 'webhook',
    });
    this.emitPaymentStatus({
      bookingId: payment.bookingId,
      paymentId: payment.id,
      status: 'FAILED',
    });
    return 'updated';
  }

  /**
   * payment_intent.processing / payment_intent.requires_action: no state
   * machine change — the payment stays PENDING; only the fine-grained provider
   * status is tracked for observability. Neither is a success signal.
   */
  async noteIntentStatus(intent: BoundIntentSnapshot): Promise<void> {
    const payment = await this.locatePaymentForIntent(intent);
    if (!payment) {
      throw new UnknownProviderIntentError(
        `No payment recorded for intent ${intent.providerReference}`,
      );
    }
    if (payment.status === 'PENDING') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { providerStatus: intent.status },
      });
    }
  }

  async findOwnPayments(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      select: { id: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.listOwnPayments(bookingId);
  }

  /**
   * On-demand reconciliation of the customer's OWN booking payment — the
   * customer-triggerable counterpart of the reconciliation sweep, for the
   * "webhook delayed or lost" window. Retrieval only: it never creates a
   * PaymentIntent, charge, or idempotency key, and it never accepts a
   * provider reference from the client — the intent is looked up from the
   * persisted open payment. Verified states funnel through the same
   * CAS-protected handlers as the signed webhook, so webhook/reconcile/resume
   * races converge idempotently. Provider outages and permanent mismatches
   * leave the payment PENDING and are logged (ids only — never the snapshot,
   * which carries a client secret); the response is always the current
   * authoritative payment list.
   */
  async reconcileOwnPayment(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      select: { id: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (isPaymentIntentProvider(this.provider)) {
      const open = await this.prisma.payment.findFirst({
        where: {
          bookingId,
          status: 'PENDING',
          provider: this.provider.name,
          providerReference: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, bookingId: true, providerReference: true },
      });
      if (open?.providerReference) {
        await this.reconcileOpenIntent({
          id: open.id,
          bookingId,
          providerReference: open.providerReference,
        });
      }
    }

    return this.listOwnPayments(bookingId);
  }

  private async listOwnPayments(bookingId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toPaymentView(p));
  }

  /**
   * Maps a retrieved PaymentIntent state onto the same handlers the webhook
   * pipeline dispatches to — no second implementation of any transition.
   * `payment_failed` is a webhook EVENT, not a retrievable intent state, and
   * open/ambiguous states only note the provider status: nothing here ever
   * fabricates FAILED or SUCCESS from an unverified observation.
   */
  private async reconcileOpenIntent(open: {
    id: string;
    bookingId: string;
    providerReference: string;
  }): Promise<void> {
    try {
      const snapshot = await this.intentProvider().retrievePaymentIntent(
        open.providerReference,
      );
      const bound = { ...snapshot, paymentId: open.id };
      switch (snapshot.status) {
        case 'succeeded':
          await this.finalizeSucceededIntent(bound);
          break;
        case 'canceled':
          await this.markIntentCanceled(bound);
          break;
        case 'processing':
        case 'requires_action':
        case 'requires_payment_method':
        case 'requires_confirmation':
          await this.noteIntentStatus(bound);
          break;
        default:
          throw new Error(
            `Unsupported PaymentIntent status: ${String((snapshot as PaymentIntentSnapshot).status)}`,
          );
      }
    } catch (error) {
      if (error instanceof PaymentReconciliationError) {
        // Permanent: verified state contradicts persisted data — manual
        // reconciliation required; the payment is never blindly confirmed.
        this.logger.error(
          `reconcile payment ${open.id} (booking ${open.bookingId}): ${error.message}`,
        );
      } else {
        // Transient (Stripe timeout/network/5xx, unknown status): the payment
        // stays PENDING and is retried by the next tick/webhook/sweep.
        this.logger.warn(
          `reconcile payment ${open.id} (booking ${open.bookingId}) failed transiently: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // ---------- Staff reads (payments:read) ----------

  async findAllAdmin(query: AdminPaymentQueryDto) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: query.status,
        bookingId: query.bookingId,
        createdAt: {
          gte: query.from ? new Date(`${query.from}T00:00:00Z`) : undefined,
          lte: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
        },
        booking: query.reference
          ? { bookingReference: query.reference.toUpperCase() }
          : undefined,
      },
      include: ADMIN_PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toAdminPaymentView(p));
  }

  async findOneAdmin(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: ADMIN_PAYMENT_INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toAdminPaymentView(payment);
  }

  /**
   * Operational refund listing (Phase 3.4D). Paginated, database-backed (no
   * provider calls), with practical filters; every row carries the pending
   * age, the recovery eligibility flag and the stable recovery identity.
   */
  async findRefundsAdmin(query: AdminRefundQueryDto) {
    const now = Date.now();
    // Pending-age filters only make sense for PENDING refunds and force that
    // status (a PENDING row's age is always now - createdAt).
    const pendingAgeFiltered =
      query.pendingMinAgeMinutes !== undefined ||
      query.pendingMaxAgeMinutes !== undefined;
    let gte = query.from ? new Date(query.from) : undefined;
    let lte = query.to ? new Date(query.to) : undefined;
    if (query.pendingMinAgeMinutes !== undefined) {
      const cutoff = new Date(now - query.pendingMinAgeMinutes * 60_000);
      lte = lte && lte < cutoff ? lte : cutoff;
    }
    const gt =
      query.pendingMaxAgeMinutes !== undefined
        ? new Date(now - query.pendingMaxAgeMinutes * 60_000)
        : undefined;
    const createdFilter = gte || lte || gt ? { gte, lte, gt } : undefined;

    const where: Prisma.RefundWhereInput = {
      status: pendingAgeFiltered ? 'PENDING' : query.status,
      bookingId: query.bookingId,
      id: query.refundId,
      paymentId: query.paymentId,
      booking: query.bookingReference
        ? { bookingReference: query.bookingReference.toUpperCase() }
        : undefined,
      // One box, two strong identifiers: the refund's own provider reference
      // (re_…) or the payment's provider reference (pi_…).
      ...(query.providerReference
        ? {
            OR: [
              { providerReference: query.providerReference },
              { payment: { providerReference: query.providerReference } },
            ],
          }
        : {}),
      ...(createdFilter ? { createdAt: createdFilter } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: {
          payment: { select: { providerReference: true, status: true } },
          booking: { select: { bookingReference: true, contactEmail: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    const recoveryMinAgeMinutes = resolveRefundReconciliationMinAgeMinutes(
      this.config.get('PAYMENT_REFUND_RECONCILIATION_MIN_AGE_MINUTES'),
    );
    return {
      items: rows.map((r) => this.toAdminRefundOpsView(r, recoveryMinAgeMinutes)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /**
   * Live operational snapshot (Phase 3.4D/3.4F): pending aging buckets, stuck
   * count, unmatched orphans, the in-process metrics snapshot and the
   * currently active alert conditions. Database-backed, never a provider call.
   */
  async getRefundOperations() {
    const pendingRows = await this.prisma.refund.findMany({
      where: { status: 'PENDING' },
      select: { createdAt: true },
    });
    const stuckThresholdMinutes = resolveRefundAlertPendingMinutes(
      this.config.get('PAYMENT_REFUND_ALERT_PENDING_MINUTES'),
    );
    const now = Date.now();
    // Presentation categories only — the refund stays PENDING regardless.
    const buckets = {
      lt5m: 0,
      m5to15: 0,
      m15to60: 0,
      h1to6: 0,
      h6to24: 0,
      gt24h: 0,
    };
    let stuck = 0;
    for (const row of pendingRows) {
      const ageMinutes = Math.max(
        0,
        Math.floor((now - row.createdAt.getTime()) / 60_000),
      );
      if (ageMinutes < 5) buckets.lt5m += 1;
      else if (ageMinutes < 15) buckets.m5to15 += 1;
      else if (ageMinutes < 60) buckets.m15to60 += 1;
      else if (ageMinutes < 360) buckets.h1to6 += 1;
      else if (ageMinutes < 1440) buckets.h6to24 += 1;
      else buckets.gt24h += 1;
      if (ageMinutes >= stuckThresholdMinutes) {
        stuck += 1;
      }
    }
    const orphansUnmatched = await this.prisma.orphanProviderRefund.count({
      where: { status: 'UNMATCHED' },
    });
    this.metrics.setGauge(REFUND_GAUGES.pending, pendingRows.length);
    this.metrics.setGauge(REFUND_GAUGES.pendingStuck, stuck);
    this.metrics.setGauge(REFUND_GAUGES.orphansUnmatched, orphansUnmatched);
    return {
      generatedAt: new Date(now).toISOString(),
      pending: {
        total: pendingRows.length,
        buckets,
        stuckThresholdMinutes,
        stuck,
      },
      orphans: { unmatched: orphansUnmatched },
      metrics: this.metrics.snapshot(),
      alerts: { active: this.metrics.activeAlertConditions() },
    };
  }

  // ---------- Orphan provider-refund discovery (Phase 3.4E) ----------

  /**
   * Read-only provider-side refund discovery for ONE payment. Finds refunds
   * the provider holds for the payment's provider reference and reconciles
   * them against local rows using STRONG matching only:
   *
   * 1. metadata match — the refund was created with `metadata.refundId`
   *    naming a local Refund row (written by this system at creation time).
   *    A PENDING owner is converged locally via the exact Batch 1 finalization
   *    (payment-row lock + CAS) WITHOUT any provider mutation — discovery
   *    never creates a refund, it only records what already exists;
   * 2. reference match — the provider refund id (re_…) is already recorded on
   *    a local refund: already reconciled, nothing to do;
   * 3. no match — NEVER guessed by amount/timestamp/customer: recorded as an
   *    UNMATCHED orphan (idempotent per provider refund id) for operational
   *    investigation, audited and counted.
   *
   * Orphans whose provider reference later appears locally are auto-resolved.
   * Provider errors propagate to the caller's per-record isolation — no local
   * state is changed by a failed lookup.
   */
  async discoverProviderRefundsForPayment(paymentId: string): Promise<{
    checked: boolean;
    adopted: number;
    unmatchedNew: number;
  }> {
    const notEligible = { checked: false, adopted: 0, unmatchedNew: 0 };
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        refunds: true,
        booking: {
          select: {
            bookingReference: true,
            status: true,
            fareRulesSnapshot: true,
          },
        },
      },
    });
    if (
      !payment ||
      !payment.providerReference ||
      payment.provider !== this.provider.name ||
      (payment.status !== 'SUCCESS' && payment.status !== 'PARTIALLY_REFUNDED')
    ) {
      return notEligible;
    }

    // ONE bounded read-only provider call per eligible payment.
    const providerRefunds = await this.provider.listRefundsForPayment(
      payment.providerReference,
    );

    const localById = new Map(payment.refunds.map((r) => [r.id, r]));
    const localByProviderRef = new Map(
      payment.refunds
        .filter((r) => r.providerReference !== null)
        .map((r) => [r.providerReference as string, r]),
    );

    let adopted = 0;
    let unmatchedNew = 0;
    const matchedProviderRefs: string[] = [];
    for (const found of providerRefunds) {
      const owner = found.metadataRefundId
        ? localById.get(found.metadataRefundId)
        : undefined;
      if (owner && owner.status !== 'REJECTED') {
        matchedProviderRefs.push(found.providerReference);
        if (owner.status === 'PENDING') {
          const won = await this.finalizeRefundProcessed(
            owner,
            payment,
            found.providerReference,
          );
          if (won !== null) {
            adopted += 1;
            this.metrics.increment(REFUND_COUNTERS.orphansAdopted);
            await this.logSystemRefundCompleted(
              { ...owner, status: 'PROCESSED' },
              payment,
              found.providerReference,
              'orphan-discovery',
            );
          }
        }
        continue;
      }
      if (localByProviderRef.has(found.providerReference)) {
        matchedProviderRefs.push(found.providerReference);
        continue;
      }
      // Unmatched (also when the metadata owner is REJECTED — a contradiction
      // worth investigating): flag, never guess, never re-refund.
      if (await this.recordOrphanRefund(payment, found)) {
        unmatchedNew += 1;
      }
    }

    // Auto-resolve earlier orphans whose provider reference has since been
    // recorded locally (e.g. a recovery wrote it after the flag was raised).
    if (matchedProviderRefs.length > 0) {
      const resolvable = await this.prisma.orphanProviderRefund.findMany({
        where: {
          provider: this.provider.name,
          providerRefundReference: { in: matchedProviderRefs },
          status: 'UNMATCHED',
        },
      });
      for (const orphan of resolvable) {
        const cas = await this.prisma.orphanProviderRefund.updateMany({
          where: { id: orphan.id, status: 'UNMATCHED' },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });
        if (cas.count === 1) {
          await this.logOrphanResolved(null, orphan);
        }
      }
    }

    this.metrics.setGauge(
      REFUND_GAUGES.orphansUnmatched,
      await this.prisma.orphanProviderRefund.count({
        where: { status: 'UNMATCHED' },
      }),
    );
    return { checked: true, adopted, unmatchedNew };
  }

  /** Paginated orphan provider-refund listing (Phase 3.4D/3.4E). */
  async findOrphanRefundsAdmin(query: AdminOrphanRefundQueryDto) {
    const where: Prisma.OrphanProviderRefundWhereInput = {
      status: query.status,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.orphanProviderRefund.findMany({
        where,
        orderBy: { firstSeenAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.orphanProviderRefund.count({ where }),
    ]);
    return {
      items: rows.map((o) => this.toAdminOrphanRefundView(o)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /**
   * Marks an investigated orphan RESOLVED (idempotent, audited with the staff
   * identity). This is an operational decision record only — it never touches
   * the provider and never creates a refund.
   */
  async resolveOrphanRefund(staff: AuthUser, orphanId: string, note?: string) {
    const orphan = await this.prisma.orphanProviderRefund.findUnique({
      where: { id: orphanId },
    });
    if (!orphan) {
      throw new NotFoundException('Orphan provider refund not found');
    }
    if (orphan.status === 'UNMATCHED') {
      const cas = await this.prisma.orphanProviderRefund.updateMany({
        where: { id: orphan.id, status: 'UNMATCHED' },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: staff.userId,
          resolutionNote: note ?? null,
        },
      });
      if (cas.count === 1) {
        await this.logOrphanResolved(staff, orphan);
      }
    }
    const updated = await this.prisma.orphanProviderRefund.findUniqueOrThrow({
      where: { id: orphan.id },
    });
    return this.toAdminOrphanRefundView(updated);
  }

  /** Persists an UNMATCHED orphan record; idempotent per provider refund id. */
  private async recordOrphanRefund(
    payment: Payment,
    found: ProviderRefundLookup,
  ): Promise<boolean> {
    const now = new Date();
    try {
      const orphan = await this.prisma.orphanProviderRefund.create({
        data: {
          provider: this.provider.name,
          providerRefundReference: found.providerReference,
          paymentProviderReference: payment.providerReference!,
          amount: fromCents(found.amountCents),
          currency: found.currency,
          lastSeenAt: now,
        },
      });
      this.metrics.increment(REFUND_COUNTERS.orphansDiscovered);
      try {
        await this.auditService.log({
          actorType: 'System',
          action: 'REFUND_ORPHAN_DISCOVERED',
          targetType: 'OrphanProviderRefund',
          targetId: orphan.id,
          bookingId: payment.bookingId,
          metadata: {
            paymentId: payment.id,
            providerRefundReference: orphan.providerRefundReference,
            paymentProviderReference: orphan.paymentProviderReference,
            amount: Number(orphan.amount),
            currency: orphan.currency,
          },
        });
      } catch (error) {
        this.logger.warn(
          `audit log failed for REFUND_ORPHAN_DISCOVERED ${orphan.id}: ${String(error)}`,
        );
      }
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Already flagged (duplicate sweep / overlapping discovery): refresh
        // the sighting only — no duplicate record, no duplicate audit.
        await this.prisma.orphanProviderRefund.update({
          where: {
            provider_providerRefundReference: {
              provider: this.provider.name,
              providerRefundReference: found.providerReference,
            },
          },
          data: { lastSeenAt: now },
        });
        return false;
      }
      throw error;
    }
  }

  /** Orphan resolution audit — staff actor for manual, System for automatic. */
  private async logOrphanResolved(
    staff: AuthUser | null,
    orphan: OrphanProviderRefund,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorId: staff?.userId,
        actorType: staff ? this.actorTypeOf(staff) : 'System',
        action: 'REFUND_ORPHAN_RESOLVED',
        targetType: 'OrphanProviderRefund',
        targetId: orphan.id,
        metadata: {
          providerRefundReference: orphan.providerRefundReference,
          paymentProviderReference: orphan.paymentProviderReference,
        },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for REFUND_ORPHAN_RESOLVED ${orphan.id}: ${String(error)}`,
      );
    }
  }

  private toAdminOrphanRefundView(orphan: OrphanProviderRefund) {
    return {
      id: orphan.id,
      provider: orphan.provider,
      providerRefundReference: orphan.providerRefundReference,
      paymentProviderReference: orphan.paymentProviderReference,
      amount: Number(orphan.amount),
      currency: orphan.currency,
      status: orphan.status,
      firstSeenAt: orphan.firstSeenAt,
      lastSeenAt: orphan.lastSeenAt,
      resolvedAt: orphan.resolvedAt,
      resolutionNote: orphan.resolutionNote,
    };
  }

  // ---------- Staff refunds (payments:refund) ----------

  async refundPayment(
    staff: AuthUser,
    paymentId: string,
    dto: RefundPaymentDto,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        refunds: true,
        booking: {
          select: { bookingReference: true, status: true, contactEmail: true },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      payment.status !== 'SUCCESS' &&
      payment.status !== 'PARTIALLY_REFUNDED'
    ) {
      throw new ConflictException('Only successful payments can be refunded');
    }
    if (!payment.providerReference) {
      throw new ConflictException(
        'Payment has no provider reference and cannot be refunded',
      );
    }

    const totalCents = toCents(Number(payment.amount));
    const reservedCents = this.reservedCents(payment.refunds);
    const requestedCents =
      dto.amount === undefined
        ? totalCents - reservedCents
        : toCents(dto.amount);
    if (requestedCents <= 0) {
      throw new ConflictException('Payment is already fully refunded');
    }
    if (requestedCents > totalCents - reservedCents) {
      throw new ConflictException(
        `Refund exceeds the refundable remainder of ${fromCents(totalCents - reservedCents).toFixed(2)} ${payment.currency}`,
      );
    }

    // Record-first: persist the refund as PENDING under the payment row lock
    // (re-validating the remainder against committed rows) BEFORE moving money
    // at the provider. A provider refund can never be un-done, so the reverse
    // order would leave refunded money without any database record whenever
    // the transaction rejected afterwards.
    const refund = await this.prisma.$transaction(async (tx) => {
      // Lock the payment row so concurrent refunds on the same payment
      // serialize and re-validate against committed refunds.
      await tx.payment.update({
        where: { id: payment.id },
        data: { provider: payment.provider },
      });
      const committed = await tx.refund.findMany({
        where: {
          paymentId: payment.id,
          status: { in: ['PENDING', 'PROCESSED'] },
        },
        select: { amount: true },
      });
      const committedCents = committed.reduce(
        (sum, r) => sum + toCents(Number(r.amount)),
        0,
      );
      if (requestedCents > totalCents - committedCents) {
        throw new ConflictException('Refund exceeds the refundable remainder');
      }
      return tx.refund.create({
        data: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          amount: fromCents(requestedCents),
          currency: payment.currency,
          status: 'PENDING',
          reason: dto.reason ?? null,
        },
      });
    });

    this.metrics.increment(REFUND_COUNTERS.created);

    let providerRefund;
    try {
      providerRefund = await this.provider.refund({
        amount: fromCents(requestedCents),
        currency: payment.currency,
        paymentProviderReference: payment.providerReference,
        // Provider idempotency key = the persisted Refund row id: a retry of
        // the same refund can never move money twice at the provider.
        idempotencyKey: `refund-${refund.id}`,
        metadataRefundId: refund.id,
      });
    } catch (error) {
      if (error instanceof ProviderDefinitiveError) {
        // Definitive business rejection (e.g. charge already fully refunded) —
        // the ONLY case where REJECTED is a safe terminal state.
        await this.rejectRefund(
          refund.id,
          `provider definitively rejected the refund for payment ${payment.id}: ${error.message}`,
        );
        throw new HttpException(
          'Refund was rejected by the payment provider',
          HttpStatus.BAD_GATEWAY,
        );
      }
      // AMBIGUOUS outcome (timeout/connection reset/5xx/lost response): the
      // refund may already exist at the provider. NEVER mark it REJECTED —
      // it stays PENDING, keeps reserving the remainder, and is converged by
      // recovery (resume) or the refund reconciliation sweep (Batch 3.4A).
      this.metrics.increment(REFUND_COUNTERS.ambiguousOutcomes);
      this.logger.warn(
        `provider refund outcome ambiguous for refund ${refund.id} (payment ${payment.id}) — left PENDING for recovery: ${String(error)}`,
      );
      await this.safeNotify(
        () => this.alertRefundAmbiguous(refund.id),
        `REFUND_AMBIGUOUS refund ${refund.id}`,
      );
      throw new HttpException(
        'Refund outcome at the payment provider is uncertain — the refund was left pending and can be resumed safely',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const newPaymentStatus = await this.finalizeDirectRefundSuccess(
      refund.id,
      payment,
      providerRefund.providerReference,
      totalCents,
    );

    const processedRefund = {
      ...refund,
      status: 'PROCESSED' as const,
      processedAt: new Date(),
      providerReference: providerRefund.providerReference,
    };
    if (newPaymentStatus !== null) {
      // Only the CAS winner emits the completion effects; a concurrent
      // finalizer (recovery/sweep) already emitted them when null.
      await this.logRefundEvent(
        staff,
        processedRefund,
        payment,
        providerRefund.providerReference,
      );
      await this.safeNotify(
        () => this.notifyRefundProcessedById(processedRefund.id),
        `REFUND_PROCESSED refund ${processedRefund.id}`,
      );
    }
    const updated = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: ADMIN_PAYMENT_INCLUDE,
    });
    const finalRefund =
      newPaymentStatus !== null
        ? processedRefund
        : await this.prisma.refund.findUniqueOrThrow({
            where: { id: refund.id },
          });
    return {
      refund: this.toAdminRefundView({
        ...finalRefund,
        payment: {
          providerReference: payment.providerReference,
          status: newPaymentStatus ?? updated.status,
        },
        booking: payment.booking,
      }),
      payment: this.toAdminPaymentView(updated),
    };
  }

  // ---------- Refund recovery (payments:refund) ----------

  /**
   * Resumes a stuck PENDING refund — one whose provider call may already have
   * succeeded while the local completion was lost (API crash, lost response).
   *
   * Recovery replays the ORIGINAL provider call with the exact same provider
   * idempotency key (`refund-${refund.id}`), so Stripe resolves the retry to
   * the original refund instead of ever moving money twice, then finalizes the
   * persisted row exactly like the original success path (PROCESSED + provider
   * reference + payment status recomputation + REFUND_COMPLETED audit).
   *
   * Safety contract (Batch 3.4A/B):
   * - PROCESSED refunds replay the recorded result without a provider call;
   * - REJECTED refunds are terminal (their amount was freed for a NEW refund
   *   attempt) and are never resurrected;
   * - a DEFINITIVE provider rejection (ProviderDefinitiveError) is the only
   *   path that marks the refund REJECTED — answered 409;
   * - every other provider failure is AMBIGUOUS — the refund may already
   *   exist at Stripe — so the row is left PENDING and recoverable, answered
   *   502, never marked REJECTED;
   * - concurrent resumers are harmless: the provider idempotency key yields
   *   the same provider refund for all of them, and the PENDING→PROCESSED CAS
   *   inside the payment-row-locked finalization transaction admits exactly
   *   one winner; the loser returns the winner's committed state.
   */
  async resumeRefund(staff: AuthUser, refundId: string) {
    const { outcome, view } = await this.recoverRefund(refundId, staff);
    // Manual recovery is always audited with its outcome — including the
    // still-ambiguous (502) and definitively-rejected (409) results below.
    await this.logRecoveryRequested(staff, refundId, outcome);
    if (outcome === 'pending') {
      throw new BadGatewayException(
        'Refund outcome at the provider is uncertain — the refund was left PENDING and can be resumed again',
      );
    }
    if (outcome === 'rejected') {
      throw new ConflictException(
        'Refund was definitively rejected by the payment provider',
      );
    }
    return view;
  }

  /** Manual-recovery audit (who, on which refund, with which outcome). */
  private async logRecoveryRequested(
    staff: AuthUser,
    refundId: string,
    outcome: 'processed' | 'pending' | 'rejected',
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorId: staff.userId,
        actorType: this.actorTypeOf(staff),
        action: 'REFUND_RECOVERY_REQUESTED',
        targetType: 'Refund',
        targetId: refundId,
        metadata: { refundId, outcome },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for REFUND_RECOVERY_REQUESTED ${refundId}: ${String(error)}`,
      );
    }
  }

  /**
   * Scheduled refund reconciliation entry point (Phase 3.4C): the exact same
   * recovery flow as resumeRefund — audited with a System actor instead of a
   * staff actor. Returns the convergence outcome for sweep bookkeeping.
   */
  async reconcileRefund(
    refundId: string,
  ): Promise<'processed' | 'pending' | 'rejected'> {
    return (await this.recoverRefund(refundId, null)).outcome;
  }

  /**
   * Shared recovery core. Replays the ORIGINAL provider call with the exact
   * same provider idempotency key (`refund-${refund.id}`): Stripe resolves the
   * replay to the original refund when it exists, and executes it exactly once
   * when it never did — a retry can never move money twice. Outcomes:
   * - 'processed': refund completed (by this call or an earlier one);
   * - 'pending': AMBIGUOUS provider outcome (timeout/network/5xx) — the refund
   *   may exist at Stripe; left PENDING and recoverable, never REJECTED;
   * - 'rejected': DEFINITIVE provider rejection (ProviderDefinitiveError) —
   *   the only terminal-rejection path.
   * `actor` is the staff user for the admin endpoint, null for the sweep
   * (System audit).
   */
  private async recoverRefund(
    refundId: string,
    actor: AuthUser | null,
  ): Promise<{
    outcome: 'processed' | 'pending' | 'rejected';
    view: {
      refund: ReturnType<PaymentsService['toAdminRefundView']>;
      payment: ReturnType<PaymentsService['toAdminPaymentView']>;
    } | null;
  }> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          include: {
            refunds: true,
            booking: {
              select: {
                bookingReference: true,
                status: true,
                contactEmail: true,
                fareRulesSnapshot: true,
              },
            },
          },
        },
        booking: {
          select: { bookingReference: true, contactEmail: true },
        },
      },
    });
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }
    const payment = refund.payment;

    if (refund.status === 'PROCESSED') {
      return {
        outcome: 'processed',
        view: {
          refund: this.toAdminRefundView({
            ...refund,
            payment: {
              providerReference: payment.providerReference,
              status: payment.status,
            },
          }),
          payment: this.toAdminPaymentView(payment),
        },
      };
    }
    if (refund.status !== 'PENDING') {
      throw new ConflictException(
        `Only PENDING refunds can be resumed (this refund is ${refund.status})`,
      );
    }
    if (!payment.providerReference) {
      throw new ConflictException(
        'Payment has no provider reference and cannot be refunded',
      );
    }

    // No transaction is held across the provider call — same boundary as the
    // original refund flow (record committed first, provider second, finalize
    // last).
    this.metrics.increment(REFUND_COUNTERS.recoveryAttempts);
    let providerRefund: ProviderRefundResult;
    try {
      providerRefund = await this.provider.refund({
        amount: Number(refund.amount),
        currency: refund.currency,
        paymentProviderReference: payment.providerReference,
        idempotencyKey: `refund-${refund.id}`,
        metadataRefundId: refund.id,
      });
    } catch (error) {
      if (error instanceof ProviderDefinitiveError) {
        // Definitive business rejection — the ONLY safe terminal rejection.
        await this.rejectRefund(
          refund.id,
          `recovery: provider definitively rejected refund ${refund.id}: ${error.message}`,
        );
        this.metrics.increment(REFUND_COUNTERS.recoveryRejected);
        const rejectedRefund = await this.prisma.refund.findUniqueOrThrow({
          where: { id: refund.id },
          include: {
            payment: { select: { providerReference: true, status: true } },
            booking: { select: { bookingReference: true, contactEmail: true } },
          },
        });
        const rejectedPayment = await this.prisma.payment.findUniqueOrThrow({
          where: { id: payment.id },
          include: ADMIN_PAYMENT_INCLUDE,
        });
        return {
          outcome: 'rejected',
          view: {
            refund: this.toAdminRefundView(rejectedRefund),
            payment: this.toAdminPaymentView(rejectedPayment),
          },
        };
      }
      // AMBIGUOUS — never fabricate a local result; stays recoverable.
      this.metrics.increment(REFUND_COUNTERS.ambiguousOutcomes);
      this.metrics.increment(REFUND_COUNTERS.recoveryPending);
      this.logger.warn(
        `recoverRefund: provider outcome ambiguous for refund ${refund.id} (left PENDING): ${String(error)}`,
      );
      await this.safeNotify(
        () => this.alertRefundAmbiguous(refund.id),
        `REFUND_AMBIGUOUS refund ${refund.id}`,
      );
      return { outcome: 'pending', view: null };
    }

    const newPaymentStatus = await this.finalizeRefundProcessed(
      refund,
      payment,
      providerRefund.providerReference,
    );

    const finalizedRefund = await this.prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
      include: {
        payment: { select: { providerReference: true, status: true } },
        booking: { select: { bookingReference: true, contactEmail: true } },
      },
    });
    const updatedPayment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: ADMIN_PAYMENT_INCLUDE,
    });

    if (newPaymentStatus !== null) {
      // The CAS winner audits the completion exactly like the original flows.
      if (actor) {
        await this.logRefundEvent(
          actor,
          finalizedRefund,
          payment,
          providerRefund.providerReference,
        );
      } else {
        await this.logSystemRefundCompleted(
          finalizedRefund,
          payment,
          providerRefund.providerReference,
        );
      }
    }
    this.metrics.increment(REFUND_COUNTERS.recoveryProcessed);
    return {
      outcome: 'processed',
      view: {
        refund: this.toAdminRefundView(finalizedRefund),
        payment: this.toAdminPaymentView(updatedPayment),
      },
    };
  }

  /**
   * Shared PENDING→PROCESSED finalization, used by recoverRefund (provider
   * replay) and orphan adoption (a provider refund strongly matched to a local
   * PENDING row). The payment-row lock serializes with every other refund flow
   * and the CAS admits exactly one winner. Returns the recomputed payment
   * status, or null when a concurrent finalizer won.
   *
   * Cancellation-request hook: when the refund belongs to an approved customer
   * cancellation request, the booking's own cancellation is finalized
   * post-commit (exactly once — CAS-guarded) so EVERY refund-success path
   * (initial execution, resume, recovery, reconciliation sweep, orphan
   * adoption) converges the booking to CANCELLED. Refunds without a linked
   * request are untouched.
   */
  private async finalizeRefundProcessed(
    refund: Refund,
    payment: Payment & {
      booking: { status: BookingStatus; fareRulesSnapshot: unknown };
    },
    providerReference: string,
  ): Promise<Payment['status'] | null> {
    const status = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { provider: payment.provider },
      });
      const cas = await tx.refund.updateMany({
        where: { id: refund.id, status: 'PENDING' },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          providerReference,
        },
      });
      if (cas.count !== 1) {
        return null;
      }
      const processed = await tx.refund.findMany({
        where: { paymentId: payment.id, status: 'PROCESSED' },
        select: { amount: true },
      });
      const processedCents = processed.reduce(
        (sum, r) => sum + toCents(Number(r.amount)),
        0,
      );
      const status: Payment['status'] =
        processedCents >= this.refundSettlementCents(payment)
          ? 'REFUNDED'
          : 'PARTIALLY_REFUNDED';
      await tx.payment.update({ where: { id: payment.id }, data: { status } });
      return status;
    });
    if (status !== null) {
      await this.finalizeBookingForCancellationRefund(refund.id);
      await this.safeNotify(
        () => this.notifyRefundProcessedById(refund.id),
        `REFUND_PROCESSED refund ${refund.id}`,
      );
    }
    return status;
  }

  /**
   * Lock+CAS finalization for a provider-verified refund success, shared by
   * the direct refund paths (refundPayment, customer/admin cancellation).
   * Mirrors finalizeRefundProcessed's discipline — the payment row lock
   * serializes concurrent finalizations of refunds on the same payment, and
   * the PENDING→PROCESSED CAS admits exactly one winner — but keeps each
   * caller's own settlement threshold, because refundPayment settles at the
   * full payment amount while cancellation flows settle at the fare-policy
   * target. Returns the recomputed aggregate payment status for the winner,
   * or null when a concurrent finalizer already settled this refund; the
   * caller MUST skip its completion audit/notification on null (the winner
   * already emitted them).
   */
  private async finalizeDirectRefundSuccess(
    refundId: string,
    payment: Payment,
    providerReference: string,
    settlementCents: number,
  ): Promise<Payment['status'] | null> {
    return this.prisma.$transaction(async (tx) => {
      // Same-value write acquires the payment row lock (see
      // finalizeRefundProcessed) — concurrent finalizations serialize here.
      await tx.payment.update({
        where: { id: payment.id },
        data: { provider: payment.provider },
      });
      const cas = await tx.refund.updateMany({
        where: { id: refundId, status: 'PENDING' },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          providerReference,
        },
      });
      if (cas.count !== 1) {
        return null;
      }
      const processed = await tx.refund.findMany({
        where: { paymentId: payment.id, status: 'PROCESSED' },
        select: { amount: true },
      });
      const processedCents = processed.reduce(
        (sum, r) => sum + toCents(Number(r.amount)),
        0,
      );
      const status: Payment['status'] =
        processedCents >= settlementCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({ where: { id: payment.id }, data: { status } });
      return status;
    });
  }

  /**
   * Post-commit cancellation-request hook of finalizeRefundProcessed: finds
   * the CancellationRequest linked to the now-PROCESSED refund and, when its
   * booking is still CONFIRMED, runs the booking-cancellation finalization
   * (shared helper — CAS CONFIRMED→CANCELLED + BookingSeat release + hold
   * release) with the same post-commit intent cancellation as every other
   * cancel path. Fail-soft: the refund outcome is already committed and must
   * never be masked by a finalization problem.
   */
  private async finalizeBookingForCancellationRefund(
    refundId: string,
  ): Promise<void> {
    try {
      const request = await this.prisma.cancellationRequest.findFirst({
        where: { refundId },
        include: {
          booking: {
            select: { id: true, status: true, bookingReference: true },
          },
        },
      });
      if (!request || request.booking.status !== 'CONFIRMED') {
        return;
      }
      const released = await this.prisma.$transaction((tx) =>
        this.cancelConfirmedBookingInTx(tx, request.booking.id),
      );
      if (!released) {
        // A racing finalizer (or a direct admin cancel) already moved the
        // booking out of CONFIRMED — exactly-once is preserved.
        return;
      }
      await this.logSystemBookingEvent('BOOKING_CANCELLED', request.booking.id, {
        bookingReference: request.booking.bookingReference,
        via: 'cancellation-request',
      });
      if (released.releasedCount > 0) {
        await this.logSystemBookingEvent('SEAT_HOLD_RELEASED', request.booking.id, {
          bookingReference: request.booking.bookingReference,
          holdCount: released.releasedCount,
        });
      }
      await this.cancelOpenIntentsForCancelledBooking(request.booking.id);
    } catch (error) {
      this.logger.warn(
        `cancellation-request booking finalization failed for refund ${refundId}: ${String(error)}`,
      );
    }
  }

  /**
   * Shared CONFIRMED→CANCELLED finalization block for the cancellation-request
   * workflow: CAS the booking status and release its seat inventory (BookingSeat
   * rows + ACTIVE holds) atomically. Mirrors the block the existing cancel
   * paths inline — extracted for the new flow only; those paths are
   * deliberately untouched. Returns null when the CAS lost (the booking is no
   * longer CONFIRMED).
   */
  private async cancelConfirmedBookingInTx(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ): Promise<{ releasedCount: number; releasedSeatCount: number } | null> {
    const cas = await tx.booking.updateMany({
      where: { id: bookingId, status: 'CONFIRMED' },
      data: { status: 'CANCELLED' },
    });
    if (cas.count !== 1) {
      return null;
    }
    const seats = await tx.bookingSeat.deleteMany({
      where: { bookingPassenger: { bookingId } },
    });
    const released = await tx.seatHold.updateMany({
      where: { bookingId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
    return { releasedCount: released.count, releasedSeatCount: seats.count };
  }

  /** System-actor refund-completion audit (scheduled refund reconciliation). */
  private async logSystemRefundCompleted(
    refund: Refund,
    payment: Payment & { booking: { bookingReference: string } },
    providerReference: string,
    via: 'reconciliation' | 'orphan-discovery' = 'reconciliation',
  ): Promise<void> {
    this.metrics.increment(REFUND_COUNTERS.processed);
    try {
      await this.auditService.log({
        actorType: 'System',
        action: 'REFUND_COMPLETED',
        targetType: 'Refund',
        targetId: refund.id,
        bookingId: refund.bookingId,
        metadata: {
          bookingReference: payment.booking.bookingReference,
          paymentId: refund.paymentId,
          refundId: refund.id,
          amount: Number(refund.amount),
          currency: refund.currency,
          providerReference,
          reason: refund.reason,
          via,
        },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for REFUND_COMPLETED ${refund.id}: ${String(error)}`,
      );
    }
  }

  /**
   * Settlement target for the payment-status recomputation after a refund
   * completes, mirroring the two existing refund paths: a CANCELLED booking
   * with a refundable fare policy settles at the policy target (the withheld
   * cancellation fee is not a refundable remainder — adminCancelBooking);
   * everything else settles at the full payment amount (refundPayment).
   */
  private refundSettlementCents(
    payment: Payment & {
      booking: { status: BookingStatus; fareRulesSnapshot: unknown };
    },
  ): number {
    const totalCents = toCents(Number(payment.amount));
    if (payment.booking.status !== 'CANCELLED') {
      return totalCents;
    }
    const policy = resolveRefundPolicy(payment.booking.fareRulesSnapshot);
    if (!policy?.refundable) {
      return totalCents;
    }
    return Math.round(totalCents * (1 - policy.cancellationFeePercent / 100));
  }

  // ---------- PaymentIntent cancellation on booking cancellation (Phase 3.2C) ----------

  /**
   * Closes any still-open Stripe PaymentIntent whose booking has just been
   * CANCELLED — the capture window left by customer/admin/seat-hold-expiry
   * cancellation. Called strictly AFTER the local cancellation commit: no
   * Stripe I/O is ever performed inside a database transaction.
   *
   * Eligibility per payment: the configured provider is PaymentIntent-capable,
   * the payment was created by that same provider, a providerReference exists,
   * and the local status is PENDING or FAILED (a FAILED attempt's intent can
   * still be open at Stripe). SUCCESS / PARTIALLY_REFUNDED / REFUNDED payments
   * are never touched — their semantics belong to the refund flows, which are
   * unchanged. Mock-provider deployments return immediately.
   *
   * Per eligible payment the intent is first RETRIEVED (read-only):
   * - succeeded → left alone (captured money is never cancelled; existing
   *   refund/reconciliation semantics govern, and a racing webhook
   *   finalization stays authoritative);
   * - canceled → converged locally via the existing markIntentCanceled with no
   *   duplicate provider call;
   * - any open status per the provider's own status contract
   *   (requires_payment_method / requires_confirmation / requires_action /
   *   processing) → canceled via the provider, then converged via
   *   markIntentCanceled (CAS PENDING→FAILED with providerStatus 'canceled' +
   *   PAYMENT_CANCELED audit; a payment that raced to SUCCESS is ignored by
   *   that CAS, never overwritten).
   *
   * Fully fail-soft: a Stripe timeout/network/5xx leaves the payment PENDING
   * and recoverable (reconciliation sweep, webhook, customer resume still
   * apply) and is logged with safe identifiers only — an ambiguous outcome is
   * never turned into a definitive local failure, and the booking stays
   * CANCELLED either way.
   */
  async cancelOpenIntentsForCancelledBooking(bookingId: string): Promise<void> {
    if (!isPaymentIntentProvider(this.provider)) {
      return;
    }
    const provider = this.provider;
    let payments: Array<{
      id: string;
      providerReference: string | null;
      status: Payment['status'];
    }>;
    try {
      payments = await this.prisma.payment.findMany({
        where: {
          bookingId,
          provider: provider.name,
          providerReference: { not: null },
          status: { in: ['PENDING', 'FAILED'] },
        },
        select: { id: true, providerReference: true, status: true },
      });
    } catch (error) {
      this.logger.warn(
        `cancel-open-intents: eligibility query failed for booking ${bookingId}: ${String(error)}`,
      );
      return;
    }
    for (const payment of payments) {
      try {
        await this.cancelOpenIntentForPayment(provider, payment);
      } catch (error) {
        // Ambiguous (timeout/network/5xx): never fabricated into a local
        // result — the payment stays recoverable via sweep/webhook/resume.
        this.logger.warn(
          `cancel-open-intents: payment ${payment.id} (booking ${bookingId}, intent ${payment.providerReference}) ambiguous: ${String(error)}`,
        );
      }
    }
  }

  /** Retrieve-then-cancel for one eligible payment; converge via the existing markIntentCanceled. */
  private async cancelOpenIntentForPayment(
    provider: PaymentIntentProvider,
    payment: { id: string; providerReference: string | null },
  ): Promise<void> {
    if (!payment.providerReference) {
      return;
    }
    const snapshot = await provider.retrievePaymentIntent(
      payment.providerReference,
    );
    if (snapshot.status === 'succeeded') {
      return; // never cancel captured money — refund semantics are unchanged
    }
    if (snapshot.status === 'canceled') {
      // Already canceled at the provider: converge locally, no duplicate cancel.
      await this.markIntentCanceled({ ...snapshot, paymentId: payment.id });
      return;
    }
    const canceled = await provider.cancelPaymentIntent(
      payment.providerReference,
    );
    await this.markIntentCanceled({ ...canceled, paymentId: payment.id });
  }

  // ---------- Customer cancellation preview (approved cancellation policy) ----------

  /**
   * Read-only, server-calculated cancellation preview for the customer UI.
   * Evaluates the SAME centralized policy as cancellation itself and computes
   * the refund from the SAME authoritative source — the persisted paid payment
   * with its committed refunds. It never calls the provider and never trusts
   * client-supplied amounts. The preview is informational only: the actual
   * cancellation re-reads and re-evaluates everything (CAS-protected), so the
   * server's final decision always wins over any stale preview.
   */
  async cancellationPreviewForCustomer(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      include: {
        seatHolds: {
          take: 1,
          select: { flight: { select: { departureTime: true } } },
        },
        payments: { include: { refunds: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    const departureTime = booking.seatHolds?.[0]?.flight.departureTime;
    if (!departureTime) {
      throw new ConflictException(
        'Cancellation cannot be evaluated — flight information is missing',
      );
    }
    const decision = evaluateCancellationPolicy({
      bookingStatus: booking.status,
      refundable:
        resolveRefundPolicy(booking.fareRulesSnapshot)?.refundable ?? false,
      departureTime,
    });

    const paidPayment = booking.payments.find(
      (p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED',
    );
    const paidCents = paidPayment ? toCents(Number(paidPayment.amount)) : 0;
    let refundCents = 0;
    if (decision.allowed && paidPayment && decision.refundPercentage > 0) {
      const policyTargetCents = Math.round(
        (paidCents * decision.refundPercentage) / 100,
      );
      const alreadyCents = this.refundedCents(paidPayment.refunds);
      refundCents = Math.max(
        0,
        Math.min(paidCents - alreadyCents, policyTargetCents - alreadyCents),
      );
    }

    const refundAmount = fromCents(refundCents);
    const paidAmount = paidPayment ? Number(paidPayment.amount) : 0;
    return {
      allowed: decision.allowed,
      reason: decision.reason,
      refundPercentage: decision.refundPercentage,
      refundAmount,
      paidAmount,
      retainedAmount: paidAmount - refundAmount,
      currency: booking.currency,
      departureTime: departureTime.toISOString(),
      hoursUntilDeparture: decision.hoursUntilDeparture,
    };
  }

  // ---------- Customer paid cancellation (approved cancellation policy) ----------

  /**
   * Cancels a CONFIRMED customer booking under the approved NovaAir
   * cancellation policy and refunds per the policy decision computed by
   * evaluateCancellationPolicy (ownership and policy evaluation happen in
   * BookingsService.cancelMine before delegation).
   *
   * Mirrors the admin cancellation's safety structure: ONE transaction for the
   * booking CAS (CONFIRMED→CANCELLED), BookingSeat release and hold release,
   * with the refund recorded as PENDING under the payment row lock BEFORE any
   * money moves; the provider refund happens outside every transaction; the
   * PROCESSED finalization recomputes the payment status against the policy
   * target (the withheld cancellation share is not a refundable remainder).
   *
   * Phase 3.3 P0 + Batch 3.4A rule honored: an ambiguous provider outcome
   * (timeout/network/5xx) leaves the refund PENDING and recoverable via the
   * refund-resume endpoint — it is never marked REJECTED, so a second refund
   * can never be issued for the same money; only a DEFINITIVE provider
   * rejection (ProviderDefinitiveError) marks it REJECTED. A zero-percent
   * decision creates no Refund row and no provider activity (the payment
   * simply stays SUCCESS).
   */
  async cancelConfirmedForCustomer(
    user: AuthUser,
    bookingId: string,
    decision: CancellationPolicyDecision,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      include: { payments: { include: { refunds: true } } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(
        'Only confirmed bookings can be cancelled through the paid cancellation flow',
      );
    }

    // The authoritative refundable base is what the customer actually paid —
    // the persisted successful payment, never client input.
    const paidPayment = booking.payments.find(
      (p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED',
    );
    const paidCents = paidPayment ? toCents(Number(paidPayment.amount)) : 0;
    const policyTargetCents = Math.round(
      (paidCents * decision.refundPercentage) / 100,
    );
    let refundCents = 0;
    if (paidPayment && policyTargetCents > 0) {
      const alreadyCents = this.refundedCents(paidPayment.refunds);
      refundCents = Math.max(
        0,
        Math.min(paidCents - alreadyCents, policyTargetCents - alreadyCents),
      );
    }

    // Transaction: cancel + release inventory + record the refund as PENDING
    // under the payment row lock — before any money moves at the provider.
    const { releasedCount, releasedSeatCount, refund } =
      await this.prisma.$transaction(async (tx) => {
        const cas = await tx.booking.updateMany({
          where: { id: booking.id, status: 'CONFIRMED' },
          data: { status: 'CANCELLED' },
        });
        if (cas.count !== 1) {
          throw new ConflictException(
            'Booking was modified concurrently — reload and try again',
          );
        }
        const seats = await tx.bookingSeat.deleteMany({
          where: { bookingPassenger: { bookingId: booking.id } },
        });
        const released = await tx.seatHold.updateMany({
          where: { bookingId: booking.id, status: 'ACTIVE' },
          data: { status: 'RELEASED' },
        });

        let refund: Refund | null = null;
        if (refundCents > 0 && paidPayment) {
          await tx.payment.update({
            where: { id: paidPayment.id },
            data: { provider: paidPayment.provider },
          });
          const committed = await tx.refund.findMany({
            where: {
              paymentId: paidPayment.id,
              status: { in: ['PENDING', 'PROCESSED'] },
            },
            select: { amount: true },
          });
          const committedCents = committed.reduce(
            (sum, r) => sum + toCents(Number(r.amount)),
            0,
          );
          if (refundCents > paidCents - committedCents) {
            throw new ConflictException(
              'Refundable remainder changed concurrently — reload and try again',
            );
          }
          refund = await tx.refund.create({
            data: {
              paymentId: paidPayment.id,
              bookingId: booking.id,
              amount: fromCents(refundCents),
              currency: paidPayment.currency,
              status: 'PENDING',
              reason: `Customer cancellation (${decision.reason})`,
            },
          });
        }
        return {
          releasedCount: released.count,
          releasedSeatCount: seats.count,
          refund,
        };
      });

    // Post-commit: close any still-open Stripe PaymentIntent (Phase 3.2C).
    await this.cancelOpenIntentsForCancelledBooking(booking.id);

    if (refund) {
      this.metrics.increment(REFUND_COUNTERS.created);
    }

    // Provider refund outside every transaction. Ambiguous failure → the
    // refund STAYS PENDING (recoverable via resume) — never REJECTED.
    let processedRefund: Refund | null = null;
    let providerRefundRef: string | null = null;
    if (refund && paidPayment) {
      try {
        const result = await this.provider.refund({
          amount: fromCents(refundCents),
          currency: paidPayment.currency,
          paymentProviderReference: paidPayment.providerReference!,
          idempotencyKey: `refund-${refund.id}`,
          metadataRefundId: refund.id,
        });
        providerRefundRef = result.providerReference;
      } catch (error) {
        if (error instanceof ProviderDefinitiveError) {
          // Definitive business rejection — the ONLY safe terminal rejection,
          // same classification as the admin cancellation flow (Batch 3.4A).
          await this.rejectRefund(
            refund.id,
            `customer cancellation refund ${refund.id} (booking ${booking.bookingReference}) definitively rejected by the provider: ${error.message}`,
          );
        } else {
          // Ambiguous outcome: leave the refund PENDING (reservation intact,
          // recoverable via resume/reconciliation) — never REJECTED, so no
          // second refund can ever be issued for this money.
          this.metrics.increment(REFUND_COUNTERS.ambiguousOutcomes);
          this.logger.warn(
            `customer cancellation refund ${refund.id} (booking ${booking.bookingReference}) ambiguous at provider — left PENDING for recovery: ${String(error)}`,
          );
          await this.safeNotify(
            () => this.alertRefundAmbiguous(refund.id),
            `REFUND_AMBIGUOUS refund ${refund.id}`,
          );
        }
      }
      if (providerRefundRef) {
        const settled = await this.finalizeDirectRefundSuccess(
          refund.id,
          paidPayment,
          providerRefundRef,
          policyTargetCents,
        );
        if (settled !== null) {
          processedRefund = {
            ...refund,
            status: 'PROCESSED',
            processedAt: new Date(),
            providerReference: providerRefundRef,
          };
        }
      }
    }

    const view = await this.bookings.getBookingView(booking.id);
    await this.logBookingEvent('BOOKING_CANCELLED', user, booking, {
      reason: decision.reason,
      refundPercentage: decision.refundPercentage,
      hoursUntilDeparture: decision.hoursUntilDeparture,
      releasedSeatCount,
    });
    if (releasedCount > 0) {
      await this.logBookingEvent('SEAT_HOLD_RELEASED', user, booking, {
        holdCount: releasedCount,
      });
    }
    if (processedRefund && paidPayment) {
      await this.logRefundEvent(
        user,
        processedRefund,
        { ...paidPayment, booking },
        providerRefundRef ?? '',
      );
      await this.safeNotify(
        () => this.notifyRefundProcessedById(processedRefund.id),
        `REFUND_PROCESSED refund ${processedRefund.id}`,
      );
    }
    return view;
  }

  // ---------- Customer cancellation requests (staff review, bookings:manage) ----------

  /**
   * Admin worklist of customer cancellation requests. Default: all statuses,
   * PENDING first (Postgres enum ordering follows the declaration order
   * PENDING, APPROVED, REJECTED, so ascending status puts PENDING first),
   * oldest request first within a status. Each row carries the booking,
   * customer, flight, the paid payment and the CURRENT policy evaluation —
   * re-evaluated per read, never stored — plus the linked refund when the
   * request was already approved.
   */
  async listCancellationRequests(query: AdminCancellationRequestQueryDto) {
    const requests = await this.prisma.cancellationRequest.findMany({
      where: { status: query.status },
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      include: CANCELLATION_REQUEST_INCLUDE,
    });
    return requests.map((r) => this.toAdminCancellationRequestView(r));
  }

  /**
   * Rejects a PENDING request (CAS — a concurrent review conflicts). Booking
   * and payment stay untouched; the customer may submit a fresh request.
   */
  async rejectCancellationRequest(
    staff: AuthUser,
    requestId: string,
    dto: RejectCancellationRequestDto,
  ) {
    const cas = await this.prisma.cancellationRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: staff.userId,
        rejectionReason: dto.rejectionReason ?? null,
      },
    });
    if (cas.count !== 1) {
      const existing = await this.prisma.cancellationRequest.findUnique({
        where: { id: requestId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('Cancellation request not found');
      }
      throw new ConflictException(
        'This cancellation request was already reviewed',
      );
    }
    const request = await this.prisma.cancellationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: CANCELLATION_REQUEST_INCLUDE,
    });
    await this.logCancellationRequestEvent(
      'CANCELLATION_REQUEST_REJECTED',
      staff,
      request,
      { reason: dto.rejectionReason },
    );
    await this.safeNotify(
      () =>
        this.notifications.notifyCancellationRejected({
          userId: request.userId,
          requestId: request.id,
          bookingId: request.bookingId,
          bookingReference: request.booking.bookingReference,
        }),
      `CANCELLATION_REJECTED request ${request.id}`,
    );
    return this.toAdminCancellationRequestView(request);
  }

  /**
   * Approves a customer cancellation request and executes it through the
   * EXISTING refund machinery — this is orchestration, not a second refund
   * implementation:
   *
   * - ONE transaction: CAS the request PENDING→APPROVED; a refundable target
   *   records the Refund as PENDING under the payment row lock with the exact
   *   remainder re-validation of refundPayment, and links it to the request; a
   *   zero-refundable target instead finalizes the cancellation in the same
   *   transaction (shared cancelConfirmedBookingInTx helper).
   * - Post-commit (refundable case): the provider call reuses the same
   *   classification as every refund path — DEFINITIVE rejection marks the
   *   refund REJECTED (terminal for THAT attempt; the request stays APPROVED
   *   and may be re-approved to retry), an AMBIGUOUS outcome leaves it PENDING
   *   (recoverable via resumeRefund / the reconciliation sweep), success goes
   *   through finalizeRefundProcessed whose hook then cancels the booking.
   * - The booking stays CONFIRMED until the refund is PROCESSED (or is
   *   cancelled immediately only when nothing is refundable).
   *
   * Retry rule: approving an APPROVED request whose linked refund is REJECTED
   * starts a fresh refund attempt (new refundId); APPROVED with a
   * PENDING/PROCESSED refund or a REJECTED request conflicts.
   */
  async approveCancellationRequest(staff: AuthUser, requestId: string) {
    const request = await this.prisma.cancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        refund: true,
        booking: {
          include: {
            payments: { include: { refunds: true } },
            seatHolds: {
              take: 1,
              select: { flight: { select: { departureTime: true } } },
            },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Cancellation request not found');
    }
    if (request.status === 'REJECTED') {
      throw new ConflictException(
        'A rejected cancellation request cannot be approved',
      );
    }
    // Retry path: a previous attempt's refund was definitively REJECTED — its
    // amount was freed, so a fresh refund can be recorded for the request.
    const isRetry =
      request.status === 'APPROVED' && request.refund?.status === 'REJECTED';
    if (request.status === 'APPROVED' && !isRetry) {
      throw new ConflictException(
        'This cancellation request was already approved',
      );
    }

    const booking = request.booking;
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Booking is no longer confirmed (current status ${booking.status})`,
      );
    }
    const departureTime = booking.seatHolds?.[0]?.flight.departureTime;
    if (!departureTime) {
      throw new ConflictException(
        'Cancellation cannot be evaluated — flight information is missing',
      );
    }
    // The SAME policy evaluation and tier math as the customer cancellation
    // flow, on the authoritative paid payment — never client input.
    const decision = evaluateCancellationPolicy({
      bookingStatus: booking.status,
      refundable:
        resolveRefundPolicy(booking.fareRulesSnapshot)?.refundable ?? false,
      departureTime,
    });
    if (!decision.allowed) {
      throw new ConflictException(
        'Cancellation is no longer possible under the policy (the flight has departed or the booking is completed)',
      );
    }

    const paidPayment = booking.payments.find(
      (p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED',
    );
    const paidCents = paidPayment ? toCents(Number(paidPayment.amount)) : 0;
    const policyTargetCents = Math.round(
      (paidCents * decision.refundPercentage) / 100,
    );
    let refundCents = 0;
    if (paidPayment && policyTargetCents > 0) {
      const alreadyCents = this.refundedCents(paidPayment.refunds);
      refundCents = Math.max(
        0,
        Math.min(paidCents - alreadyCents, policyTargetCents - alreadyCents),
      );
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      if (!isRetry) {
        // Atomic compare-and-set: exactly one approver wins; a concurrent
        // approval conflicts (its re-read sees this committed review).
        const cas = await tx.cancellationRequest.updateMany({
          where: { id: request.id, status: 'PENDING' },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: staff.userId,
          },
        });
        if (cas.count !== 1) {
          throw new ConflictException(
            'This cancellation request was already reviewed',
          );
        }
      } else {
        await tx.cancellationRequest.update({
          where: { id: request.id },
          data: { reviewedAt: new Date(), reviewedBy: staff.userId },
        });
      }

      if (refundCents === 0) {
        // Nothing refundable: finalize the cancellation IN THE SAME tx. The
        // payment stays untouched (SUCCESS) — there is nothing to refund.
        const released = await this.cancelConfirmedBookingInTx(tx, booking.id);
        if (!released) {
          throw new ConflictException(
            'Booking was modified concurrently — reload and try again',
          );
        }
        return { refund: null as Refund | null, ...released };
      }

      // Record-first under the payment row lock — the exact reservation logic
      // of refundPayment: PENDING reserves against the remainder BEFORE any
      // money moves at the provider.
      await tx.payment.update({
        where: { id: paidPayment!.id },
        data: { provider: paidPayment!.provider },
      });
      const committed = await tx.refund.findMany({
        where: {
          paymentId: paidPayment!.id,
          status: { in: ['PENDING', 'PROCESSED'] },
        },
        select: { amount: true },
      });
      const committedCents = committed.reduce(
        (sum, r) => sum + toCents(Number(r.amount)),
        0,
      );
      if (refundCents > paidCents - committedCents) {
        throw new ConflictException(
          'Refundable remainder changed concurrently — reload and try again',
        );
      }
      const refund = await tx.refund.create({
        data: {
          paymentId: paidPayment!.id,
          bookingId: booking.id,
          amount: fromCents(refundCents),
          currency: paidPayment!.currency,
          status: 'PENDING',
          reason: `Customer cancellation request approved (${decision.reason})`,
        },
      });
      await tx.cancellationRequest.update({
        where: { id: request.id },
        data: { refundId: refund.id },
      });
      return { refund, releasedCount: 0, releasedSeatCount: 0 };
    });

    const { refund } = txResult;
    if (refund) {
      this.metrics.increment(REFUND_COUNTERS.created);
    }

    if (!refund) {
      // Zero-refundable: cancellation already committed with the approval.
      await this.cancelOpenIntentsForCancelledBooking(booking.id);
      await this.logCancellationRequestEvent(
        'CANCELLATION_REQUEST_APPROVED',
        staff,
        { id: request.id, bookingId: booking.id, booking },
        { reason: decision.reason },
      );
      await this.safeNotify(
        () =>
          this.notifications.notifyCancellationApproved({
            userId: request.userId,
            requestId: request.id,
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
          }),
        `CANCELLATION_APPROVED request ${request.id}`,
      );
      await this.logBookingEvent('BOOKING_CANCELLED', staff, booking, {
        reason: decision.reason,
        refundPercentage: decision.refundPercentage,
        releasedSeatCount: txResult.releasedSeatCount,
      });
      if (txResult.releasedCount > 0) {
        await this.logBookingEvent('SEAT_HOLD_RELEASED', staff, booking, {
          holdCount: txResult.releasedCount,
        });
      }
      return this.toAdminCancellationRequestView(
        await this.prisma.cancellationRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: CANCELLATION_REQUEST_INCLUDE,
        }),
      );
    }

    // Provider refund outside every transaction — the same classification as
    // refundPayment: DEFINITIVE rejection → REJECTED (the request stays
    // APPROVED and can be re-approved to retry); AMBIGUOUS → left PENDING for
    // the existing recovery paths; success → finalizeRefundProcessed, whose
    // cancellation-request hook finalizes the booking cancellation.
    let providerRefundRef: string | null = null;
    if (paidPayment) {
      try {
        const result = await this.provider.refund({
          amount: fromCents(refundCents),
          currency: paidPayment.currency,
          paymentProviderReference: paidPayment.providerReference!,
          // Same idempotency contract as refundPayment: the persisted Refund
          // row id — a retry of this refund never moves money twice.
          idempotencyKey: `refund-${refund.id}`,
          metadataRefundId: refund.id,
        });
        providerRefundRef = result.providerReference;
      } catch (error) {
        if (error instanceof ProviderDefinitiveError) {
          await this.rejectRefund(
            refund.id,
            `cancellation-request refund ${refund.id} (booking ${booking.bookingReference}) definitively rejected by the provider: ${error.message}`,
          );
        } else {
          this.metrics.increment(REFUND_COUNTERS.ambiguousOutcomes);
          this.logger.warn(
            `cancellation-request refund ${refund.id} (booking ${booking.bookingReference}) ambiguous at provider — left PENDING for recovery: ${String(error)}`,
          );
          await this.safeNotify(
            () => this.alertRefundAmbiguous(refund.id),
            `REFUND_AMBIGUOUS refund ${refund.id}`,
          );
        }
      }
      if (providerRefundRef) {
        await this.finalizeRefundProcessed(
          refund,
          { ...paidPayment, booking },
          providerRefundRef,
        );
        const processedRefund = await this.prisma.refund.findUniqueOrThrow({
          where: { id: refund.id },
        });
        await this.logRefundEvent(
          staff,
          processedRefund,
          { ...paidPayment, booking },
          providerRefundRef,
        );
      }
    }

    await this.logCancellationRequestEvent(
      'CANCELLATION_REQUEST_APPROVED',
      staff,
      { id: request.id, bookingId: booking.id, booking },
      { reason: decision.reason },
    );
    await this.safeNotify(
      () =>
        this.notifications.notifyCancellationApproved({
          userId: request.userId,
          requestId: request.id,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
        }),
      `CANCELLATION_APPROVED request ${request.id}`,
    );
    return this.toAdminCancellationRequestView(
      await this.prisma.cancellationRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: CANCELLATION_REQUEST_INCLUDE,
      }),
    );
  }

  /** Staff-actor audit for cancellation-request review decisions. */
  private async logCancellationRequestEvent(
    action: string,
    staff: AuthUser,
    request: { id: string; bookingId: string; booking: { bookingReference: string } },
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorId: staff.userId,
        actorType: this.actorTypeOf(staff),
        action,
        targetType: 'CancellationRequest',
        targetId: request.id,
        bookingId: request.bookingId,
        metadata: {
          bookingReference: request.booking.bookingReference,
          ...metadata,
        },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for ${action} ${request.id}: ${String(error)}`,
      );
    }
  }

  private toAdminCancellationRequestView(request: CancellationRequestRow) {
    const booking = request.booking;
    const flight = booking.seatHolds[0]?.flight ?? null;
    const paidPayment =
      booking.payments.find(
        (p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED',
      ) ?? null;

    // Current policy evaluation — informational, re-evaluated per read. The
    // refundable amount is computed from the paid payment exactly like the
    // cancellation execution does (tier target capped by the remainder).
    let policy: {
      refundPercentage: number;
      refundableAmount: number;
      currency: string;
    } | null = null;
    if (flight && paidPayment) {
      const decision = evaluateCancellationPolicy({
        bookingStatus: booking.status,
        refundable:
          resolveRefundPolicy(booking.fareRulesSnapshot)?.refundable ?? false,
        departureTime: flight.departureTime,
      });
      const paidCents = toCents(Number(paidPayment.amount));
      let refundCents = 0;
      if (decision.allowed && decision.refundPercentage > 0) {
        const policyTargetCents = Math.round(
          (paidCents * decision.refundPercentage) / 100,
        );
        const alreadyCents = this.refundedCents(paidPayment.refunds);
        refundCents = Math.max(
          0,
          Math.min(paidCents - alreadyCents, policyTargetCents - alreadyCents),
        );
      }
      policy = {
        refundPercentage: decision.allowed ? decision.refundPercentage : 0,
        refundableAmount: fromCents(refundCents),
        currency: paidPayment.currency,
      };
    }

    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      requestedAt: request.requestedAt,
      reviewedAt: request.reviewedAt,
      rejectionReason: request.rejectionReason,
      booking: {
        id: booking.id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        totalAmount: Number(booking.totalAmount),
        currency: booking.currency,
        bookedAt: booking.bookedAt,
      },
      customer: {
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        email: request.user.email,
      },
      flight: flight
        ? {
            flightNumber: flight.flightNumber,
            originIata: flight.route.originAirport.iataCode,
            destinationIata: flight.route.destinationAirport.iataCode,
            departureTime: flight.departureTime,
          }
        : null,
      payment: paidPayment
        ? {
            amount: Number(paidPayment.amount),
            currency: paidPayment.currency,
            status: paidPayment.status,
          }
        : null,
      policy,
      refund: request.refund
        ? {
            id: request.refund.id,
            status: request.refund.status,
            amount: Number(request.refund.amount),
          }
        : null,
    };
  }

  // ---------- Staff booking lifecycle (bookings:manage) ----------

  /**
   * Admin cancellation. PENDING bookings release their holds; CONFIRMED
   * bookings additionally release their BookingSeat rows inside the same
   * transaction, so the physical seats become resalable immediately — the
   * booking record, passenger history, payments and refunds are all preserved.
   * A successful payment is auto-refunded per the fare refund policy snapshot
   * (BR-15); when no policy is configured, payment data is preserved untouched
   * and the response explains that a manual refund is required.
   */
  async adminCancelBooking(
    staff: AuthUser,
    bookingId: string,
    dto: AdminCancelBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: { include: { refunds: true } } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === 'CANCELLED') {
      throw new ConflictException('Booking is already cancelled');
    }
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Booking cannot be cancelled in its current state (${booking.status})`,
      );
    }

    const paidPayment = booking.payments.find(
      (p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED',
    );
    let refundCents = 0;
    let policyTargetCents: number | null = null;
    let refundNote: string | null = null;
    if (booking.status === 'CONFIRMED' && paidPayment) {
      const policy = resolveRefundPolicy(booking.fareRulesSnapshot);
      const totalCents = toCents(Number(paidPayment.amount));
      const alreadyCents = this.refundedCents(paidPayment.refunds);
      if (policy?.refundable) {
        // BR-15: original payment minus the configured cancellation fee, never
        // exceeding the remaining refundable amount.
        const targetCents = Math.round(
          totalCents * (1 - policy.cancellationFeePercent / 100),
        );
        policyTargetCents = targetCents;
        refundCents = Math.max(
          0,
          Math.min(totalCents - alreadyCents, targetCents - alreadyCents),
        );
        if (refundCents === 0) {
          refundNote =
            'No refundable remainder after the cancellation fee and earlier refunds.';
        }
      } else if (policy) {
        refundNote =
          'Fare rules mark this booking as non-refundable; no automatic refund was issued.';
      } else {
        refundNote =
          'Fare refund policy is not configured for this booking — issue any due refund manually from the payments page.';
      }
    }

    // Transaction 1: cancel the booking and record the refund as PENDING under
    // the payment row lock — before any money moves at the provider. A provider
    // refund can never be un-done, so it must never precede the database record.
    const { releasedCount, releasedSeatCount, refund } = await this.prisma.$transaction(
      async (tx) => {
        const cas = await tx.booking.updateMany({
          where: { id: booking.id, status: { in: ['PENDING', 'CONFIRMED'] } },
          data: { status: 'CANCELLED' },
        });
        if (cas.count !== 1) {
          throw new ConflictException(
            'Booking was modified concurrently — reload and try again',
          );
        }
        // Release the seat inventory in the same transaction as the CAS: only
        // this booking's BookingSeat rows are removed (CONFIRMED bookings only;
        // a PENDING booking has none), so a cancelled booking can never keep
        // blocking a physical seat. The unique(flightSegmentId, seatId)
        // constraint then lets a new confirmed booking take the released seat.
        const seats = await tx.bookingSeat.deleteMany({
          where: { bookingPassenger: { bookingId: booking.id } },
        });
        const released = await tx.seatHold.updateMany({
          where: { bookingId: booking.id, status: 'ACTIVE' },
          data: { status: 'RELEASED' },
        });

        let refund: Refund | null = null;
        if (refundCents > 0 && paidPayment) {
          // Same row-lock + remainder re-validation as the standalone refund flow.
          await tx.payment.update({
            where: { id: paidPayment.id },
            data: { provider: paidPayment.provider },
          });
          const committed = await tx.refund.findMany({
            where: {
              paymentId: paidPayment.id,
              status: { in: ['PENDING', 'PROCESSED'] },
            },
            select: { amount: true },
          });
          const committedCents = committed.reduce(
            (sum, r) => sum + toCents(Number(r.amount)),
            0,
          );
          const totalCents = toCents(Number(paidPayment.amount));
          if (refundCents > totalCents - committedCents) {
            throw new ConflictException(
              'Refundable remainder changed concurrently — reload and try again',
            );
          }
          refund = await tx.refund.create({
            data: {
              paymentId: paidPayment.id,
              bookingId: booking.id,
              amount: fromCents(refundCents),
              currency: paidPayment.currency,
              status: 'PENDING',
              reason: dto.reason ?? 'Booking cancelled by staff',
            },
          });
        }
        return { releasedCount: released.count, releasedSeatCount: seats.count, refund };
      },
    );

    if (refund) {
      this.metrics.increment(REFUND_COUNTERS.created);
    }

    // Transaction 2: execute the provider refund only after the cancellation
    // and the PENDING record are committed, then mark it PROCESSED. A
    // DEFINITIVE provider rejection marks the record REJECTED and the note
    // points staff to a manual refund; an AMBIGUOUS outcome leaves the record
    // PENDING for recovery — the booking stays cancelled either way.
    let providerRefundRef: string | null = null;
    let newPaymentStatus: Payment['status'] | null = null;
    let processedRefund: Refund | null = null;
    if (refund && paidPayment) {
      try {
        const result = await this.provider.refund({
          amount: fromCents(refundCents),
          currency: paidPayment.currency,
          paymentProviderReference: paidPayment.providerReference!,
          idempotencyKey: `refund-${refund.id}`,
          metadataRefundId: refund.id,
        });
        providerRefundRef = result.providerReference;
      } catch (error) {
        if (error instanceof ProviderDefinitiveError) {
          await this.rejectRefund(
            refund.id,
            `auto-refund definitively rejected for cancelled booking ${booking.bookingReference}: ${error.message}`,
          );
          refundNote =
            'Automatic refund was rejected by the payment provider — issue any due refund manually from the payments page.';
        } else {
          // Ambiguous outcome: leave the refund PENDING (reservation intact,
          // recoverable via resume/reconciliation) — the booking stays
          // cancelled and no second refund can ever be issued for this money.
          this.metrics.increment(REFUND_COUNTERS.ambiguousOutcomes);
          this.logger.warn(
            `auto-refund outcome ambiguous for cancelled booking ${booking.bookingReference} (refund ${refund.id}) — left PENDING for recovery: ${String(error)}`,
          );
          await this.safeNotify(
            () => this.alertRefundAmbiguous(refund.id),
            `REFUND_AMBIGUOUS refund ${refund.id}`,
          );
          refundNote =
            'Automatic refund could not be confirmed at the payment provider — it was left pending and will be recovered automatically.';
        }
      }
      // Only finalize once the provider has actually moved the money; if this
      // transaction fails the record must stay PENDING (reserved, visible for
      // reconciliation) — never REJECTED, which would free the amount for a
      // second refund.
      if (providerRefundRef) {
        newPaymentStatus = await this.finalizeDirectRefundSuccess(
          refund.id,
          paidPayment,
          providerRefundRef,
          policyTargetCents ?? toCents(Number(paidPayment.amount)),
        );
        if (newPaymentStatus !== null) {
          processedRefund = {
            ...refund,
            status: 'PROCESSED',
            processedAt: new Date(),
            providerReference: providerRefundRef,
          };
        }
      }
    }

    // Phase 3.2C: with the cancellation committed, close any still-open Stripe
    // PaymentIntent (e.g. an unpaid PENDING attempt) — post-commit, outside
    // every transaction; a no-op under the mock provider. A paid SUCCESS
    // payment is untouched: the refund flow above remains the only money path.
    await this.cancelOpenIntentsForCancelledBooking(booking.id);

    const view = await this.bookings.getBookingView(booking.id);
    await this.logBookingEvent('BOOKING_CANCELLED', staff, booking, {
      reason: dto.reason,
      releasedSeatCount,
    });
    if (releasedCount > 0) {
      await this.logBookingEvent('SEAT_HOLD_RELEASED', staff, booking, {
        holdCount: releasedCount,
      });
    }
    let refundView = null;
    if (processedRefund && paidPayment) {
      refundView = this.toAdminRefundView({
        ...processedRefund,
        payment: {
          providerReference: paidPayment.providerReference,
          status: newPaymentStatus ?? paidPayment.status,
        },
        booking: {
          bookingReference: booking.bookingReference,
          contactEmail: booking.contactEmail,
        },
      });
      await this.logRefundEvent(
        staff,
        processedRefund,
        { ...paidPayment, booking },
        providerRefundRef ?? '',
      );
      await this.safeNotify(
        () => this.notifyRefundProcessedById(processedRefund.id),
        `REFUND_PROCESSED refund ${processedRefund.id}`,
      );
    }
    return { booking: view, refund: refundView, refundNote };
  }

  /**
   * BR-14: administrative confirmation WITHOUT a successful payment record.
   * Only reachable by staff with bookings:manage; a reason is mandatory and is
   * persisted in the audit trail. All other confirmation requirements (pending
   * state, live seat holds, seat uniqueness) are enforced exactly as in the
   * paid flow — but no Payment row is ever created.
   */
  async confirmBookingException(
    staff: AuthUser,
    bookingId: string,
    dto: ConfirmExceptionDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'PENDING') {
      throw new ConflictException(
        'Only pending bookings can be confirmed through the payment exception workflow',
      );
    }

    let details: { seatNumbers: string[]; holdCount: number };
    try {
      details = await this.prisma.$transaction(async (tx) =>
        confirmBookingInTransaction(tx, booking.id),
      );
    } catch (error) {
      if (error instanceof BookingNotPendingError) {
        throw new ConflictException('Booking is no longer pending');
      }
      throw error;
    }

    const view = await this.bookings.getBookingView(booking.id);
    await this.logBookingEvent('BR14_PAYMENT_EXCEPTION', staff, booking, {
      reason: dto.reason,
      seatNumbers: details.seatNumbers,
      holdCount: details.holdCount,
    });
    await this.logBookingEvent('SEAT_HOLD_CONVERTED', staff, booking, {
      seatNumbers: details.seatNumbers,
      holdCount: details.holdCount,
    });
    // Post-commit, fail-soft: no payment exists on this path, so only the
    // booking confirmation is notified (deduped per booking).
    await this.safeNotify(
      () =>
        this.notifications.notifyBookingConfirmed({
          userId: booking.userId,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
        }),
      `BOOKING_CONFIRMED booking ${booking.id}`,
    );
    return { booking: view };
  }

  // The atomic PENDING→CONFIRMED transition (booking CAS, hold conversion,
  // BookingSeat creation) lives in ./booking-confirmation.ts and is shared with
  // the Stripe webhook finalization path.

  /** Best-effort provider compensation after a successful charge whose DB confirmation failed. */
  private async compensateCharge(
    providerReference: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    try {
      await this.provider.refund({
        amount,
        currency,
        paymentProviderReference: providerReference,
      });
      this.logger.warn(
        `payment ${providerReference} charged but booking confirmation failed — compensated via provider refund`,
      );
    } catch (error) {
      this.logger.error(
        `compensation refund failed for ${providerReference}: ${String(error)}`,
      );
    }
  }

  private refundedCents(refunds: Refund[]): number {
    return refunds
      .filter((r) => r.status === 'PROCESSED')
      .reduce((sum, r) => sum + toCents(Number(r.amount)), 0);
  }

  /** PENDING refunds reserve against the remainder just like PROCESSED ones — otherwise two concurrent refunds could both pass validation while the first provider call is still in flight. */
  private reservedCents(refunds: Refund[]): number {
    return refunds
      .filter((r) => r.status === 'PENDING' || r.status === 'PROCESSED')
      .reduce((sum, r) => sum + toCents(Number(r.amount)), 0);
  }

  /** Best-effort REJECTED marking when the provider call fails after the PENDING record committed. */
  private async rejectRefund(
    refundId: string,
    logMessage: string,
  ): Promise<void> {
    try {
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { status: 'REJECTED' },
      });
      this.metrics.increment(REFUND_COUNTERS.rejected);
      this.logger.warn(logMessage);
    } catch (error) {
      this.logger.error(
        `failed to mark refund ${refundId} REJECTED (${logMessage}): ${String(error)}`,
      );
    }
  }

  // ---------- Audit (post-commit, fail-soft — bookings module convention) ----------

  /**
   * Audit for provider-driven transitions (webhook/retrieve reconciliation) —
   * no authenticated user exists in that context; the actor is the system.
   */
  /**
   * Fail-soft notification wrapper, mirroring the audit helpers below: a
   * notification failure is logged and swallowed — it must never change the
   * business response or roll back persisted booking/payment state.
   */
  private async safeNotify(
    op: () => Promise<unknown>,
    context: string,
  ): Promise<void> {
    try {
      await op();
    } catch (error) {
      this.logger.warn(
        `Notification failed (${context}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Post-commit realtime push, same fail-soft contract as safeNotify: a
   * Socket.IO problem is logged and swallowed — the committed payment state
   * and the HTTP response are never affected. The payload is minimal
   * (identifiers + normalized status); clients reconcile details via the API.
   */
  private emitPaymentStatus(event: PaymentStatusEvent): void {
    try {
      this.realtime.emitPaymentStatus(event);
    } catch (error) {
      this.logger.warn(
        `Realtime emit failed (payment ${event.paymentId}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Post-commit REFUND_PROCESSED notification; resolves recipient context
   *  from the persisted refund so every success path (initial, resume,
   *  sweep, orphan adoption, admin cancellation) shares one hook. Deduped
   *  per refund in NotificationsService. */
  private async notifyRefundProcessedById(refundId: string): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        booking: {
          select: { id: true, userId: true, bookingReference: true },
        },
      },
    });
    if (!refund) {
      return;
    }
    await this.notifications.notifyRefundProcessed({
      userId: refund.booking.userId,
      refundId: refund.id,
      bookingId: refund.booking.id,
      bookingReference: refund.booking.bookingReference,
    });
  }

  /** Staff alert for an AMBIGUOUS provider refund outcome (operator review
   *  required). Recipients are resolved least-privilege in
   *  NotificationsService (payments:refund holders + Super Admins). Never
   *  notifies the customer about ambiguity. */
  private async alertRefundAmbiguous(refundId: string): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: { id: true, booking: { select: { bookingReference: true } } },
    });
    if (!refund) {
      return;
    }
    const notified = await this.notifications.notifyStaffRefundReviewRequired({
      refundId: refund.id,
      bookingReference: refund.booking.bookingReference,
    });
    if (notified > 0) {
      this.logger.log(
        `refund ${refund.id} ambiguous outcome: ${notified} staff recipient(s) alerted for review`,
      );
    }
  }

  private async logSystemPaymentEvent(
    action: string,
    paymentId: string,
    bookingId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorType: 'System',
        action,
        targetType: 'Payment',
        targetId: paymentId,
        bookingId,
        metadata: { paymentId, ...metadata },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for ${action} ${paymentId}: ${String(error)}`,
      );
    }
  }

  private async logSystemBookingEvent(
    action: string,
    bookingId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorType: 'System',
        action,
        targetType: 'Booking',
        targetId: bookingId,
        bookingId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for ${action} ${bookingId}: ${String(error)}`,
      );
    }
  }

  private actorTypeOf(user: AuthUser): string {
    return user.roles.some((r) => r !== 'Customer') ? 'Staff' : 'User';
  }

  private async logBookingEvent(
    action: string,
    user: AuthUser,
    booking: Booking,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorId: user.userId,
        actorType: this.actorTypeOf(user),
        action,
        targetType: 'Booking',
        targetId: booking.id,
        bookingId: booking.id,
        metadata: { bookingReference: booking.bookingReference, ...metadata },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for ${action} ${booking.bookingReference}: ${String(error)}`,
      );
    }
  }

  private async logPaymentEvent(
    action: string,
    user: AuthUser,
    payment: Payment,
    booking: Booking,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        actorId: user.userId,
        actorType: this.actorTypeOf(user),
        action,
        targetType: 'Payment',
        targetId: payment.id,
        bookingId: booking.id,
        metadata: {
          bookingReference: booking.bookingReference,
          paymentId: payment.id,
          ...metadata,
        },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for ${action} ${payment.id}: ${String(error)}`,
      );
    }
  }

  private async logRefundEvent(
    staff: AuthUser,
    refund: Refund,
    payment: Payment & { booking: { bookingReference: string } },
    providerReference: string,
  ): Promise<void> {
    this.metrics.increment(REFUND_COUNTERS.processed);
    try {
      await this.auditService.log({
        actorId: staff.userId,
        actorType: this.actorTypeOf(staff),
        action: 'REFUND_COMPLETED',
        targetType: 'Refund',
        targetId: refund.id,
        bookingId: refund.bookingId,
        metadata: {
          bookingReference: payment.booking.bookingReference,
          paymentId: refund.paymentId,
          refundId: refund.id,
          amount: Number(refund.amount),
          currency: refund.currency,
          providerReference,
          reason: refund.reason,
        },
      });
    } catch (error) {
      this.logger.warn(
        `audit log failed for REFUND_COMPLETED ${refund.id}: ${String(error)}`,
      );
    }
  }

  // ---------- View mapping ----------

  private toRefundView(refund: Refund) {
    return {
      id: refund.id,
      paymentId: refund.paymentId,
      bookingId: refund.bookingId,
      amount: Number(refund.amount),
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      providerReference: refund.providerReference,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    };
  }

  private toPaymentView(payment: PaymentWithRefunds) {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      providerReference: payment.providerReference,
      providerStatus: payment.providerStatus,
      // The tokenized reference is never exposed in API views.
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      createdAt: payment.createdAt,
      refunds: payment.refunds.map((r) => this.toRefundView(r)),
    };
  }

  private toAdminPaymentView(payment: AdminPaymentRow) {
    return {
      ...this.toPaymentView(payment),
      bookingReference: payment.booking.bookingReference,
      bookingStatus: payment.booking.status,
      contactEmail: payment.booking.contactEmail,
    };
  }

  private toAdminRefundView(refund: AdminRefundRow) {
    return {
      ...this.toRefundView(refund),
      bookingReference: refund.booking.bookingReference,
      contactEmail: refund.booking.contactEmail,
      paymentProviderReference: refund.payment.providerReference,
      paymentStatus: refund.payment.status,
    };
  }

  /**
   * Operational refund view (Phase 3.4D): the admin refund fields plus the
   * pending age (minutes), whether the refund is old enough to be worked on
   * by the recovery sweep, and the stable recovery/idempotency identity —
   * internally safe (derived from the row id, never a secret).
   */
  private toAdminRefundOpsView(
    refund: AdminRefundRow,
    recoveryMinAgeMinutes: number,
  ) {
    const pendingAgeMinutes =
      refund.status === 'PENDING'
        ? Math.max(
            0,
            Math.floor((Date.now() - refund.createdAt.getTime()) / 60_000),
          )
        : null;
    return {
      ...this.toAdminRefundView(refund),
      pendingAgeMinutes,
      pendingRecovery:
        pendingAgeMinutes !== null &&
        pendingAgeMinutes >= recoveryMinAgeMinutes,
      recoveryKey: `refund-${refund.id}`,
    };
  }
}
