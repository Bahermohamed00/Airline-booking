import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class ReplyTicketDto {
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
