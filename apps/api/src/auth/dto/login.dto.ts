import { IsEmail, IsString, IsOptional } from 'class-validator';
import { NormalizeEmail } from './transforms.js';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}
