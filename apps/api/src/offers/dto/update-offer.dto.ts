import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OfferStatus } from '@prisma/client';
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
}
