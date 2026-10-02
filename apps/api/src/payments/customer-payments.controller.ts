import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { PayBookingDto } from './dto/pay-booking.dto.js';

/**
 * Customer payment routes — owner-scoped (service verifies userId), any
 * authenticated user may attempt payment for their own booking (same
 * convention as the bookings controller: no staff permission required).
 */
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CustomerPaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post(':id/payment')
  pay(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: PayBookingDto) {
    return this.payments.payBooking(user, id, dto);
  }

  @Get(':id/payments')
  findPayments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.payments.findOwnPayments(user, id);
  }
}
