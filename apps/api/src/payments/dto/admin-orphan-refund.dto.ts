import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrphanRefundStatus } from '@prisma/client';
import { ADMIN_REFUND_MAX_LIMIT } from './admin-refund-query.dto.js';

/** Query contract for GET /api/admin/refunds/orphans (Phase 3.4E). */
export class AdminOrphanRefundQueryDto {
  @IsOptional()
  @IsEnum(OrphanRefundStatus)
  status?: OrphanRefundStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_REFUND_MAX_LIMIT)
  limit: number = 20;
}

/** Body for POST /api/admin/refunds/orphans/:id/resolve (Phase 3.4E). */
export class ResolveOrphanRefundDto {
  /** Investigation outcome, recorded on the orphan row (never audited raw). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
