import { IsEnum, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AirportStatus } from '@prisma/client';
import { TrimString, UppercaseString } from '../../auth/dto/transforms.js';

export class UpdateAirportDto {
  @IsOptional()
  @UppercaseString()
  @Matches(/^[A-Z]{3}$/, { message: 'iataCode must be exactly 3 uppercase letters' })
  iataCode?: string;

  @IsOptional()
  @UppercaseString()
  @Matches(/^[A-Z]{4}$/, { message: 'icaoCode must be exactly 4 uppercase letters' })
  icaoCode?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsEnum(AirportStatus)
  status?: AirportStatus;
}
