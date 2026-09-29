import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TrimString } from '../../common/dto-transforms.js';

export function UppercaseIata() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));
}

export class DestinationsQueryDto {
  @UppercaseIata()
  @Matches(/^[A-Z]{3}$/, { message: 'from must be a 3-letter IATA code' })
  from!: string;

  @TrimString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
