import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isPaymentIntentProvider,
  PAYMENT_PROVIDER,
  type PaymentIntentProvider,
  type PaymentIntentSnapshot,
  type PaymentProvider,
} from './payment-provider.js';
import {
  PaymentReconciliationError,
  PaymentsService,
  UnknownProviderIntentError,
} from './payments.service.js';
import {
  resolveReconciliationBatchSize,
  resolveReconciliationMinAgeMinutes,
} from './payment-reconciliation-config.js';

/** Projection of one eligible stale PENDING payment row. */
interface StalePaymentRow {
  id: string;
  bookingId: string;
  providerReference: string;
}

export interface ReconciliationSweepSummary {
  eligible: number;
  succeeded: number;
  canceled: number;
  noted: number;
  failed: number;
}

type ReconciliationOutcome = 'succeeded' | 'canceled' | 'noted';

/**
 * P0 recovery: discovers stale Stripe PENDING payments whose webhook was
 * delayed or lost and reconciles them against Stripe's authoritative
 * PaymentIntent state.
 *
 * Eligibility is deliberately narrow (Phase 3.2B scope): status PENDING,
 * provider = the configured PaymentIntent provider, providerReference present,
 * updatedAt older than PAYMENT_RECONCILIATION_MIN_AGE_MINUTES (default 5), at
 * most PAYMENT_RECONCILIATION_BATCH_SIZE rows per run (default 25) — a backlog
 * drains over subsequent runs. Payments WITHOUT a provider reference are out
 * of scope (the intent may not exist or is unrecoverable from our side; Stripe
 * list/search is a later phase). SUCCESS/FAILED/REFUNDED payments and mock
 * payments are never touched.
 *
 * Safety properties:
 * - strictly retrieval-based: the sweep never creates or cancels anything at
 *   the provider and never uses an idempotency key;
 * - every state change is delegated to the SAME idempotent, CAS-protected
 *   handlers the webhook pipeline uses (finalizeSucceededIntent /
 *   markIntentCanceled / noteIntentStatus), so webhook vs sweep, customer
 *   resume vs sweep, and overlapping sweeps all converge to one winner — no
 *   duplicate Payment success, BookingSeat, or confirmation;
 * - amount/currency verification stays inside finalizeSucceededIntent; a
 *   mismatch or an unconfirmable booking surfaces as PaymentReconciliationError
 *   and is logged for manual handling, never silently confirmed;
 * - no database transaction is held across a Stripe network call;
 * - one failing payment never aborts the batch;
 * - the scheduled job is a thin wrapper: NODE_ENV=test disables it (same guard
 *   as the seat-hold sweep), and mock-provider deployments return immediately.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileStalePendingPaymentsJob(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    await this.reconcileStalePendingPayments();
  }

  /**
   * One bounded sweep. Overlapping executions (long batch across two ticks, or
   * multiple API instances) are safe: retrieval is side-effect-free and every
   * downstream transition is idempotent/CAS-protected, so duplicates converge
   * instead of corrupting.
   */
  async reconcileStalePendingPayments(
    now = new Date(),
  ): Promise<ReconciliationSweepSummary> {
    const summary: ReconciliationSweepSummary = {
      eligible: 0,
      succeeded: 0,
      canceled: 0,
      noted: 0,
      failed: 0,
    };
    if (!isPaymentIntentProvider(this.provider)) {
      // Mock provider deployments have no PaymentIntents to reconcile.
      return summary;
    }
    const provider = this.provider;

    const minAgeMinutes = resolveReconciliationMinAgeMinutes(
      this.config.get('PAYMENT_RECONCILIATION_MIN_AGE_MINUTES'),
    );
    const batchSize = resolveReconciliationBatchSize(
      this.config.get('PAYMENT_RECONCILIATION_BATCH_SIZE'),
    );
    const cutoff = new Date(now.getTime() - minAgeMinutes * 60_000);

    const stale = (
      await this.prisma.payment.findMany({
        where: {
          status: 'PENDING',
          provider: provider.name,
          providerReference: { not: null },
          updatedAt: { lt: cutoff },
        },
        orderBy: { updatedAt: 'asc' },
        take: batchSize,
        select: { id: true, bookingId: true, providerReference: true },
      })
    ).filter((p): p is StalePaymentRow => p.providerReference !== null);
    summary.eligible = stale.length;

    // Sequential by design: bounded Stripe request rate, simple failure
    // isolation, and no Promise.all abort semantics.
    for (const payment of stale) {
      try {
        const outcome = await this.reconcilePayment(provider, payment);
        summary[outcome] += 1;
      } catch (error) {
        summary.failed += 1;
        this.logFailure(payment, error);
      }
    }
    if (summary.eligible > 0) {
      this.logger.log(
        `reconciliation sweep: eligible=${summary.eligible} ` +
          `succeeded=${summary.succeeded} canceled=${summary.canceled} ` +
          `noted=${summary.noted} failed=${summary.failed}`,
      );
    }
    return summary;
  }

  /** Retrieves the intent (read-only) and applies it — never creates anything at the provider. */
  private async reconcilePayment(
    provider: PaymentIntentProvider,
    payment: StalePaymentRow,
  ): Promise<ReconciliationOutcome> {
    const snapshot = await provider.retrievePaymentIntent(
      payment.providerReference,
    );
    return this.applyIntentSnapshot(payment, snapshot);
  }

  /**
   * Maps a retrieved PaymentIntent state onto the same handlers the webhook
   * pipeline dispatches to — no second implementation of any transition.
   *
   * `payment_failed` is intentionally absent: it is a webhook EVENT, not a
   * retrievable intent state (a declined confirmation returns the intent to
   * requires_payment_method, which the customer may still retry). The sweep
   * therefore never fabricates FAILED from observation alone; the terminal
   * failure it can observe is `canceled`.
   */
  async applyIntentSnapshot(
    payment: StalePaymentRow,
    snapshot: PaymentIntentSnapshot,
  ): Promise<ReconciliationOutcome> {
    const bound = { ...snapshot, paymentId: payment.id };
    switch (snapshot.status) {
      case 'succeeded':
        await this.payments.finalizeSucceededIntent(bound);
        return 'succeeded';
      case 'canceled':
        await this.payments.markIntentCanceled(bound);
        return 'canceled';
      case 'processing':
      case 'requires_action':
      case 'requires_payment_method':
      case 'requires_confirmation':
        // Open states: only the fine-grained provider status is tracked; the
        // payment stays PENDING and recoverable for a future sweep/webhook.
        await this.payments.noteIntentStatus(bound);
        return 'noted';
      default:
        // The provider's mapStatus normally throws on unknown statuses first;
        // this is defense in depth — never map unknown to success or failure.
        throw new Error(
          `Unsupported PaymentIntent status: ${String((snapshot as { status: unknown }).status)}`,
        );
    }
  }

  /**
   * Per-payment failure logging. Ids and the provider reference only — never
   * the intent snapshot (which carries a client secret) or any credential.
   */
  private logFailure(payment: StalePaymentRow, error: unknown): void {
    const base = `payment ${payment.id} (booking ${payment.bookingId}, intent ${payment.providerReference})`;
    if (error instanceof PaymentReconciliationError) {
      // Permanent: verified provider state contradicts persisted data, or the
      // booking can no longer be confirmed — manual reconciliation required.
      this.logger.error(`reconciliation: ${base}: ${error.message}`);
      return;
    }
    if (error instanceof UnknownProviderIntentError) {
      this.logger.warn(`reconciliation: ${base}: ${error.message}`);
      return;
    }
    // Transient (Stripe timeout/network/5xx): the payment stays PENDING and is
    // retried by a future sweep.
    this.logger.warn(`reconciliation: ${base} failed transiently: ${String(error)}`);
  }
}
