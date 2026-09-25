import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { TrimString } from './transforms.js';

/** Self-service profile update. Email change is intentionally not supported (deferred). */
export class UpdateProfileDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
