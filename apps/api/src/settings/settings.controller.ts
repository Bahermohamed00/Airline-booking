import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { UpdateSettingDto } from './dto/update-setting.dto.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  @Get()
  @Permissions({ resource: 'settings', action: 'manage' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  @Permissions({ resource: 'settings', action: 'manage' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.update(key, dto.value, user);
  }
}
