import { ArrayNotEmpty, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ScheduleRuleStatus, Weekday } from '@prisma/client';
import { UppercaseString } from '../../auth/dto/transforms.js';
import { FLIGHT_NUMBER_PATTERN, ISO_DATE_PATTERN, LOCAL_TIME_PATTERN } from './create-schedule-rule.dto.js';

export class UpdateScheduleRuleDto {
  @IsOptional()
  @IsUUID('4')
  routeId?: string;

  @IsOptional()
  @IsUUID('4')
  aircraftId?: string;

  @IsOptional()
  @UppercaseString()
  @Matches(FLIGHT_NUMBER_PATTERN, { message: 'flightNumber must be NV followed by 3–4 digits (e.g. NV200)' })
  flightNumber?: string;

  @IsOptional()
  @Matches(LOCAL_TIME_PATTERN, { message: 'departureTimeLocal must be HH:mm (24h, origin-local)' })
  departureTimeLocal?: string;

  @IsOptional()
  @ArrayNotEmpty()
  @IsEnum(Weekday, { each: true })
  operatingDays?: Weekday[];

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'effectiveFrom must be a yyyy-mm-dd date' })
  effectiveFrom?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'effectiveTo must be a yyyy-mm-dd date' })
  effectiveTo?: string;

  @IsOptional()
  @IsEnum(ScheduleRuleStatus)
  status?: ScheduleRuleStatus;
}
