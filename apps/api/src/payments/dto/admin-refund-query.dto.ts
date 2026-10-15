import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RefundStatus } from '@prisma/client';

export const ADMIN_REFUND_MAX_LIMIT = 100;

/**
 * Server-side filters for GET /api/admin/refunds (all optional, combined).
 * Pending-age filters (minutes) only make sense for PENDING refunds and force
 * status=PENDING when present. Pagination follows the audit-module convention.
 */
export class AdminRefundQueryDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsUUID('4')
  bookingId?: string;

  @IsOptional()
  @IsUUID('4')
  paymentId?: string;

  @IsOptional()
  @IsUUID('4')
  refundId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bookingReference?: string;

  /** Matches the refund's provider reference (re_…) OR the payment's (pi_…). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerReference?: string;

  /** createdAt range (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Only refunds PENDING for at least this many minutes. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingMinAgeMinutes?: number;

  /** Only refunds PENDING for at most this many minutes. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingMaxAgeMinutes?: number;

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
