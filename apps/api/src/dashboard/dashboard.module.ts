import { Module } from '@nestjs/common';
import { FlightsModule } from '../flights/flights.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [FlightsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
