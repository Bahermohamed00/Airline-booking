import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';
import { CabinClass } from '@prisma/client';
import { UppercaseIata } from './destinations-query.dto.js';

export class FlightSearchQueryDto {
  @UppercaseIata()
  @Matches(/^[A-Z]{3}$/, { message: 'from must be a 3-letter IATA code' })
  from!: string;

  @UppercaseIata()
  @Matches(/^[A-Z]{3}$/, { message: 'to must be a 3-letter IATA code' })
  to!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(CabinClass)
  cabin?: CabinClass;
}
