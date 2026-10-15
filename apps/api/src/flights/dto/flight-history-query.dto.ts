import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TrimString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

export const FLIGHT_HISTORY_MAX_LIMIT = 100;
export const HISTORY_DOMAINS = ['flights', 'airports', 'aircraft', 'routes'] as const;
export type HistoryDomain = (typeof HISTORY_DOMAINS)[number];

/** Query contract for GET /api/admin/flights/history. */
export class FlightHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FLIGHT_HISTORY_MAX_LIMIT)
  limit: number = 20;

  /** Single audit event name (e.g. FLIGHT_CREATED), or omit for all. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  event?: string;

  /** Domain shortcut: flights | airports | aircraft | routes. */
  @IsOptional()
  @IsIn(HISTORY_DOMAINS)
  domain?: HistoryDomain;

  @IsOptional()
  @IsIn(['User', 'Staff', 'System', 'Guest'])
  actorType?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'from must be a yyyy-mm-dd date' })
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'to must be a yyyy-mm-dd date' })
  to?: string;
}
