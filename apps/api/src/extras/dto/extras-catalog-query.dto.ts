import { IsEnum, IsUUID } from 'class-validator';
import { CabinClass } from '@prisma/client';

/**
 * Catalog query: extras eligible for a specific flight/cabin. Eligibility is
 * the fare currency of that cabin — extras are priced in the booking currency
 * so totals never mix currencies.
 */
export class ExtrasCatalogQueryDto {
  @IsUUID('4')
  flightId!: string;

  @IsEnum(CabinClass)
  cabinClass!: CabinClass;
}
