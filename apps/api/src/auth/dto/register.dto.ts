import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { NormalizeEmail, TrimString } from './transforms.js';

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
