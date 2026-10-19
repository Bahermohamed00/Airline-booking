import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isPaymentIntentProvider,
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderWebhookEvent,
} from './payment-provider.js';
import {
  PaymentReconciliationError,
  PaymentsService,
  UnknownProviderIntentError,
} from './payments.service.js';

type EventMark = 'PROCESSED' | 'FAILED' | 'IGNORED';

/**
 * Provider webhook processing (POST /api/payments/webhook).
 *
 * Pipeline, strictly in this order:
 * 1. signature verification over the EXACT raw request bytes (performed by the
 *    provider — nothing in the payload is trusted before this point, including
 *    any claimed event id);
 * 2. database-backed deduplication via PaymentWebhookEvent
 *    (unique(provider, eventId)) — survives restarts, multiple API instances
 *    and duplicate Stripe deliveries;
 * 3. transactional processing of the PaymentIntent lifecycle events;
 * 4. the event row is marked PROCESSED inside the same transaction as the
 *    payment/booking state change (payment_intent.succeeded) or immediately
 *    after the idempotent state update (other event types).
 *
 * Error contract:
 * - invalid signature / malformed payload / missing header → 400;
 * - unknown intent → event IGNORED, 200 (retrying can never help);
 * - reconciliation invariant violated (amount/currency mismatch, booking not
 *   confirmable) → event FAILED with the reason, 200 — permanent, needs
 *   manual reconciliation, and Stripe retries would be pointless;
 * - any transient failure (DB, …) → 500, the event stays RECEIVED and the
 *   Stripe retry reprocesses it.
 */
@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  async handleStripeWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ received: true; status: string }> {
    if (!isPaymentIntentProvider(this.provider)) {
      throw new BadRequestException(
        'The configured payment provider does not support webhooks',
      );
    }
    if (!signatureHeader) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: ProviderWebhookEvent;
    try {
      event = this.provider.constructWebhookEvent(rawBody, signatureHeader);
    } catch (error) {
      this.logger.warn(
        `webhook signature verification failed: ${String(error)}`,
      );
      throw new BadRequestException('Webhook signature verification failed');
    }
    return this.processVerifiedEvent(event);
  }

  private async processVerifiedEvent(
    event: ProviderWebhookEvent,
  ): Promise<{ received: true; status: string }> {
    const providerName = this.provider.name;

    // Deduplicate FIRST: the row insert is the claim. unique(provider, eventId)
    // turns a duplicate delivery into P2002 even across concurrent instances.
    let recordId: string;
    let alreadyProcessed = false;
    try {
      const record = await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: providerName,
          eventId: event.eventId,
          eventType: event.eventType,
        },
      });
      recordId = record.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.paymentWebhookEvent.findUniqueOrThrow({
          where: {
            provider_eventId: { provider: providerName, eventId: event.eventId },
          },
        });
        recordId = existing.id;
        alreadyProcessed = existing.processedAt !== null;
      } else {
        throw error;
      }
    }

    if (alreadyProcessed) {
      // Duplicate delivery of a fully handled event — harmless no-op.
      return { received: true, status: 'duplicate' };
    }

    try {
      const status = await this.dispatch(event, providerName, recordId);
      return { received: true, status };
    } catch (error) {
      if (error instanceof UnknownProviderIntentError) {
        await this.markEvent(recordId, 'IGNORED', error.message);
        return { received: true, status: 'ignored:unknown-payment' };
      }
      if (error instanceof PaymentReconciliationError) {
        this.logger.error(
          `webhook event ${event.eventId} (${event.eventType}) reconciliation failure: ${error.message}`,
        );
        await this.markEvent(recordId, 'FAILED', error.message);
        return { received: true, status: 'failed:reconciliation' };
      }
      // Transient — the event row stays RECEIVED/unprocessed and Stripe's
      // retry reprocesses it.
      throw error;
    }
  }

  private async dispatch(
    event: ProviderWebhookEvent,
    providerName: string,
    recordId: string,
  ): Promise<string> {
    const intent = event.intent;
    switch (event.eventType) {
      case 'payment_intent.succeeded': {
        if (!intent) {
          await this.markEvent(recordId, 'IGNORED', 'missing intent payload');
          return 'ignored:malformed';
        }
        // finalizeSucceededIntent marks this event PROCESSED inside the same
        // transaction as the payment/booking transition.
        await this.payments.finalizeSucceededIntent(intent, {
          provider: providerName,
          eventId: event.eventId,
        });
        return 'processed';
      }
      case 'payment_intent.payment_failed': {
        if (!intent) {
          await this.markEvent(recordId, 'IGNORED', 'missing intent payload');
          return 'ignored:malformed';
        }
        await this.payments.markIntentFailed(intent);
        await this.markEvent(recordId, 'PROCESSED');
        return 'processed';
      }
      case 'payment_intent.canceled': {
        if (!intent) {
          await this.markEvent(recordId, 'IGNORED', 'missing intent payload');
          return 'ignored:malformed';
        }
        await this.payments.markIntentCanceled(intent);
        await this.markEvent(recordId, 'PROCESSED');
        return 'processed';
      }
      case 'payment_intent.processing':
      case 'payment_intent.requires_action': {
        // Neither is a success signal — only the fine-grained provider status
        // is tracked; the payment stays PENDING.
        if (!intent) {
          await this.markEvent(recordId, 'IGNORED', 'missing intent payload');
          return 'ignored:malformed';
        }
        await this.payments.noteIntentStatus(intent);
        await this.markEvent(recordId, 'PROCESSED');
        return 'processed';
      }
      default:
        // Verified but irrelevant to the PaymentIntent workflow.
        await this.markEvent(
          recordId,
          'IGNORED',
          `unsupported event type: ${event.eventType}`,
        );
        return 'ignored:unsupported-event';
    }
  }

  private async markEvent(
    id: string,
    status: EventMark,
    processingError?: string,
  ): Promise<void> {
    await this.prisma.paymentWebhookEvent.update({
      where: { id },
      data: {
        status,
        processedAt: new Date(),
        ...(processingError !== undefined ? { processingError } : {}),
      },
    });
  }
}
