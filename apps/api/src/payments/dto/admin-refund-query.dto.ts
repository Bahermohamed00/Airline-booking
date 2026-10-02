import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RefundStatus } from '@prisma/client';

/** Server-side filters for GET /api/admin/refunds (all optional, combined). */
export class AdminRefundQueryDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsUUID('4')
  bookingId?: string;
}
