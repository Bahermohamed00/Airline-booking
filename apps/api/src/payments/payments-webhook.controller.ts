import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { PaymentWebhookService } from './payment-webhook.service.js';

/**
 * Stripe webhook receiver — the ONLY public route in the payments module.
 *
 * Security is the Stripe signature over the exact raw request bytes
 * (STRIPE_WEBHOOK_SECRET), not JWT: @Public() is correct here and the
 * signature check is mandatory before any byte of the payload is trusted.
 * Throttling is skipped because Stripe retries must never be rate-limited.
 *
 * FAIL CLOSED: if the raw body is unavailable (the API was not bootstrapped
 * with rawBody: true), the endpoint errors loudly instead of verifying a
 * reconstructed body — re-serialized JSON can never satisfy the HMAC.
 */
@Controller('payments')
export class PaymentsWebhookController {
  constructor(
    @Inject(PaymentWebhookService)
    private readonly webhooks: PaymentWebhookService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async handleStripe(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true; status: string }> {
    if (!Buffer.isBuffer(request.rawBody)) {
      throw new InternalServerErrorException(
        'Webhook raw body is unavailable — bootstrap must create the app with rawBody: true (see the Phase 2 handoff for main.ts)',
      );
    }
    return this.webhooks.handleStripeWebhook(request.rawBody, signature);
  }
}
