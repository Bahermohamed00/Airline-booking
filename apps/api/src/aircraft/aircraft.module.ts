import { Module } from '@nestjs/common';
import { AircraftController } from './aircraft.controller.js';
import { AircraftService } from './aircraft.service.js';

@Module({
  controllers: [AircraftController],
  providers: [AircraftService],
  exports: [AircraftService],
})
export class AircraftModule {}
