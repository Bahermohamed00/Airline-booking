import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { RoutesService, type RouteView } from './routes.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RoutesController {
  constructor(@Inject(RoutesService) private readonly routes: RoutesService) {}

  @Get()
  @Public()
  findAll(): Promise<RouteView[]> {
    return this.routes.findAll();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RouteView> {
    return this.routes.findOne(id);
  }

  @Post()
  @Permissions({ resource: 'routes', action: 'manage' })
  create(@Body() dto: CreateRouteDto, @CurrentUser() actor: AuthUser): Promise<RouteView> {
    return this.routes.create(dto, actor);
  }

  @Patch(':id')
  @Permissions({ resource: 'routes', action: 'manage' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<RouteView> {
    return this.routes.update(id, dto, actor);
  }
}
