import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentStatusGateway } from './payment-status.gateway.js';
import { RealtimeEventsService } from './realtime-events.service.js';

/**
 * Realtime push infrastructure (Socket.IO). Kept deliberately small: one
 * gateway authenticates connections with the HTTP JWT rules and authorizes
 * room membership per booking; feature modules publish minimal post-commit
 * events through RealtimeEventsService.
 */
@Module({
  imports: [AuthModule],
  providers: [PaymentStatusGateway, RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
