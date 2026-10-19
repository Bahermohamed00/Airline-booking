import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Maximum checked bags declarable per passenger at online check-in. Matches
 * the extras catalog's per-passenger extra-bag cap (BAG_23KG maxQuantity 3) so
 * declaration and purchase limits stay consistent.
 */
export const MAX_CHECKED_BAGS_PER_PASSENGER = 3;

export class CompleteCheckinDto {
  @IsUUID('4')
  bookingId!: string;

  @IsUUID('4')
  bookingPassengerId!: string;

  /**
   * Checked bags the passenger declares at check-in. Default 0 — online
   * check-in must NOT assume a checked bag exists; a bag record (with its
   * issued tag and initial CHECKED_IN event) is created only for explicitly
   * declared bags.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CHECKED_BAGS_PER_PASSENGER)
  checkedBagCount?: number;
}
