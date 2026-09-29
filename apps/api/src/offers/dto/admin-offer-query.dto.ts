import { IsEnum, IsOptional } from 'class-validator';
import { OfferStatus } from '@prisma/client';

export class AdminOfferQueryDto {
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
