import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  Payment,
  Prisma,
  Refund,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BookingsService } from '../bookings/bookings.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { fromCents, resolveRefundPolicy, toCents } from './refund-policy.js';
import { PayBookingDto } from './dto/pay-booking.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto.js';
import { AdminRefundQueryDto } from './dto/admin-refund-query.dto.js';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto.js';
import { ConfirmExceptionDto } from './dto/confirm-exception.dto.js';

/** Thrown inside the confirmation transaction when the PENDING→CONFIRMED compare-and-set loses a concurrent race. */
class BookingNotPendingError extends Error {}

type Tx = Prisma.TransactionClient;

type PaymentWithRefunds = Payment & { refunds: Refund[] };
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

const ADMIN_PAYMENT_INCLUDE = {
  refunds: true,
  booking: {
    select: { bookingReference: true, status: true, contactEmail: true },
  },
} as const;

/**
 * Payments, refunds, and the paid booking lifecycle (Phase 6F).
 *
 * Lifecycle implemented here (BR-04/BR-05/BR-13/BR-14/BR-15):
 * - customer payment: charge the configured PaymentProvider with the
 *   server-computed booking total, then in ONE Prisma transaction atomically
 *   compare-and-set PENDING→CONFIRMED, convert ACTIVE seat holds to CONVERTED,
 *   create BookingSeat rows, and persist the SUCCESS payment;
 * - idempotency: (bookingId, idempotencyKey) replays return the recorded
 *   result; concurrent duplicates serialize on the booking row lock;
 * - refunds: the Refund row is recorded as PENDING inside a payment-row-locked,
 *   remainder-validated transaction BEFORE the provider is called, then marked
 *   PROCESSED after the provider succeeds (REJECTED when it fails) — money
 *   never moves at the provider without a committed database record;
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
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
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

    // The amount is always the persisted booking total — never client input.
    const amount = Number(booking.totalAmount);
    const currency = booking.currency;
    const charge = await this.provider.charge({
      amount,
      currency,
      token: dto.token,
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
          token: dto.token,
          idempotencyKey: dto.idempotencyKey,
          failedAt: new Date(),
        },
        include: { refunds: true },
      });
      await this.logPaymentEvent('PAYMENT_FAILED', user, failed, booking, {
        amount,
        currency,
      });
      throw new HttpException(
        `Payment failed: ${charge.failureReason}`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    try {
      const { payment, details } = await this.prisma.$transaction(
        async (tx) => {
          const details = await this.confirmBookingInTransaction(
            tx,
            booking.id,
          );
          const payment = await tx.payment.create({
            data: {
              bookingId: booking.id,
              amount,
              currency,
              status: 'SUCCESS',
              provider: this.provider.name,
              providerReference: charge.providerReference,
              token: dto.token,
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

  async findOwnPayments(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      select: { id: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toPaymentView(p));
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

  async findRefundsAdmin(query: AdminRefundQueryDto) {
    const refunds = await this.prisma.refund.findMany({
      where: { status: query.status, bookingId: query.bookingId },
      include: {
        payment: { select: { providerReference: true, status: true } },
        booking: { select: { bookingReference: true, contactEmail: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return refunds.map((r) => this.toAdminRefundView(r));
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

    let providerRefund;
    try {
      providerRefund = await this.provider.refund({
        amount: fromCents(requestedCents),
        currency: payment.currency,
        paymentProviderReference: payment.providerReference,
      });
    } catch (error) {
      await this.rejectRefund(
        refund.id,
        `provider refund failed for payment ${payment.id}: ${String(error)}`,
      );
      throw new HttpException(
        'Refund failed at the payment provider — no money was moved, please retry',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const newPaymentStatus = await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      const processed = await tx.refund.findMany({
        where: { paymentId: payment.id, status: 'PROCESSED' },
        select: { amount: true },
      });
      const processedCents = processed.reduce(
        (sum, r) => sum + toCents(Number(r.amount)),
        0,
      );
      const status: Payment['status'] =
        processedCents >= totalCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({ where: { id: payment.id }, data: { status } });
      return status;
    });

    const processedRefund = {
      ...refund,
      status: 'PROCESSED' as const,
      processedAt: new Date(),
    };
    await this.logRefundEvent(
      staff,
      processedRefund,
      payment,
      providerRefund.providerReference,
    );
    const updated = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: ADMIN_PAYMENT_INCLUDE,
    });
    return {
      refund: this.toAdminRefundView({
        ...processedRefund,
        payment: {
          providerReference: payment.providerReference,
          status: newPaymentStatus,
        },
        booking: payment.booking,
      }),
      payment: this.toAdminPaymentView(updated),
    };
  }

  // ---------- Staff booking lifecycle (bookings:manage) ----------

  /**
   * Admin cancellation. PENDING bookings release their holds; CONFIRMED
   * bookings keep their BookingSeat history but the seat inventory is freed by
   * the CANCELLED status (seat availability excludes cancelled bookings).
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
    const { releasedCount, refund } = await this.prisma.$transaction(
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
        return { releasedCount: released.count, refund };
      },
    );

    // Transaction 2: execute the provider refund only after the cancellation
    // and the PENDING record are committed, then mark it PROCESSED. A provider
    // failure marks the record REJECTED and the note points staff to a manual
    // refund — the booking stays cancelled either way.
    let providerRefundRef: string | null = null;
    let newPaymentStatus: Payment['status'] | null = null;
    let processedRefund: Refund | null = null;
    if (refund && paidPayment) {
      try {
        const result = await this.provider.refund({
          amount: fromCents(refundCents),
          currency: paidPayment.currency,
          paymentProviderReference: paidPayment.providerReference!,
        });
        providerRefundRef = result.providerReference;
      } catch (error) {
        await this.rejectRefund(
          refund.id,
          `auto-refund failed for cancelled booking ${booking.bookingReference}: ${String(error)}`,
        );
        refundNote =
          'Automatic refund failed at the payment provider — issue any due refund manually from the payments page.';
      }
      // Only finalize once the provider has actually moved the money; if this
      // transaction fails the record must stay PENDING (reserved, visible for
      // reconciliation) — never REJECTED, which would free the amount for a
      // second refund.
      if (providerRefundRef) {
        newPaymentStatus = await this.prisma.$transaction(async (tx) => {
          await tx.refund.update({
            where: { id: refund.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
          const processed = await tx.refund.findMany({
            where: { paymentId: paidPayment.id, status: 'PROCESSED' },
            select: { amount: true },
          });
          const processedCents = processed.reduce(
            (sum, r) => sum + toCents(Number(r.amount)),
            0,
          );
          // The cancellation is fully settled once refunds reach the fare-policy
          // target — the withheld cancellation fee is not a refundable remainder.
          const settlementCents =
            policyTargetCents ?? toCents(Number(paidPayment.amount));
          const status: Payment['status'] =
            processedCents >= settlementCents
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED';
          await tx.payment.update({
            where: { id: paidPayment.id },
            data: { status },
          });
          return status;
        });
        processedRefund = {
          ...refund,
          status: 'PROCESSED',
          processedAt: new Date(),
        };
      }
    }

    const view = await this.bookings.getBookingView(booking.id);
    await this.logBookingEvent('BOOKING_CANCELLED', staff, booking, {
      reason: dto.reason,
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
        this.confirmBookingInTransaction(tx, booking.id),
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
    return { booking: view };
  }

  // ---------- Confirmation internals ----------

  /**
   * Atomically (inside the caller's transaction): compare-and-set the booking
   * PENDING→CONFIRMED, self-heal stale holds, convert ACTIVE holds to
   * CONVERTED, and create BookingSeat rows for every flight segment.
   *
   * Seat↔passenger pairing is deterministic: holds sorted by seat number,
   * passengers sorted by (lastName, firstName, id). The persisted schema has
   * no hold→passenger link, so a stable documented ordering is used (the API
   * never exposed a per-passenger seat association).
   */
  private async confirmBookingInTransaction(
    tx: Tx,
    bookingId: string,
  ): Promise<{ seatNumbers: string[]; holdCount: number }> {
    const now = new Date();
    // Self-heal stale holds (same pattern as booking creation); only ACTIVE
    // rows are protected by the partial unique index.
    await tx.seatHold.updateMany({
      where: { bookingId, status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });

    // Atomic compare-and-set: concurrent confirmations serialize on the
    // booking row lock; the loser observes count 0 after the winner commits.
    const cas = await tx.booking.updateMany({
      where: { id: bookingId, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    if (cas.count !== 1) {
      throw new BookingNotPendingError();
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        bookingPassengers: { include: { passenger: true } },
        seatHolds: { include: { seat: true } },
      },
    });

    const activeHolds = booking.seatHolds.filter((h) => h.status === 'ACTIVE');
    if (
      activeHolds.length === 0 ||
      activeHolds.length !== booking.bookingPassengers.length
    ) {
      throw new ConflictException(
        'Seat holds for this booking have expired — cancel it and create a new booking',
      );
    }

    const flightId = activeHolds[0]!.flightId;
    const segments = await tx.flightSegment.findMany({
      where: { flightId },
      orderBy: { segmentNumber: 'asc' },
      select: { id: true },
    });
    if (segments.length === 0) {
      throw new ConflictException(
        'Flight has no segments — seats cannot be assigned',
      );
    }

    const converted = await tx.seatHold.updateMany({
      where: { bookingId, status: 'ACTIVE' },
      data: { status: 'CONVERTED' },
    });
    if (converted.count !== activeHolds.length) {
      throw new ConflictException(
        'Seat holds changed concurrently — please retry the payment',
      );
    }

    const holdsSorted = [...activeHolds].sort((a, b) =>
      a.seat.seatNumber.localeCompare(b.seat.seatNumber),
    );
    const passengersSorted = [...booking.bookingPassengers].sort((a, b) =>
      `${a.passenger.lastName}${a.passenger.firstName}${a.passenger.id}`.localeCompare(
        `${b.passenger.lastName}${b.passenger.firstName}${b.passenger.id}`,
      ),
    );

    for (let i = 0; i < holdsSorted.length; i++) {
      const hold = holdsSorted[i]!;
      const bookingPassenger = passengersSorted[i]!;
      for (const segment of segments) {
        try {
          await tx.bookingSeat.create({
            data: {
              bookingPassengerId: bookingPassenger.id,
              flightSegmentId: segment.id,
              seatId: hold.seatId,
              seatNumber: hold.seat.seatNumber,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // @@unique([flightSegmentId, seatId]) is the authoritative guard.
            throw new ConflictException(
              `Seat ${hold.seat.seatNumber} is no longer available`,
            );
          }
          throw error;
        }
      }
    }

    return {
      seatNumbers: holdsSorted.map((h) => h.seat.seatNumber),
      holdCount: holdsSorted.length,
    };
  }

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
      this.logger.warn(logMessage);
    } catch (error) {
      this.logger.error(
        `failed to mark refund ${refundId} REJECTED (${logMessage}): ${String(error)}`,
      );
    }
  }

  // ---------- Audit (post-commit, fail-soft — bookings module convention) ----------

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
    try {
      await this.auditService.log({
        actorId: staff.userId,
        actorType: 'Staff',
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
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
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
}
