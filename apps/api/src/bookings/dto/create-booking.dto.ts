import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CabinClass, PassengerType } from '@prisma/client';
import { NormalizeEmail, TrimString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

/**
 * Maximum passengers (and therefore seats) per booking. Matches the standard
 * airline single-PNR limit; larger groups must book in multiple bookings.
 */
export const MAX_BOOKING_PASSENGERS = 9;

export class BookingPassengerDto {
  @IsOptional()
  @IsEnum(PassengerType)
  passengerType?: PassengerType;

  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'dateOfBirth must be a yyyy-mm-dd date' })
  dateOfBirth?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @TrimString()
  @Matches(/^[A-Za-z0-9]{6,12}$/, { message: 'passportNumber must be 6–12 letters or digits' })
  passportNumber?: string;
}

export class CreateBookingDto {
  /**
   * Client-generated idempotency key (UUID v4). Identical retries must reuse it
   * — the server replays the original booking; reusing it with a different
   * request is rejected with 409. Never used as identity or booking reference.
   */
  @IsUUID('4')
  idempotencyKey!: string;

  @IsUUID('4')
  flightId!: string;

  @IsEnum(CabinClass)
  cabinClass!: CabinClass;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BOOKING_PASSENGERS)
  @IsUUID('4', { each: true })
  seatIds!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BOOKING_PASSENGERS)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers!: BookingPassengerDto[];

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;
}
