import { IsOptional, Matches, MinLength, MaxLength } from 'class-validator';
import { TrimString } from '../../auth/dto/transforms.js';

export class PayBookingDto {
  /**
   * Tokenized payment reference issued by the provider SDK (PCI DSS tokenization
   * model — FR-C13/NFR-01). Raw card numbers/CVV/expiry are never accepted here.
   *
   * Required by the synchronous mock provider flow. Unused by the Stripe
   * PaymentIntent flow — card data is collected client-side by Stripe.js /
   * Payment Element and the backend only ever handles the PaymentIntent id and
   * client secret.
   */
  @TrimString()
  @IsOptional()
  @Matches(/^tok_[A-Za-z0-9_-]{3,128}$/, {
    message: 'token must be a tokenized payment reference (tok_…)',
  })
  token?: string;

  /**
   * Client-generated key; identical retries must reuse it, new attempts must
   * not. Uniqueness is enforced at the database level per booking.
   */
  @TrimString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}
