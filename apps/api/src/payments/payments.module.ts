import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsModule } from '../bookings/bookings.module.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { PaymentsService } from './payments.service.js';
import { CustomerPaymentsController } from './customer-payments.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { AdminRefundsController } from './admin-refunds.controller.js';
import { AdminBookingLifecycleController } from './admin-booking-lifecycle.controller.js';

/**
 * Payments & refunds (SRS 19.4 PaymentsModule): provider tokenization, no raw
 * card storage, idempotency, payment-success gate, audited refund handling.
 * The provider is selected via PAYMENT_PROVIDER (default 'mock'); the business
 * logic depends only on the PaymentProvider abstraction.
 */
@Module({
  imports: [BookingsModule],
  controllers: [
    CustomerPaymentsController,
    AdminPaymentsController,
    AdminRefundsController,
    AdminBookingLifecycleController,
  ],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService): PaymentProvider => {
        const name = config.get<string>('PAYMENT_PROVIDER', 'mock');
        if (name === 'mock') {
          return new MockPaymentProvider();
        }
        throw new Error(`Unsupported PAYMENT_PROVIDER "${name}"`);
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
