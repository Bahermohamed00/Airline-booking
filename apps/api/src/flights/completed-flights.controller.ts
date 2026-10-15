import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { FlightsService } from './flights.service.js';
import { CompletedFlightsQueryDto } from './dto/completed-flights-query.dto.js';
import { FlightHistoryQueryDto } from './dto/flight-history-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

/**
 * Flight Manager operations APIs (all flights:read): the FM overview
 * dashboard, the completed-flights report, and the immutable flight-domain
 * history. Read-only by construction — GETs only, no mutation of any kind.
 */
@Controller('admin/flights')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CompletedFlightsController {
  constructor(@Inject(FlightsService) private readonly flights: FlightsService) {}

  @Get('overview')
  @Permissions({ resource: 'flights', action: 'read' })
  overview() {
    return this.flights.overview();
  }

  @Get('completed')
  @Permissions({ resource: 'flights', action: 'read' })
  findCompleted(@Query() query: CompletedFlightsQueryDto) {
    return this.flights.findCompleted(query);
  }

  @Get('history')
  @Permissions({ resource: 'flights', action: 'read' })
  history(@Query() query: FlightHistoryQueryDto) {
    return this.flights.history(query);
  }
}
