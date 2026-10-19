import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CabinClass, DiscountType, OfferStatus } from '@prisma/client';
import { TrimString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';
import { OFFER_IMAGE_PATTERN } from './create-offer.dto.js';

export class UpdateOfferDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(10)
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(60)
  badge?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(120)
  destination?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(60)
  offerValue?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(600)
  terms?: string;

  @IsOptional()
  @TrimString()
  @Matches(OFFER_IMAGE_PATTERN, { message: 'imageUrl must be an assets/… path or an https:// URL' })
  imageUrl?: string;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'validFrom must be a yyyy-mm-dd date' })
  validFrom?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'validUntil must be a yyyy-mm-dd date' })
  validUntil?: string;

  // Explicit null clears the field (validated in the service); undefined keeps the existing value.
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsEnum(DiscountType)
  discountType?: DiscountType | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  discountValue?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('4')
  routeId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsEnum(CabinClass)
  cabinClass?: CabinClass | null;
}
