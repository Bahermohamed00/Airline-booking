import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AircraftStatus } from '@prisma/client';
import { TrimString, UppercaseString } from '../../auth/dto/transforms.js';

export class UpdateAircraftDto {
  @IsOptional()
  @UppercaseString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{2,19}$/, { message: 'registration must be 3–20 uppercase letters, digits or dashes' })
  registration?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsEnum(AircraftStatus)
  status?: AircraftStatus;
}
