import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AUDIT_EVENTS } from '../audit-events.js';

export const AUDIT_ACTOR_TYPES = ['User', 'Staff', 'Guest', 'System'] as const;
export const AUDIT_SORT_FIELDS = ['createdAt', 'event'] as const;
export const AUDIT_SORT_ORDERS = ['asc', 'desc'] as const;
export const AUDIT_MAX_LIMIT = 100;

/** Query contract for GET /api/audit. Anything not listed here is rejected by the global whitelist pipe. */
export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_MAX_LIMIT)
  limit: number = 20;

  @IsOptional()
  @IsIn(AUDIT_EVENTS)
  event?: string;

  @IsOptional()
  @IsUUID('4')
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetId?: string;

  @IsOptional()
  @IsIn(AUDIT_ACTOR_TYPES)
  actorType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetType?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(AUDIT_SORT_FIELDS)
  sortBy?: 'createdAt' | 'event';

  @IsOptional()
  @IsIn(AUDIT_SORT_ORDERS)
  sortOrder?: 'asc' | 'desc';
}
