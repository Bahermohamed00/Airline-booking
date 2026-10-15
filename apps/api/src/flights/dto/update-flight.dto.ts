import { IsISO8601, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Editable flight fields. Deliberately narrow: route, aircraft and the
 * lifecycle status are NOT editable here — status changes go through
 * PATCH /flights/:id/status, and route/aircraft changes would affect existing
 * seat/booking references (out of scope by design).
 */
export class UpdateFlightDto {
  @IsOptional()
  @IsISO8601()
  departureTime?: string;

  @IsOptional()
  @IsISO8601()
  arrivalTime?: string;

  /** New economy base price (positive monetary value, max 2 decimals). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'price must be a monetary amount with at most 2 decimals' })
  @Min(0.01, { message: 'price must be a positive amount' })
  price?: number;
}
