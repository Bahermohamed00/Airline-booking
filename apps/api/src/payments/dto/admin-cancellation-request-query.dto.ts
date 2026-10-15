import { IsEnum, IsOptional } from 'class-validator';
import { CancellationRequestStatus } from '@prisma/client';

export class AdminCancellationRequestQueryDto {
  @IsOptional()
  @IsEnum(CancellationRequestStatus)
  status?: CancellationRequestStatus;
}
