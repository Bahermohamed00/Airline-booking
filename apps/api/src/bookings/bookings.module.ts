import { forwardRef, Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { SeatHoldsService } from './seat-holds.service.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { OffersModule } from '../offers/offers.module.js';
import { ExtrasModule } from '../extras/extras.module.js';

@Module({
  // forwardRef: PaymentsModule imports this module too — booking cancellation
  // paths call PaymentsService.cancelOpenIntentsForCancelledBooking post-commit
  // (Phase 3.2C), so the module graph is intentionally circular and deferred.
  imports: [forwardRef(() => PaymentsModule), OffersModule, ExtrasModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, SeatHoldsService],
  exports: [BookingsService, SeatHoldsService],
})
export class BookingsModule {}
