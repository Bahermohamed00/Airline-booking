import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class ConfirmExceptionDto {
  /** BR-14: the exception workflow always requires a human-written justification. */
  @TrimString()
  @IsString()
  @MinLength(10, { message: 'reason must be at least 10 characters' })
  @MaxLength(500)
  reason!: string;
}
