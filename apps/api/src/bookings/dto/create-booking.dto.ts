import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CabinClass, PassengerType } from '@prisma/client';
import { NormalizeEmail, TrimString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';
import { ExtraSelectionDto, MAX_EXTRA_SELECTIONS } from '../../extras/dto/extra-selection.dto.js';

import { MAX_BOOKING_PASSENGERS } from './booking-limits.js';

export { MAX_BOOKING_PASSENGERS };

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

  /**
   * BR-16: optional bookable offer (one per booking). The client sends only
   * the offer id — the server validates eligibility and computes the discount
   * (fare basePrice only) from the DB offer row.
   */
  @IsOptional()
  @IsUUID('4')
  offerId?: string;

  /**
   * Optional purchasable extras. The client sends service ids, quantities and
   * passenger associations only — eligibility, quantities and prices are
   * validated and computed server-side from the catalog inside the creation
   * transaction, and each line is snapshotted onto the booking.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EXTRA_SELECTIONS)
  @ValidateNested({ each: true })
  @Type(() => ExtraSelectionDto)
  extras?: ExtraSelectionDto[];

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;
}
