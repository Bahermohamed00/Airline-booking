import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsModule } from '../bookings/bookings.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { StripePaymentProvider } from './stripe-payment.provider.js';
import { PaymentsService } from './payments.service.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentReconciliationService } from './payment-reconciliation.service.js';
import { RefundReconciliationService } from './refund-reconciliation.service.js';
import { RefundMetricsService } from './refund-metrics.service.js';
import { CustomerPaymentsController } from './customer-payments.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { AdminRefundsController } from './admin-refunds.controller.js';
import { AdminBookingLifecycleController } from './admin-booking-lifecycle.controller.js';
import { AdminCancellationRequestsController } from './admin-cancellation-requests.controller.js';
import { PaymentsWebhookController } from './payments-webhook.controller.js';

/**
 * Payments & refunds (SRS 19.4 PaymentsModule): provider tokenization, no raw
 * card storage, idempotency, payment-success gate, audited refund handling.
 * The provider is selected via PAYMENT_PROVIDER (default 'mock'); the business
 * logic depends only on the PaymentProvider abstraction.
 *
 * PAYMENT_PROVIDER=stripe selects the Stripe PaymentIntent provider and
 * REQUIRES STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET — StripePaymentProvider
 * throws at bootstrap when either is missing. There is deliberately no silent
 * fallback from Stripe to mock.
 */
@Module({
  imports: [
    forwardRef(() => BookingsModule),
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [
    CustomerPaymentsController,
    AdminPaymentsController,
    AdminRefundsController,
    AdminBookingLifecycleController,
    AdminCancellationRequestsController,
    PaymentsWebhookController,
  ],
  providers: [
    PaymentsService,
    PaymentWebhookService,
    PaymentReconciliationService,
    RefundReconciliationService,
    RefundMetricsService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService): PaymentProvider => {
        const name = config.get<string>('PAYMENT_PROVIDER', 'mock');
        if (name === 'mock') {
          return new MockPaymentProvider();
        }
        if (name === 'stripe') {
          return new StripePaymentProvider({
            secretKey: config.get<string>('STRIPE_SECRET_KEY') ?? '',
            webhookSecret: config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '',
          });
        }
        throw new Error(`Unsupported PAYMENT_PROVIDER "${name}"`);
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentsService, RefundMetricsService],
})
export class PaymentsModule {}
