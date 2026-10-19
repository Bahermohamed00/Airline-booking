import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller.js';
import { AdminCheckInController } from './admin-checkin.controller.js';
import { CheckinService } from './checkin.service.js';
import { BaggageModule } from '../baggage/baggage.module.js';

@Module({
  // BaggageModule provides the tag-issuance used at check-in completion.
  imports: [BaggageModule],
  controllers: [CheckinController, AdminCheckInController],
  providers: [CheckinService],
})
export class CheckinModule {}
