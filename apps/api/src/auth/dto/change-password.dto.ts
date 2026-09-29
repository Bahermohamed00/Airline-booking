import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  // Same policy as registration (RegisterDto)
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  confirmPassword!: string;
}
