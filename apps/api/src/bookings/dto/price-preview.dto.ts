import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CabinClass } from '@prisma/client';
import { MAX_BOOKING_PASSENGERS } from './booking-limits.js';
import { ExtraSelectionDto, MAX_EXTRA_SELECTIONS } from '../../extras/dto/extra-selection.dto.js';

/**
 * BR-16: read-only price preview — same inputs as pricing-relevant booking
 * creation, but no seats/passengers and no writes. The client never sends
 * discount or totals; everything is computed server-side from the DB fare
 * and the (optional) bookable offer.
 */
export class PricePreviewDto {
  @IsUUID('4')
  flightId!: string;

  @IsEnum(CabinClass)
  cabinClass!: CabinClass;

  @IsInt()
  @Min(1)
  @Max(MAX_BOOKING_PASSENGERS)
  passengerCount!: number;

  @IsOptional()
  @IsUUID('4')
  offerId?: string;

  /**
   * Optional extras to include in the preview — validated and priced
   * server-side exactly like at booking creation, so the preview total stays
   * the authoritative figure the customer confirms.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EXTRA_SELECTIONS)
  @ValidateNested({ each: true })
  @Type(() => ExtraSelectionDto)
  extras?: ExtraSelectionDto[];
}
