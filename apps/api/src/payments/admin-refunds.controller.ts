import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { AdminRefundQueryDto } from './dto/admin-refund-query.dto.js';
import {
  AdminOrphanRefundQueryDto,
  ResolveOrphanRefundDto,
} from './dto/admin-orphan-refund.dto.js';

@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminRefundsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  @Permissions({ resource: 'payments', action: 'read' })
  findAll(@Query() query: AdminRefundQueryDto) {
    return this.payments.findRefundsAdmin(query);
  }

  /**
   * Live operational snapshot (Phase 3.4D/3.4F): pending aging buckets, stuck
   * count, unmatched orphans, in-process metrics and active alert conditions.
   */
  @Get('operations')
  @Permissions({ resource: 'payments', action: 'read' })
  operations() {
    return this.payments.getRefundOperations();
  }

  /** Unmatched provider refunds discovered by orphan discovery (Phase 3.4E). */
  @Get('orphans')
  @Permissions({ resource: 'payments', action: 'read' })
  orphans(@Query() query: AdminOrphanRefundQueryDto) {
    return this.payments.findOrphanRefundsAdmin(query);
  }

  /**
   * Marks an investigated orphan provider refund RESOLVED (Phase 3.4E). An
   * operational decision record only — never touches the provider, never
   * creates a refund; audited with the staff identity.
   */
  @Post('orphans/:id/resolve')
  @Permissions({ resource: 'payments', action: 'refund' })
  resolveOrphan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() staff: AuthUser,
    @Body() dto: ResolveOrphanRefundDto,
  ) {
    return this.payments.resolveOrphanRefund(staff, id, dto.note);
  }

  /**
   * Resumes a stuck PENDING refund (provider may already have moved the money
   * while the local completion was lost). Idempotent: replays the original
   * provider call with the persisted row's idempotency key, so it never
   * creates a second refund at the provider.
   */
  @Post(':id/resume')
  @Permissions({ resource: 'payments', action: 'refund' })
  resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() staff: AuthUser) {
    return this.payments.resumeRefund(staff, id);
  }
}
