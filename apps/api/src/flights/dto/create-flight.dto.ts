import { IsEnum, IsNumber, IsOptional, IsUUID, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TripType } from '@prisma/client';
import { UppercaseString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN, LOCAL_TIME_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

/** Business-facing flight number: NV followed by one or more digits (NV100, NV720, NV901). */
export const MANUAL_FLIGHT_NUMBER_PATTERN = /^NV\d+$/;

/**
 * Explicit single-flight creation by the Flight Manager. Times are wall-clock
 * at the respective airports: departure is origin-local, arrival is
 * destination-local (converted to UTC instants server-side, same convention as
 * the schedule-rule generator). Airports are always derived from the route.
 * The flight number is required and normalized to uppercase — the same format
 * as schedule-rule-generated flights.
 */
export class CreateFlightDto {
  @IsUUID('4')
  routeId!: string;

  @IsUUID('4')
  aircraftId!: string;

  @Matches(ISO_DATE_PATTERN, { message: 'departureDate must be a yyyy-mm-dd date' })
  departureDate!: string;

  @Matches(LOCAL_TIME_PATTERN, { message: 'departureTime must be HH:mm (24h, origin-local)' })
  departureTime!: string;

  @Matches(ISO_DATE_PATTERN, { message: 'arrivalDate must be a yyyy-mm-dd date' })
  arrivalDate!: string;

  @Matches(LOCAL_TIME_PATTERN, { message: 'arrivalTime must be HH:mm (24h, destination-local)' })
  arrivalTime!: string;

  /** Economy base price (positive monetary value, max 2 decimals). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'price must be a monetary amount with at most 2 decimals' })
  @Min(0.01, { message: 'price must be a positive amount' })
  price!: number;

  @UppercaseString()
  @Matches(MANUAL_FLIGHT_NUMBER_PATTERN, { message: 'flightNumber must be NV followed by digits (e.g. NV900)' })
  flightNumber!: string;

  /** Schedule attribute: one-way or out-and-back. Defaults to ONE_WAY. */
  @IsOptional()
  @IsEnum(TripType)
  tripType?: TripType;
}
