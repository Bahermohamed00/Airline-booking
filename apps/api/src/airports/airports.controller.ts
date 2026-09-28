import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AirportsService, type AirportView } from './airports.service.js';
import { CreateAirportDto } from './dto/create-airport.dto.js';
import { UpdateAirportDto } from './dto/update-airport.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('airports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AirportsController {
  constructor(@Inject(AirportsService) private readonly airports: AirportsService) {}

  @Get()
  @Public()
  findAll(): Promise<AirportView[]> {
    return this.airports.findAll();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AirportView> {
    return this.airports.findOne(id);
  }

  @Post()
  @Permissions({ resource: 'airports', action: 'manage' })
  create(@Body() dto: CreateAirportDto): Promise<AirportView> {
    return this.airports.create(dto);
  }

  @Patch(':id')
  @Permissions({ resource: 'airports', action: 'manage' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAirportDto): Promise<AirportView> {
    return this.airports.update(id, dto);
  }
}
