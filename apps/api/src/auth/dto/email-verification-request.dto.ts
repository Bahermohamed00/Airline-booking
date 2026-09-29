import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../common/dto-transforms.js';

export class EmailVerificationRequestDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
