import { Body, Controller, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto.js';
import { ConfirmExceptionDto } from './dto/confirm-exception.dto.js';

/**
 * Staff booking lifecycle mutations (bookings:manage). Read-only admin booking
 * routes live in the bookings module's AdminBookingsController.
 */
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminBookingLifecycleController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions({ resource: 'bookings', action: 'manage' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() staff: AuthUser,
    @Body() dto: AdminCancelBookingDto,
  ) {
    return this.payments.adminCancelBooking(staff, id, dto);
  }

  /** BR-14: audited payment-exception confirmation (never creates a Payment row). */
  @Post(':id/confirm-exception')
  @HttpCode(HttpStatus.OK)
  @Permissions({ resource: 'bookings', action: 'manage' })
  confirmException(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() staff: AuthUser,
    @Body() dto: ConfirmExceptionDto,
  ) {
    return this.payments.confirmBookingException(staff, id, dto);
  }
}
