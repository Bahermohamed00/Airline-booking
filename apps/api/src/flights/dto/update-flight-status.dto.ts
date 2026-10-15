import { IsEnum } from 'class-validator';
import { FlightStatus } from '@prisma/client';

export class UpdateFlightStatusDto {
  @IsEnum(FlightStatus)
  status!: FlightStatus;
}
