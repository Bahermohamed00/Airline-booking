import { IsString } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  code!: string;
}
