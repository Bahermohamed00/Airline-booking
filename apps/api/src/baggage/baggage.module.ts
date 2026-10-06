import { Module } from '@nestjs/common';
import { BaggageController } from './baggage.controller.js';
import { BaggageService } from './baggage.service.js';

@Module({
  controllers: [BaggageController],
  providers: [BaggageService],
})
export class BaggageModule {}
