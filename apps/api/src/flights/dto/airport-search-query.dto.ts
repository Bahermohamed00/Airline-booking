import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class AirportSearchQueryDto {
  @TrimString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
