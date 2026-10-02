import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class PayBookingDto {
  /**
   * Tokenized payment reference issued by the provider SDK (PCI DSS tokenization
   * model — FR-C13/NFR-01). Raw card numbers/CVV/expiry are never accepted here.
   */
  @TrimString()
  @IsString()
  @Matches(/^tok_[A-Za-z0-9_-]{3,128}$/, {
    message: 'token must be a tokenized payment reference (tok_…)',
  })
  token!: string;

  /** Client-generated key; identical retries must reuse it, new attempts must not. */
  @TrimString()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}
