import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { FlightsService } from './flights.service.js';
import { FlightQueryDto } from './dto/flight-query.dto.js';
import { GenerateFlightsDto } from './dto/generate-flights.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('flights')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class FlightsController {
  constructor(@Inject(FlightsService) private readonly flights: FlightsService) {}

  @Get()
  @Public()
  findAll(@Query() query: FlightQueryDto) {
    return this.flights.findAll(query);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.flights.findOne(id);
  }

  @Post('generate')
  @Permissions({ resource: 'flights', action: 'manage' })
  generate(@Body() dto: GenerateFlightsDto) {
    return this.flights.generate(dto);
  }
}
