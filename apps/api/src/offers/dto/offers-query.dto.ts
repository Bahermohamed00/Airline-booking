import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { CabinClass } from '@prisma/client';

export class OffersQueryDto {
  @IsOptional()
  @IsEnum(CabinClass)
  cabin?: CabinClass;

  @IsOptional()
  @IsIn(['domestic', 'international'])
  scope?: 'domestic' | 'international';
}
