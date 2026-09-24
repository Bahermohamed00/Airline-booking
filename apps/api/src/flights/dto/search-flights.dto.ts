import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export enum TripType {
  ONE_WAY = 'ONE_WAY',
  ROUND_TRIP = 'ROUND_TRIP',
  MULTI_CITY = 'MULTI_CITY',
}

export enum CabinClassDto {
  ECONOMY = 'ECONOMY',
  PREMIUM_ECONOMY = 'PREMIUM_ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export enum ResultSortDto {
  RECOMMENDED = 'recommended',
  PRICE = 'price',
  DURATION = 'duration',
  DEPARTURE = 'departure',
}

export class SearchFlightsDto {
  @IsEnum(TripType)
  tripType!: TripType;

  @IsString()
  @Length(3, 3)
  origin!: string;

  @IsString()
  @Length(3, 3)
  destination!: string;

  @IsDateString()
  depart!: string;

  @IsOptional()
  @IsDateString()
  return?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  adults!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  children!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  infants!: number;

  @IsEnum(CabinClassDto)
  cabin!: CabinClassDto;

  @IsOptional()
  @IsString()
  promo?: string;

  // ---- Optional result filters / sort (FR-C06) ----

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['morning', 'afternoon', 'evening'])
  departureWindow?: 'morning' | 'afternoon' | 'evening';

  @IsOptional()
  @IsIn(['true', 'false'])
  refundableOnly?: string;

  @IsOptional()
  @IsIn(['any', 'nonstop'])
  stops?: 'any' | 'nonstop';

  @IsOptional()
  @IsEnum(ResultSortDto)
  sort?: ResultSortDto;
}

export class AirportQueryDto {
  @IsOptional()
  @IsString()
  query?: string;
}
