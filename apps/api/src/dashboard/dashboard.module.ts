import { Module } from '@nestjs/common';
import { FlightsModule } from '../flights/flights.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardGateway } from './dashboard.gateway.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [FlightsModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGateway],
})
export class DashboardModule {}
