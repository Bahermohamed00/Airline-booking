import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller.js';
import { CompletedFlightsController } from './completed-flights.controller.js';
import { FlightsService } from './flights.service.js';
import { FlightLifecycleService } from './flight-lifecycle.service.js';

@Module({
  controllers: [FlightsController, CompletedFlightsController],
  providers: [FlightsService, FlightLifecycleService],
  exports: [FlightsService],
})
export class FlightsModule {}
