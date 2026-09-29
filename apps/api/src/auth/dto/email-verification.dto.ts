import { IsString, MinLength } from 'class-validator';

export class EmailVerificationDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
