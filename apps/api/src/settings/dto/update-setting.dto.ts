import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  value!: string;
}
