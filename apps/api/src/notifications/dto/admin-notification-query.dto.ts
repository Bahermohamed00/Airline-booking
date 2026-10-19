import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export const ADMIN_NOTIFICATION_CHANNELS = Object.values(NotificationChannel);
export const ADMIN_NOTIFICATION_STATUSES = Object.values(NotificationStatus);
export const ADMIN_NOTIFICATION_READ_FILTERS = ['unread', 'read'] as const;
export const ADMIN_NOTIFICATIONS_MAX_LIMIT = 100;

export type AdminNotificationReadFilter =
  (typeof ADMIN_NOTIFICATION_READ_FILTERS)[number];

/** Query contract for GET /api/admin/notifications. Anything not listed here is rejected by the global whitelist pipe. */
export class AdminNotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_NOTIFICATIONS_MAX_LIMIT)
  limit: number = 20;

  /** Delivery channel filter (exact enum values from the schema). */
  @IsOptional()
  @IsIn(ADMIN_NOTIFICATION_CHANNELS)
  channel?: NotificationChannel;

  /** Delivery status filter (PENDING/SENT/DELIVERED/FAILED/RETRYING). */
  @IsOptional()
  @IsIn(ADMIN_NOTIFICATION_STATUSES)
  status?: NotificationStatus;

  /** Read-state filter (readAt null vs. set) — distinct from delivery status. */
  @IsOptional()
  @IsIn(ADMIN_NOTIFICATION_READ_FILTERS)
  read?: AdminNotificationReadFilter;

  /**
   * Booking scope: only rows whose bookingId relation matches exactly.
   * Notifications are linked to bookings by the bookingId FK at creation
   * (booking/payment/cancellation/refund lifecycle notifications) — never
   * inferred from message content or recipient.
   */
  @IsOptional()
  @IsUUID('4')
  bookingId?: string;
}
