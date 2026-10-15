import { IsEnum, IsOptional } from 'class-validator';
import { ExtraServiceCategory, ExtraServiceStatus } from '@prisma/client';

/** Server-side filters for GET /api/admin/extras (all optional, combined). */
export class AdminExtrasQueryDto {
  @IsOptional()
  @IsEnum(ExtraServiceStatus)
  status?: ExtraServiceStatus;

  @IsOptional()
  @IsEnum(ExtraServiceCategory)
  category?: ExtraServiceCategory;
}
