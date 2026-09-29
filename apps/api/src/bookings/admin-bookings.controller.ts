import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { AdminBookingQueryDto } from './dto/admin-booking-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

/** Staff read access to bookings, backed by the existing bookings:read permission. */
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminBookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  @Get()
  @Permissions({ resource: 'bookings', action: 'read' })
  findAll(@Query() query: AdminBookingQueryDto) {
    return this.bookings.findAllAdmin(query);
  }

  @Get(':id')
  @Permissions({ resource: 'bookings', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.findOneAdmin(id);
  }
}
