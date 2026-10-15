import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { TrimString } from './transforms.js';
import { STREET_ADDRESS_PATTERN } from './register.dto.js';

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

  /** Optional; an empty string clears the stored address (mirrors phone). */
  @IsOptional()
  @TrimString()
  @Matches(STREET_ADDRESS_PATTERN, { message: 'Invalid street address.' })
  streetAddress?: string;
}
