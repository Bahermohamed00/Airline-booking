import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class RejectCancellationRequestDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
