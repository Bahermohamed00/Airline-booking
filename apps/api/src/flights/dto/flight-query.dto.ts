import { IsOptional, Matches } from 'class-validator';
import { UppercaseString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

export class FlightQueryDto {
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
}
