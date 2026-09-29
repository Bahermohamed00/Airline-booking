import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service.js';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto.js';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('schedule-rules')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ScheduleRulesController {
  constructor(@Inject(ScheduleRulesService) private readonly scheduleRules: ScheduleRulesService) {}

  @Get()
  @Permissions({ resource: 'flights', action: 'read' })
  findAll() {
    return this.scheduleRules.findAll();
  }

  @Get(':id')
  @Permissions({ resource: 'flights', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleRules.findOne(id);
  }

  @Post()
  @Permissions({ resource: 'flights', action: 'manage' })
  create(@Body() dto: CreateScheduleRuleDto) {
    return this.scheduleRules.create(dto);
  }

  @Patch(':id')
  @Permissions({ resource: 'flights', action: 'manage' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduleRuleDto) {
    return this.scheduleRules.update(id, dto);
  }
}
