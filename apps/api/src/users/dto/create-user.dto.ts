import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { NormalizeEmail, TrimString } from '../../auth/dto/transforms.js';

export class CreateUserDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(100)
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

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
