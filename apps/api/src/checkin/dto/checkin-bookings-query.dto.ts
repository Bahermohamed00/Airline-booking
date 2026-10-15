import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail, TrimString } from '../../auth/dto/transforms.js';

/**
 * Check-in booking lookup: exactly one of `reference` or `email` must be
 * supplied — the XOR itself is enforced by CheckinService (400).
 */
export class CheckinBookingsQueryDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(10)
  reference?: string;

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;
}
