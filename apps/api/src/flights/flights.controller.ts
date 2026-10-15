import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FlightsService } from './flights.service.js';
import { FlightQueryDto } from './dto/flight-query.dto.js';
import { GenerateFlightsDto } from './dto/generate-flights.dto.js';
import { UpdateFlightStatusDto } from './dto/update-flight-status.dto.js';
import { UpdateFlightDto } from './dto/update-flight.dto.js';
import { CreateFlightDto } from './dto/create-flight.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

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

  @Get(':id/seat-availability')
  @Public()
  getSeatAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.flights.getSeatAvailability(id);
  }

  @Post()
  @Permissions({ resource: 'flights', action: 'manage' })
  create(@Body() dto: CreateFlightDto, @CurrentUser() actor: AuthUser) {
    return this.flights.create(dto, actor);
  }

  @Patch(':id')
  @Permissions({ resource: 'flights', action: 'manage' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlightDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.flights.update(id, dto, actor);
  }

  @Patch(':id/status')
  @Permissions({ resource: 'flights', action: 'manage' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlightStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.flights.updateStatus(id, dto, actor);
  }

  @Post('generate')
  @Permissions({ resource: 'flights', action: 'manage' })
  generate(@Body() dto: GenerateFlightsDto, @CurrentUser() actor: AuthUser) {
    return this.flights.generate(dto, actor);
  }
}
