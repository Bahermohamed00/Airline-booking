import { IsEmail } from 'class-validator';
import { NormalizeEmail } from './transforms.js';

export class PasswordResetRequestDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
