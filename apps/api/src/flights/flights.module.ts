import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller.js';
import { FlightsService } from './flights.service.js';

@Module({
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}
