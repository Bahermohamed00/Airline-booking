import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsObject, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ExtraPricingUnit, ExtraServiceCategory } from '@prisma/client';
import { TrimString } from '../../auth/dto/transforms.js';

export const EXTRA_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_]{2,49}$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
/** Reasonable upper bound for any catalog unit price. */
export const MAX_EXTRA_PRICE = 100000;
export const MAX_EXTRA_QUANTITY = 99;

/**
 * Staff catalog creation. Category-specific metadata rules are enforced by
 * ExtrasService (e.g. BAGGAGE requires metadata.bagWeightKg; INSURANCE is only
 * creatable as an explicitly-flagged demonstration product while no insurer
 * integration exists).
 */
export class CreateExtraServiceDto {
  @TrimString()
  @Matches(EXTRA_CODE_PATTERN, { message: 'code must be 3–50 uppercase letters, digits or underscores' })
  code!: string;

  @TrimString()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_EXTRA_PRICE)
  price!: number;

  @Matches(CURRENCY_PATTERN, { message: 'currency must be a 3-letter ISO code' })
  currency!: string;

  @IsEnum(ExtraServiceCategory)
  category!: ExtraServiceCategory;

  @IsEnum(ExtraPricingUnit)
  pricingUnit!: ExtraPricingUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_EXTRA_QUANTITY)
  maxQuantity?: number;

  @IsOptional()
  @IsBoolean()
  requiresPassenger?: boolean;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
