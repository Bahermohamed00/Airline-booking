import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class CreateTicketDto {
  @TrimString()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @TrimString()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;
}
