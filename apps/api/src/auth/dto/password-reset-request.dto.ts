import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../common/dto-transforms.js';

export class PasswordResetRequestDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
