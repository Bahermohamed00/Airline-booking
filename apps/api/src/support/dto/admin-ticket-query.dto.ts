import { IsBooleanString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SupportTicketStatus } from '@prisma/client';
import { TrimString, UppercaseString } from '../../auth/dto/transforms.js';
import { ISO_DATE_PATTERN } from '../../schedule-rules/dto/create-schedule-rule.dto.js';

export const ADMIN_TICKET_MAX_LIMIT = 100;

/** Query contract for GET /api/admin/support/tickets. */
export class AdminTicketQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_TICKET_MAX_LIMIT)
  limit: number = 20;

  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  /** Partial, case-insensitive ticket-number match (e.g. "NT7K2P"). */
  @IsOptional()
  @UppercaseString()
  @IsString()
  @MaxLength(12)
  ticketNumber?: string;

  /** Partial, case-insensitive customer email match. */
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(255)
  email?: string;

  /**
   * History search: case-insensitive partial match across ticket number,
   * subject, customer first/last name and customer email.
   */
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(255)
  search?: string;

  /** History date range on closedAt (yyyy-mm-dd, inclusive both ends). */
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'closedFrom must be a yyyy-mm-dd date' })
  closedFrom?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'closedTo must be a yyyy-mm-dd date' })
  closedTo?: string;

  /** "true" = only tickets with at least one unread customer message. */
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}
