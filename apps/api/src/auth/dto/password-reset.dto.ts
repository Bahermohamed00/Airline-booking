import { IsString, MinLength, MaxLength } from 'class-validator';

export class PasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}
