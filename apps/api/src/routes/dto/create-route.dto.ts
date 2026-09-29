import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateRouteDto {
  @IsUUID('4')
  originAirportId!: string;

  @IsUUID('4')
  destinationAirportId!: string;

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
}
