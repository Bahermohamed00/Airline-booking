import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const NOTIFICATION_READ_FILTERS = ['unread', 'read'] as const;
export const NOTIFICATIONS_MAX_LIMIT = 100;

export type NotificationReadFilter = (typeof NOTIFICATION_READ_FILTERS)[number];

/** Query contract for GET /api/notifications. Anything not listed here is rejected by the global whitelist pipe. */
export class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_MAX_LIMIT)
  limit: number = 20;

  @IsOptional()
  @IsIn(NOTIFICATION_READ_FILTERS)
  status?: NotificationReadFilter;
}
