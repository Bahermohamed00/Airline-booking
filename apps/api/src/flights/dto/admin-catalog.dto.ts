import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  IsUUID, Length, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import { CabinClassDto } from './search-flights.dto.js';

// ---------- Airport ----------

export class CreateAirportDto {
  @IsString() @Length(3, 3) @Matches(/^[A-Z]{3}$/)
  iataCode!: string;

  @IsOptional() @IsString() @Length(4, 4) @Matches(/^[A-Z]{4}$/)
  icaoCode?: string;

  @IsString() name!: string;
  @IsString() city!: string;
  @IsString() country!: string;
  @IsString() timezone!: string;
}

export class UpdateAirportDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE'] as const) status?: 'ACTIVE' | 'INACTIVE';
}

// ---------- Route ----------

export class CreateRouteDto {
  @IsUUID('4') originAirportId!: string;
  @IsUUID('4') destinationAirportId!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  distanceKm?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  durationMinutes?: number;
}

export class UpdateRouteDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) distanceKm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) durationMinutes?: number;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE'] as const) status?: 'ACTIVE' | 'INACTIVE';
}

// ---------- Aircraft ----------

export class CreateAircraftDto {
  @IsString() registration!: string;
  @IsString() model!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(900)
  capacity!: number;
}

export class UpdateAircraftDto {
  @IsOptional() @IsString() model?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(900) capacity?: number;
  @IsOptional() @IsEnum(['ACTIVE', 'MAINTENANCE', 'RETIRED'] as const) status?: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
}

// ---------- Flight segment ----------

export class CreateSegmentDto {
  @Type(() => Number) @IsInt() @Min(1)
  segmentNumber!: number;

  @IsUUID('4') originAirportId!: string;
  @IsUUID('4') destinationAirportId!: string;

  @IsDateString() departureTime!: string;
  @IsDateString() arrivalTime!: string;
}

// ---------- Fare ----------

export class CreateFareDto {
  @IsEnum(CabinClassDto) cabinClass!: CabinClassDto;

  @Type(() => Number) @IsNumber() @Min(0) basePrice!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) feeAmount?: number;

  @IsString() @Length(3, 3) currency!: string;

  @Type(() => Number) @IsInt() @Min(0) availableCount!: number;
}

export class UpdateFareDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) basePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) feeAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) availableCount?: number;
}

// ---------- Flight ----------

export class CreateFlightDto {
  @IsString() @Matches(/^[A-Z0-9]{2,10}$/)
  flightNumber!: string;

  @IsUUID('4') routeId!: string;
  @IsUUID('4') aircraftId!: string;

  @IsDateString() departureTime!: string;
  @IsDateString() arrivalTime!: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateSegmentDto)
  segments?: CreateSegmentDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateFareDto)
  fares?: CreateFareDto[];
}

export class UpdateFlightDto {
  @IsOptional() @IsDateString() departureTime?: string;
  @IsOptional() @IsDateString() arrivalTime?: string;
  @IsOptional() @IsUUID('4') aircraftId?: string;
  @IsOptional() @IsEnum(['SCHEDULED', 'ACTIVE', 'DELAYED', 'CANCELLED', 'COMPLETED'] as const)
  status?: 'SCHEDULED' | 'ACTIVE' | 'DELAYED' | 'CANCELLED' | 'COMPLETED';
}
