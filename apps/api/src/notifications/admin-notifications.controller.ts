import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { AdminNotificationQueryDto } from './dto/admin-notification-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

/**
 * Staff operations view over persisted notification records (read-only).
 * Gated on the dedicated `notifications:read` permission — deliberately
 * separate from `notifications:manage` (future admin actions). Super Admin
 * bypasses via the existing super_admin mechanism. There is intentionally
 * no create/resend/retry/delete/delivery endpoint here.
 */
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminNotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @Permissions({ resource: 'notifications', action: 'read' })
  list(@Query() query: AdminNotificationQueryDto) {
    return this.notifications.listAdmin(query);
  }
}
