import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { AdminCancellationRequestQueryDto } from './dto/admin-cancellation-request-query.dto.js';
import { RejectCancellationRequestDto } from './dto/reject-cancellation-request.dto.js';

/**
 * Staff review queue for customer cancellation requests (bookings:manage).
 * Approval executes through the existing refund machinery in PaymentsService;
 * rejection leaves booking and payment untouched.
 */
@Controller('admin/cancellation-requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminCancellationRequestsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  @Permissions({ resource: 'bookings', action: 'manage' })
  list(@Query() query: AdminCancellationRequestQueryDto) {
    return this.payments.listCancellationRequests(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions({ resource: 'bookings', action: 'manage' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() staff: AuthUser) {
    return this.payments.approveCancellationRequest(staff, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions({ resource: 'bookings', action: 'manage' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() staff: AuthUser,
    @Body() dto: RejectCancellationRequestDto,
  ) {
    return this.payments.rejectCancellationRequest(staff, id, dto);
  }
}
