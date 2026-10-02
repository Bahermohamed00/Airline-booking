import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { TrimString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

/** Server-side filters for GET /api/admin/payments (all optional, combined). */
export class AdminPaymentQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @TrimString()
  @Matches(/^[A-Za-z0-9]{4,10}$/, { message: 'reference must be 4–10 letters or digits' })
  reference?: string;

  @IsOptional()
  @IsUUID('4')
  bookingId?: string;

  /** createdAt >= from (yyyy-mm-dd, UTC day start). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'from must be a yyyy-mm-dd date' })
  from?: string;

  /** createdAt <= to (yyyy-mm-dd, inclusive of the whole UTC day). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'to must be a yyyy-mm-dd date' })
  to?: string;
}
