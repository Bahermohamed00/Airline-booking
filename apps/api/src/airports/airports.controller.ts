import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AirportsService } from './airports.service.js';
import { type AirportView } from './airport-view.js';
import { CreateAirportDto } from './dto/create-airport.dto.js';
import { UpdateAirportDto } from './dto/update-airport.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

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
  create(@Body() dto: CreateAirportDto, @CurrentUser() actor: AuthUser): Promise<AirportView> {
    return this.airports.create(dto, actor);
  }

  @Patch(':id')
  @Permissions({ resource: 'airports', action: 'manage' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAirportDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AirportView> {
    return this.airports.update(id, dto, actor);
  }
}
