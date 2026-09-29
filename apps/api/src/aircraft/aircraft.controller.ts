import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Seat } from '@prisma/client';
import { AircraftService, type AircraftView } from './aircraft.service.js';
import { CreateAircraftDto } from './dto/create-aircraft.dto.js';
import { UpdateAircraftDto } from './dto/update-aircraft.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('aircraft')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AircraftController {
  constructor(@Inject(AircraftService) private readonly aircraft: AircraftService) {}

  @Get()
  @Public()
  findAll(): Promise<AircraftView[]> {
    return this.aircraft.findAll();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AircraftView> {
    return this.aircraft.findOne(id);
  }

  @Get(':id/seats')
  @Public()
  findSeats(@Param('id', ParseUUIDPipe) id: string): Promise<Seat[]> {
    return this.aircraft.findSeats(id);
  }

  @Post()
  @Permissions({ resource: 'aircraft', action: 'manage' })
  create(@Body() dto: CreateAircraftDto): Promise<AircraftView> {
    return this.aircraft.create(dto);
  }

  @Patch(':id')
  @Permissions({ resource: 'aircraft', action: 'manage' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAircraftDto): Promise<AircraftView> {
    return this.aircraft.update(id, dto);
  }
}
