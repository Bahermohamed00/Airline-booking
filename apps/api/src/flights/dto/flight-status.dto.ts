import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

export class StatusByNumberDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{2,10}$/)
  flightNumber!: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class StatusByRouteDto {
  @IsString()
  @Length(3, 3)
  origin!: string;

  @IsString()
  @Length(3, 3)
  destination!: string;
}
