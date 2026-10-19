import { Module } from '@nestjs/common';
import { BaggageController } from './baggage.controller.js';
import { BaggageTrackingController } from './baggage-tracking.controller.js';
import { BaggageService } from './baggage.service.js';

@Module({
  controllers: [BaggageController, BaggageTrackingController],
  providers: [BaggageService],
  // Exported for check-in: baggage issuance happens inside the check-in
  // transaction (baggage declaration at online check-in).
  exports: [BaggageService],
})
export class BaggageModule {}
