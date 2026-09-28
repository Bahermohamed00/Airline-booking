import { Module } from '@nestjs/common';
import { ScheduleRulesController } from './schedule-rules.controller.js';
import { ScheduleRulesService } from './schedule-rules.service.js';

@Module({
  controllers: [ScheduleRulesController],
  providers: [ScheduleRulesService],
  exports: [ScheduleRulesService],
})
export class ScheduleRulesModule {}
