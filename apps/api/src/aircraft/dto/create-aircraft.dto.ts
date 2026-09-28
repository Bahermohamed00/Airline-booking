import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AircraftStatus } from '@prisma/client';
import { TrimString, UppercaseString } from '../../auth/dto/transforms.js';

export class CreateAircraftDto {
  @UppercaseString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{2,19}$/, { message: 'registration must be 3–20 uppercase letters, digits or dashes' })
  registration!: string;

  @TrimString()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  model!: string;

  @IsInt()
  @Min(6)
  @Max(600)
  capacity!: number;

  @IsOptional()
  @IsEnum(AircraftStatus)
  status?: AircraftStatus;
}
