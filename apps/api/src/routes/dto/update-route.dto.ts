import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RouteStatus } from '@prisma/client';

export class UpdateRouteDto {
  @IsOptional()
  @IsUUID('4')
  originAirportId?: string;

  @IsOptional()
  @IsUUID('4')
  destinationAirportId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25000)
  distanceKm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3000)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;
}
