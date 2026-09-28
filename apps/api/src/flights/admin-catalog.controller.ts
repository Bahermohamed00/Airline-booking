import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { AdminCatalogService } from './admin-catalog.service.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import {
  CreateAirportDto, UpdateAirportDto, CreateRouteDto, UpdateRouteDto,
  CreateAircraftDto, UpdateAircraftDto, CreateFlightDto, UpdateFlightDto,
  CreateFareDto, UpdateFareDto, CreateSegmentDto,
} from './dto/admin-catalog.dto.js';

// All routes here are behind the global JwtAuthGuard + RolesGuard +
// PermissionsGuard; @Permissions scopes each operation (BR-08/BR-09).

@Controller('admin')
export class AdminCatalogController {
  constructor(@Inject(AdminCatalogService) private readonly catalog: AdminCatalogService) {}

  // ---------- Airports (SRS 5.3) ----------

  @Get('airports')
  @Permissions({ resource: 'airports', action: 'manage' })
  airports() {
    return this.catalog.listAirports();
  }

  @Post('airports')
  @Permissions({ resource: 'airports', action: 'manage' })
  createAirport(@Body() dto: CreateAirportDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createAirport(dto, user.userId);
  }

  @Patch('airports/:id')
  @Permissions({ resource: 'airports', action: 'manage' })
  updateAirport(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAirportDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateAirport(id, dto, user.userId);
  }

  @Delete('airports/:id')
  @Permissions({ resource: 'airports', action: 'manage' })
  deactivateAirport(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deactivateAirport(id, user.userId);
  }

  // ---------- Routes (SRS 5.5) ----------

  @Get('routes')
  @Permissions({ resource: 'routes', action: 'manage' })
  routes() {
    return this.catalog.listRoutes();
  }

  @Post('routes')
  @Permissions({ resource: 'routes', action: 'manage' })
  createRoute(@Body() dto: CreateRouteDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createRoute(dto, user.userId);
  }

  @Patch('routes/:id')
  @Permissions({ resource: 'routes', action: 'manage' })
  updateRoute(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRouteDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateRoute(id, dto, user.userId);
  }

  // ---------- Aircraft (SRS 5.4) ----------

  @Get('aircraft')
  @Permissions({ resource: 'aircraft', action: 'manage' })
  aircraft() {
    return this.catalog.listAircraft();
  }

  @Post('aircraft')
  @Permissions({ resource: 'aircraft', action: 'manage' })
  createAircraft(@Body() dto: CreateAircraftDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createAircraft(dto, user.userId);
  }

  @Patch('aircraft/:id')
  @Permissions({ resource: 'aircraft', action: 'manage' })
  updateAircraft(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAircraftDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateAircraft(id, dto, user.userId);
  }

  // ---------- Flights (SRS 5.2) ----------

  @Get('flights')
  @Permissions({ resource: 'flights', action: 'read' })
  flights() {
    return this.catalog.listFlights();
  }

  @Post('flights')
  @Permissions({ resource: 'flights', action: 'manage' })
  createFlight(@Body() dto: CreateFlightDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createFlight(dto, user.userId);
  }

  @Patch('flights/:id')
  @Permissions({ resource: 'flights', action: 'manage' })
  updateFlight(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlightDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateFlight(id, dto, user.userId);
  }

  @Post('flights/:id/segments')
  @Permissions({ resource: 'flights', action: 'manage' })
  addSegment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSegmentDto, @CurrentUser() user: AuthUser) {
    return this.catalog.addSegment(id, dto, user.userId);
  }

  @Post('flights/:id/fares')
  @Permissions({ resource: 'flights', action: 'manage' })
  addFare(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFareDto, @CurrentUser() user: AuthUser) {
    return this.catalog.addFare(id, dto, user.userId);
  }

  @Patch('fares/:id')
  @Permissions({ resource: 'flights', action: 'manage' })
  updateFare(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFareDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateFare(id, dto, user.userId);
  }

  @Delete('fares/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions({ resource: 'flights', action: 'manage' })
  async deleteFare(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.catalog.deleteFare(id, user.userId);
  }
}
