import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class RefundPaymentDto {
  /** Omit to refund the full remaining refundable amount. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount?: number;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
