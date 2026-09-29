import { ArrayNotEmpty, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ScheduleRuleStatus, Weekday } from '@prisma/client';
import { UppercaseString } from '../../auth/dto/transforms.js';

export const FLIGHT_NUMBER_PATTERN = /^NV\d{3,4}$/;
export const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateScheduleRuleDto {
  @IsUUID('4')
  routeId!: string;

  @IsUUID('4')
  aircraftId!: string;

  @UppercaseString()
  @Matches(FLIGHT_NUMBER_PATTERN, { message: 'flightNumber must be NV followed by 3–4 digits (e.g. NV200)' })
  flightNumber!: string;

  @Matches(LOCAL_TIME_PATTERN, { message: 'departureTimeLocal must be HH:mm (24h, origin-local)' })
  departureTimeLocal!: string;

  @ArrayNotEmpty()
  @IsEnum(Weekday, { each: true })
  operatingDays!: Weekday[];

  @Matches(ISO_DATE_PATTERN, { message: 'effectiveFrom must be a yyyy-mm-dd date' })
  effectiveFrom!: string;

  @Matches(ISO_DATE_PATTERN, { message: 'effectiveTo must be a yyyy-mm-dd date' })
  effectiveTo!: string;

  @IsOptional()
  @IsEnum(ScheduleRuleStatus)
  status?: ScheduleRuleStatus;
}
