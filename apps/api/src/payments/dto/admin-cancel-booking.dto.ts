import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class AdminCancelBookingDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
