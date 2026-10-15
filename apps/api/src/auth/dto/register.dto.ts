import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { NormalizeEmail, TrimString } from './transforms.js';

/**
 * Reasonable phone shape: optional leading '+', then digits with optional
 * spaces, dashes, dots or parentheses — 6–20 characters in total. The
 * empty-string alternative lets IsNotEmpty report "Please enter your mobile
 * number." on its own instead of also failing the format check.
 */
export const PHONE_PATTERN = /^$|^\+?[0-9][0-9().\s-]{4,19}$/;

/**
 * Street address: 5–255 characters containing at least one letter or digit.
 * Same empty-alternative trick as PHONE_PATTERN.
 */
export const STREET_ADDRESS_PATTERN = /^$|^(?=.*[\p{L}\p{N}]).{5,255}$/u;

/**
 * Egyptian national ID: exactly 14 digits.
 * Same empty-alternative trick as PHONE_PATTERN.
 */
export const NATIONAL_ID_PATTERN = /^$|^\d{14}$/;

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

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

  /** ISO date (YYYY-MM-DD). The 18+ rule is enforced in AuthService.register. */
  @IsDateString()
  dateOfBirth!: string;

  @TrimString()
  @IsNotEmpty({ message: 'Please enter your mobile number.' })
  @Matches(PHONE_PATTERN, { message: 'Invalid mobile number.' })
  phone!: string;

  @TrimString()
  @IsNotEmpty({ message: 'Please enter your street address.' })
  @Matches(STREET_ADDRESS_PATTERN, { message: 'Invalid street address.' })
  streetAddress!: string;

  @TrimString()
  @IsNotEmpty({ message: 'Please enter your national ID.' })
  @Matches(NATIONAL_ID_PATTERN, { message: 'National ID must be exactly 14 digits.' })
  nationalId!: string;
}
