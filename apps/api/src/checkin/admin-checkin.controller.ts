import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CheckinService } from './checkin.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

/**
 * Staff check-in operations (SRS admin console): the operational readiness
 * list and boarding-pass invalidation. Both require the seeded
 * checkin:manage permission; the service owns all domain rules.
 */
@Controller('admin/checkin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminCheckInController {
  constructor(@Inject(CheckinService) private readonly checkin: CheckinService) {}

  @Get()
  @Permissions({ resource: 'checkin', action: 'manage' })
  operationalList() {
    return this.checkin.findOperationalList();
  }

  @Post(':bookingId/invalidate')
  @Permissions({ resource: 'checkin', action: 'manage' })
  invalidate(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.checkin.invalidateBoardingPasses(user, bookingId);
  }
}
