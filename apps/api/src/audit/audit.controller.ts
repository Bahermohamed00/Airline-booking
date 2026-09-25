import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuditService, type AuditQueryResult } from './audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

/**
 * Read-only audit query API. Access is permission-driven: `audit:read` (with
 * the existing Super Admin bypass in PermissionsGuard). No Roles metadata on
 * purpose — the permission catalog is the single source of truth, and any role
 * granted `audit:read` must pass regardless of its display name.
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @Permissions({ resource: 'audit', action: 'read' })
  findAll(@Query() query: AuditQueryDto): Promise<AuditQueryResult> {
    return this.auditService.query(query);
  }
}
