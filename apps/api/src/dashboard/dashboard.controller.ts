import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { DashboardQueryDto } from './dto/dashboard-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

/** Staff operations dashboard, backed by the dashboard:read permission. */
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get()
  @Permissions({ resource: 'dashboard', action: 'read' })
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.dashboard.getDashboard(query);
  }
}
