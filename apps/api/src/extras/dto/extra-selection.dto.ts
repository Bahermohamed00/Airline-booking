import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_BOOKING_PASSENGERS } from '../../bookings/dto/booking-limits.js';

/**
 * One selected extra in a booking/quote request. The client identifies the
 * catalog service and quantity only — prices, eligibility and passenger
 * associations are validated and priced server-side from the database.
 *
 * passengerIndex refers to the passengers array of the booking (0-based) and
 * is required when the service is passenger-associated (requiresPassenger or
 * PER_PASSENGER pricing); it must be absent for PER_BOOKING services.
 */
export class ExtraSelectionDto {
  @IsUUID('4')
  serviceId!: string;

  // Hard sanity cap only — the real limit is the service's maxQuantity,
  // enforced by ExtrasService against the catalog row.
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BOOKING_PASSENGERS - 1)
  passengerIndex?: number;
}

/** Bound on selections per request: at most one line per passenger per service. */
export const MAX_EXTRA_SELECTIONS = 50;

export class ExtraSelectionsDto {
  @IsArray()
  @ArrayMaxSize(MAX_EXTRA_SELECTIONS)
  @ValidateNested({ each: true })
  @Type(() => ExtraSelectionDto)
  selections!: ExtraSelectionDto[];
}
