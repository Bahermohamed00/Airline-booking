import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';

/**
 * Customer self-service inbox. The recipient is always the authenticated
 * principal — no client-supplied user or recipient ids exist on these routes.
 * Deliberately not gated on `notifications:manage` (that permission is for
 * future staff/admin surfaces, not customer self-service).
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsDto) {
    return this.notifications.findMine(user, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllMineRead(user);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markMineRead(user, id);
  }
}
