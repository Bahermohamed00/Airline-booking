import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { SeatHoldsService } from './seat-holds.service.js';

@Module({
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, SeatHoldsService],
  exports: [BookingsService, SeatHoldsService],
})
export class BookingsModule {}
