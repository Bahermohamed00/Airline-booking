import { IsBooleanString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FlightStatus } from '@prisma/client';
import { UppercaseString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

export const FLIGHTS_MAX_LIMIT = 100;

export class FlightQueryDto {
  /** Exact flight ID (UUID v4, the project's single ID format). */
  @IsOptional()
  @IsUUID('4')
  id?: string;

  /** Partial, case-insensitive flight-number match. */
  @IsOptional()
  @UppercaseString()
  @IsString()
  @MaxLength(20)
  flightNumber?: string;

  @IsOptional()
  @UppercaseString()
  @Matches(/^[A-Z]{3}$/, { message: 'origin must be a 3-letter IATA code' })
  origin?: string;

  @IsOptional()
  @UppercaseString()
  @Matches(/^[A-Z]{3}$/, { message: 'destination must be a 3-letter IATA code' })
  destination?: string;

  /** Exact operating date (yyyy-mm-dd, origin-local). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'date must be a yyyy-mm-dd date' })
  date?: string;

  /** Operating-date range start (yyyy-mm-dd). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'from must be a yyyy-mm-dd date' })
  from?: string;

  /** Operating-date range end (yyyy-mm-dd). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'to must be a yyyy-mm-dd date' })
  to?: string;

  /** Opt-in lifecycle-status filter; omitted returns every status (unchanged default). */
  @IsOptional()
  @IsEnum(FlightStatus)
  status?: FlightStatus;

  /** "true" = operational view: COMPLETED flights excluded (they live in the Completed Flights section). */
  @IsOptional()
  @IsBooleanString()
  excludeCompleted?: string;

  /**
   * Opt-in pagination. No defaults here: when BOTH are absent the endpoint
   * keeps returning the legacy bare array. Defaults (page=1, limit=20) are
   * applied in FlightsService.findAll once pagination is requested.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FLIGHTS_MAX_LIMIT)
  limit?: number;
}
