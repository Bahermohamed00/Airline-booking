import { Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/** Tag numbers are airline-issued capability codes printed on bag receipts. */
export const BAGGAGE_TAG_PATTERN = /^[A-Z0-9]{6,20}$/;

export class TrackBaggageParamsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(BAGGAGE_TAG_PATTERN, { message: 'tagNumber must be 6–20 letters or digits' })
  tagNumber!: string;
}
