import { IsEmail } from 'class-validator';
import { NormalizeEmail } from './transforms.js';

export class EmailVerificationRequestDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
