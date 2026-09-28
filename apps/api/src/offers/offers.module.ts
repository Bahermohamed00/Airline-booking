import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller.js';
import { AdminOffersController } from './admin-offers.controller.js';
import { OffersService } from './offers.service.js';

@Module({
  controllers: [OffersController, AdminOffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
