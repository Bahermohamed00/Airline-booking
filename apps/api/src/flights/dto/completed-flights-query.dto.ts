import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

export const COMPLETED_FLIGHTS_MAX_LIMIT = 100;

/** Query contract for GET /api/admin/flights/completed. */
export class CompletedFlightsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMPLETED_FLIGHTS_MAX_LIMIT)
  limit: number = 20;

  /** Operating-date range start (yyyy-mm-dd). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'from must be a yyyy-mm-dd date' })
  from?: string;

  /** Operating-date range end (yyyy-mm-dd). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'to must be a yyyy-mm-dd date' })
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  flightNumber?: string;

  /** Free search: FL-xxxx public ID, NV flight number, or airport IATA code. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
