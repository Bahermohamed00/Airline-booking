import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExtrasService, type ExtraCatalogView } from './extras.service.js';
import { CreateExtraServiceDto } from './dto/create-extra-service.dto.js';
import { UpdateExtraServiceDto } from './dto/update-extra-service.dto.js';
import { AdminExtrasQueryDto } from './dto/admin-extras-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

/**
 * Staff catalog management for bookable extras. Every write is permission
 * gated (extras:manage) and audited; deletion is lifecycle-based (INACTIVE)
 * because booking lines hold RESTRICT references for historical accounting.
 */
@Controller('admin/extras')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminExtrasController {
  constructor(@Inject(ExtrasService) private readonly extras: ExtrasService) {}

  @Get()
  @Permissions({ resource: 'extras', action: 'read' })
  findAll(@Query() query: AdminExtrasQueryDto): Promise<ExtraCatalogView[]> {
    return this.extras.findAllAdmin(query);
  }

  @Get(':id')
  @Permissions({ resource: 'extras', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ExtraCatalogView> {
    return this.extras.findOneAdmin(id);
  }

  @Post()
  @Permissions({ resource: 'extras', action: 'manage' })
  create(@Body() dto: CreateExtraServiceDto, @CurrentUser() actor: AuthUser): Promise<ExtraCatalogView> {
    return this.extras.create(dto, actor);
  }

  @Patch(':id')
  @Permissions({ resource: 'extras', action: 'manage' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExtraServiceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ExtraCatalogView> {
    return this.extras.update(id, dto, actor);
  }

  /** Lifecycle-based removal: deactivates the service (never a hard delete). */
  @Delete(':id')
  @Permissions({ resource: 'extras', action: 'manage' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser): Promise<ExtraCatalogView> {
    return this.extras.deactivate(id, actor);
  }
}
