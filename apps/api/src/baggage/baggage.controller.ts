import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Inject,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BaggageService } from './baggage.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { RecordBaggageEventDto } from './dto/record-baggage-event.dto.js';

@Controller('admin/baggage')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BaggageController {
  constructor(
    @Inject(BaggageService) private readonly baggageService: BaggageService,
  ) {}

  @Get()
  @Permissions({ resource: 'baggage', action: 'manage' })
  findAll() {
    return this.baggageService.findAll();
  }

  @Post(':id/events')
  @Permissions({ resource: 'baggage', action: 'manage' })
  recordEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordBaggageEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baggageService.recordEvent(id, dto, user);
  }
}
