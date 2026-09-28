import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller.js';
import { FlightsService } from './flights.service.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { AdminCatalogController } from './admin-catalog.controller.js';

@Module({
  controllers: [FlightsController, AdminCatalogController],
  providers: [FlightsService, AdminCatalogService],
  exports: [FlightsService],
})
export class FlightsModule {}
