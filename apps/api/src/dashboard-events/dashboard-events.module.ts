import { Global, Module } from '@nestjs/common';
import { DashboardEventsService } from './dashboard-events.service.js';

/**
 * Global, mirroring AuditModule: any domain service can publish dashboard
 * invalidation events without module wiring, and the dashboard gateway
 * subscribes once.
 */
@Global()
@Module({
  providers: [DashboardEventsService],
  exports: [DashboardEventsService],
})
export class DashboardEventsModule {}
