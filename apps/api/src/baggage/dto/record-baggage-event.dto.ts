import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { BaggageStatus } from '@prisma/client';

export class RecordBaggageEventDto {
  @IsEnum(BaggageStatus)
  eventType!: BaggageStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location!: string;
}
