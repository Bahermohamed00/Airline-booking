import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { ExtraPricingUnit, ExtraServiceCategory, ExtraServiceStatus } from '@prisma/client';
import { TrimString } from '../../auth/dto/transforms.js';
import { CURRENCY_PATTERN, MAX_EXTRA_PRICE, MAX_EXTRA_QUANTITY } from './create-extra-service.dto.js';

/**
 * Staff catalog update. `code` is immutable: booking lines reference services
 * by id and snapshot the code, so a stable code keeps historical records
 * meaningful. The same category/metadata rules as creation apply on update.
 */
export class UpdateExtraServiceDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_EXTRA_PRICE)
  price?: number;

  @IsOptional()
  @Matches(CURRENCY_PATTERN, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsEnum(ExtraServiceCategory)
  category?: ExtraServiceCategory;

  @IsOptional()
  @IsEnum(ExtraServiceStatus)
  status?: ExtraServiceStatus;

  @IsOptional()
  @IsEnum(ExtraPricingUnit)
  pricingUnit?: ExtraPricingUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_EXTRA_QUANTITY)
  maxQuantity?: number;

  @IsOptional()
  @IsBoolean()
  requiresPassenger?: boolean;

  /** Null clears the bound. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  validFrom?: string | null;

  /** Null clears the bound. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  validTo?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
