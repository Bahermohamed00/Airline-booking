import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { RolesService, type RoleView } from './roles.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RolesController {
  constructor(@Inject(RolesService) private readonly rolesService: RolesService) {}

  @Get()
  @Roles('Super Admin')
  @Permissions({ resource: 'roles', action: 'manage' })
  findAll(): Promise<RoleView[]> {
    return this.rolesService.findAllWithPermissions();
  }
}
