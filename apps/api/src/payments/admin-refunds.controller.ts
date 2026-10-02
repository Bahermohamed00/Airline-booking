import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { PaymentsService } from './payments.service.js';
import { AdminRefundQueryDto } from './dto/admin-refund-query.dto.js';

@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminRefundsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  @Permissions({ resource: 'payments', action: 'read' })
  findAll(@Query() query: AdminRefundQueryDto) {
    return this.payments.findRefundsAdmin(query);
  }
}
