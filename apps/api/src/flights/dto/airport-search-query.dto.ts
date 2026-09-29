import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/dto-transforms.js';

export class AirportSearchQueryDto {
  @TrimString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
