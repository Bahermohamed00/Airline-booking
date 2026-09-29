import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BookingStatus } from '@prisma/client';
import { TrimString } from '../../auth/dto/transforms.js';

export class AdminBookingQueryDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,10}$/, { message: 'reference must be 4–10 letters or digits' })
  reference?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(255)
  email?: string;
}
