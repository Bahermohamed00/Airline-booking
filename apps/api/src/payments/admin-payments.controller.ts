import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminPaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  @Permissions({ resource: 'payments', action: 'read' })
  findAll(@Query() query: AdminPaymentQueryDto) {
    return this.payments.findAllAdmin(query);
  }

  @Get(':id')
  @Permissions({ resource: 'payments', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.findOneAdmin(id);
  }

  @Post(':id/refund')
  @Permissions({ resource: 'payments', action: 'refund' })
  refund(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() staff: AuthUser, @Body() dto: RefundPaymentDto) {
    return this.payments.refundPayment(staff, id, dto);
  }
}
