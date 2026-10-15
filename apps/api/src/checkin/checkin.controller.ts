import { Body, Controller, Get, Inject, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { CheckinService } from './checkin.service.js';
import { CheckinBookingsQueryDto } from './dto/checkin-bookings-query.dto.js';
import { CompleteCheckinDto } from './dto/complete-checkin.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

@Controller('checkin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CheckinController {
  constructor(@Inject(CheckinService) private readonly checkin: CheckinService) {}

  @Get('bookings')
  bookings(@CurrentUser() user: AuthUser, @Query() query: CheckinBookingsQueryDto) {
    return this.checkin.lookupBookings(user, query);
  }

  @Post()
  complete(@CurrentUser() user: AuthUser, @Body() dto: CompleteCheckinDto) {
    return this.checkin.completeCheckIn(user, dto);
  }

  @Get('boarding-pass')
  boardingPass(@CurrentUser() user: AuthUser, @Query('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.checkin.boardingPasses(user, bookingId);
  }
}
