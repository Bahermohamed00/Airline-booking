import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CabinClass } from '@prisma/client';
import { MAX_BOOKING_PASSENGERS } from '../../bookings/dto/booking-limits.js';
import { ExtraSelectionDto, MAX_EXTRA_SELECTIONS } from './extra-selection.dto.js';

/**
 * Read-only quote for a set of extra selections against a flight/cabin. Same
 * validation and pricing as booking creation, but writes nothing.
 */
export class ExtrasQuoteDto {
  @IsUUID('4')
  flightId!: string;

  @IsEnum(CabinClass)
  cabinClass!: CabinClass;

  @IsInt()
  @Min(1)
  @Max(MAX_BOOKING_PASSENGERS)
  passengerCount!: number;

  @IsArray()
  @ArrayMaxSize(MAX_EXTRA_SELECTIONS)
  @ValidateNested({ each: true })
  @Type(() => ExtraSelectionDto)
  selections!: ExtraSelectionDto[];
}
